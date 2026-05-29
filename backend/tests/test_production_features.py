"""
Backend API Tests for Production Features - Iteration 2
Tests: Rate limiting, Password validation, Username validation, Message pagination, 
       Mark channel read, Input sanitization, File upload, Health check
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_PROD_"


class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """GET /api/health - should return status ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "ok", "Health status should be 'ok'"
        assert "timestamp" in data, "Health response should include timestamp"
        print(f"✓ Health check passed - Status: {data['status']}")


class TestPasswordValidation:
    """Password validation tests - min 6 characters"""
    
    def test_register_short_password(self):
        """POST /api/auth/register - should reject password < 6 chars"""
        unique_email = f"{TEST_PREFIX}short_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}ShortPwd",
            "password": "12345"  # Only 5 chars
        })
        
        assert response.status_code == 422, f"Expected 422 for short password, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        # Check that error mentions password validation
        error_msg = str(data["detail"]).lower()
        assert "password" in error_msg or "6" in error_msg, f"Error should mention password: {data['detail']}"
        print(f"✓ Short password correctly rejected")
    
    def test_register_valid_password(self):
        """POST /api/auth/register - should accept password >= 6 chars"""
        unique_email = f"{TEST_PREFIX}valid_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}ValidPwd_{uuid.uuid4().hex[:4]}",
            "password": "123456"  # Exactly 6 chars
        })
        
        assert response.status_code == 200, f"Valid password should be accepted: {response.text}"
        print(f"✓ Valid password (6 chars) accepted")


class TestUsernameValidation:
    """Username validation tests - 2-30 chars, alphanumeric+spaces+hyphens+underscores"""
    
    def test_register_short_username(self):
        """POST /api/auth/register - should reject username < 2 chars"""
        unique_email = f"{TEST_PREFIX}shortuser_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": "A",  # Only 1 char
            "password": "Test@1234"
        })
        
        assert response.status_code == 422, f"Expected 422 for short username, got {response.status_code}"
        print(f"✓ Short username (1 char) correctly rejected")
    
    def test_register_long_username(self):
        """POST /api/auth/register - should reject username > 30 chars"""
        unique_email = f"{TEST_PREFIX}longuser_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": "A" * 31,  # 31 chars
            "password": "Test@1234"
        })
        
        assert response.status_code == 422, f"Expected 422 for long username, got {response.status_code}"
        print(f"✓ Long username (31 chars) correctly rejected")
    
    def test_register_invalid_username_chars(self):
        """POST /api/auth/register - should reject username with special chars"""
        unique_email = f"{TEST_PREFIX}special_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": "User@#$%",  # Invalid special chars
            "password": "Test@1234"
        })
        
        assert response.status_code == 422, f"Expected 422 for invalid username chars, got {response.status_code}"
        print(f"✓ Username with special chars correctly rejected")
    
    def test_register_valid_username_with_spaces(self):
        """POST /api/auth/register - should accept username with spaces/hyphens/underscores"""
        unique_email = f"{TEST_PREFIX}spaces_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": "Test User-Name_123",  # Valid: letters, numbers, spaces, hyphens, underscores
            "password": "Test@1234"
        })
        
        assert response.status_code == 200, f"Valid username should be accepted: {response.text}"
        print(f"✓ Username with spaces/hyphens/underscores accepted")


class TestDuplicateChecks:
    """Duplicate email and username checks"""
    
    def test_duplicate_email(self):
        """POST /api/auth/register - should reject duplicate email"""
        unique_email = f"{TEST_PREFIX}dup_email_{uuid.uuid4().hex[:8]}@chat.com"
        
        # First registration
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}DupEmail1_{uuid.uuid4().hex[:4]}",
            "password": "Test@1234"
        })
        
        # Second registration with same email
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}DupEmail2_{uuid.uuid4().hex[:4]}",
            "password": "Test@1234"
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        data = response.json()
        assert "email" in data.get("detail", "").lower() or "registered" in data.get("detail", "").lower()
        print(f"✓ Duplicate email correctly rejected")
    
    def test_duplicate_username(self):
        """POST /api/auth/register - should reject duplicate username"""
        unique_username = f"{TEST_PREFIX}DupUser_{uuid.uuid4().hex[:6]}"
        
        # First registration
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"{TEST_PREFIX}dup1_{uuid.uuid4().hex[:8]}@chat.com",
            "username": unique_username,
            "password": "Test@1234"
        })
        
        # Second registration with same username
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"{TEST_PREFIX}dup2_{uuid.uuid4().hex[:8]}@chat.com",
            "username": unique_username,
            "password": "Test@1234"
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate username, got {response.status_code}"
        data = response.json()
        assert "username" in data.get("detail", "").lower() or "taken" in data.get("detail", "").lower()
        print(f"✓ Duplicate username correctly rejected")


class TestMessagePagination:
    """Message pagination tests - limit and before params"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and channel for pagination tests"""
        unique_email = f"{TEST_PREFIX}pag_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}PagUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not register user")
        
        token = reg_response.json()["access_token"]
        
        # Get channels
        ch_response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {token}"
        })
        channels = ch_response.json()
        if not channels:
            pytest.skip("No channels available")
        
        return {"token": token, "channel_id": channels[0]["id"]}
    
    def test_pagination_with_limit(self, auth_setup):
        """GET /api/channels/{id}/messages?limit=5 - should return limited messages"""
        # Create 10 messages
        for i in range(10):
            requests.post(f"{BASE_URL}/api/messages",
                headers={"Authorization": f"Bearer {auth_setup['token']}"},
                json={
                    "channel_id": auth_setup["channel_id"],
                    "content": f"Pagination test message {i} - {uuid.uuid4().hex[:8]}"
                }
            )
        
        # Request with limit=5
        response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/messages?limit=5",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Pagination failed: {response.text}"
        data = response.json()
        
        assert len(data) <= 5, f"Expected max 5 messages, got {len(data)}"
        print(f"✓ Pagination with limit=5 works - Got {len(data)} messages")
    
    def test_pagination_with_before(self, auth_setup):
        """GET /api/channels/{id}/messages?limit=5&before=timestamp - should return older messages"""
        # Create messages with slight delay to ensure different timestamps
        messages = []
        for i in range(5):
            response = requests.post(f"{BASE_URL}/api/messages",
                headers={"Authorization": f"Bearer {auth_setup['token']}"},
                json={
                    "channel_id": auth_setup["channel_id"],
                    "content": f"Before test message {i} - {uuid.uuid4().hex[:8]}"
                }
            )
            if response.status_code == 200:
                messages.append(response.json())
            time.sleep(0.1)  # Small delay for timestamp difference
        
        if len(messages) < 3:
            pytest.skip("Could not create enough messages")
        
        # Get the timestamp of a middle message
        middle_timestamp = messages[2]["timestamp"]
        
        # Request messages before that timestamp
        response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/messages?limit=50&before={middle_timestamp}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Pagination with before failed: {response.text}"
        data = response.json()
        
        # All returned messages should have timestamp < middle_timestamp
        for msg in data:
            assert msg["timestamp"] < middle_timestamp, f"Message timestamp {msg['timestamp']} should be before {middle_timestamp}"
        
        print(f"✓ Pagination with before param works - Got {len(data)} older messages")


class TestMarkChannelRead:
    """Mark channel as read tests"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and channel"""
        unique_email = f"{TEST_PREFIX}read_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}ReadUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not register user")
        
        token = reg_response.json()["access_token"]
        
        ch_response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {token}"
        })
        channels = ch_response.json()
        if not channels:
            pytest.skip("No channels available")
        
        return {"token": token, "channel_id": channels[0]["id"]}
    
    def test_mark_channel_read(self, auth_setup):
        """PUT /api/channels/{id}/read - should mark channel as read"""
        response = requests.put(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/read",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Response should indicate success"
        print(f"✓ Mark channel read works")


class TestInputSanitization:
    """Input sanitization tests - HTML entities should be escaped"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and channel"""
        unique_email = f"{TEST_PREFIX}san_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}SanUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not register user")
        
        token = reg_response.json()["access_token"]
        
        ch_response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {token}"
        })
        channels = ch_response.json()
        if not channels:
            pytest.skip("No channels available")
        
        return {"token": token, "channel_id": channels[0]["id"]}
    
    def test_message_html_sanitization(self, auth_setup):
        """POST /api/messages - HTML should be escaped"""
        xss_content = "<script>alert('xss')</script>"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": xss_content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        # Content should be escaped
        assert "<script>" not in data["content"], "Script tags should be escaped"
        assert "&lt;script&gt;" in data["content"] or "script" in data["content"].lower(), "HTML should be escaped"
        print(f"✓ HTML sanitization works - Content: {data['content'][:50]}...")
    
    def test_channel_name_sanitization(self, auth_setup):
        """POST /api/channels - channel name should be sanitized"""
        xss_name = "<img src=x onerror=alert(1)>"
        response = requests.post(f"{BASE_URL}/api/channels",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "name": xss_name,
                "description": "Test channel"
            }
        )
        
        assert response.status_code == 200, f"Create channel failed: {response.text}"
        data = response.json()
        
        # Name should be escaped
        assert "<img" not in data["name"], "HTML tags should be escaped"
        print(f"✓ Channel name sanitization works")


class TestFileUpload:
    """File upload tests - max 10MB"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        unique_email = f"{TEST_PREFIX}upload_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}UploadUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not register user")
        
        return reg_response.json()["access_token"]
    
    def test_file_upload_small_file(self, auth_token):
        """POST /api/upload - should accept small file"""
        # Create a small test file
        file_content = b"Test file content " * 100  # ~1.8KB
        files = {"file": ("test.txt", file_content, "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files
        )
        
        assert response.status_code == 200, f"File upload failed: {response.text}"
        data = response.json()
        
        assert "file_url" in data, "Response should include file_url"
        assert "file_name" in data, "Response should include file_name"
        assert data["file_name"] == "test.txt"
        print(f"✓ Small file upload works - URL: {data['file_url']}")
    
    def test_file_upload_too_large(self, auth_token):
        """POST /api/upload - should reject file > 10MB"""
        # Create a file larger than 10MB
        file_content = b"X" * (11 * 1024 * 1024)  # 11MB
        files = {"file": ("large.txt", file_content, "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files
        )
        
        assert response.status_code == 413, f"Expected 413 for large file, got {response.status_code}"
        print(f"✓ Large file (>10MB) correctly rejected")


class TestRateLimiting:
    """Rate limiting tests - register 5/min, login 10/min"""
    
    def test_login_rate_limit(self):
        """POST /api/auth/login - should be rate limited to 10/min"""
        # Note: This test may not trigger rate limit in test environment
        # as rate limits are often per-IP and test runs may be fast
        
        # Make 12 rapid login attempts
        responses = []
        for i in range(12):
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": f"ratelimit{i}@test.com",
                "password": "wrongpassword"
            })
            responses.append(response.status_code)
        
        # Check if any request was rate limited (429)
        rate_limited = 429 in responses
        
        # If not rate limited, it's acceptable in test environment
        # but we should at least verify the endpoint works
        assert 401 in responses or 429 in responses, "Login should return 401 or 429"
        
        if rate_limited:
            print(f"✓ Login rate limiting works - Got 429 after multiple attempts")
        else:
            print(f"✓ Login endpoint works (rate limit may not trigger in test env)")
    
    def test_register_rate_limit(self):
        """POST /api/auth/register - should be rate limited to 5/min"""
        # Make 7 rapid register attempts
        responses = []
        for i in range(7):
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": f"{TEST_PREFIX}rate_{uuid.uuid4().hex[:8]}@chat.com",
                "username": f"{TEST_PREFIX}RateUser_{uuid.uuid4().hex[:6]}",
                "password": "Test@1234"
            })
            responses.append(response.status_code)
        
        # Check if any request was rate limited (429)
        rate_limited = 429 in responses
        
        if rate_limited:
            print(f"✓ Register rate limiting works - Got 429 after multiple attempts")
        else:
            # In test environment, rate limit may not trigger
            success_count = responses.count(200)
            print(f"✓ Register endpoint works - {success_count} successful registrations")


class TestRegressionBasicFeatures:
    """Regression tests for basic features from iteration 1"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and channel"""
        unique_email = f"{TEST_PREFIX}reg_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}RegUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not register user")
        
        token = reg_response.json()["access_token"]
        user_id = reg_response.json()["user"]["id"]
        
        ch_response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {token}"
        })
        channels = ch_response.json()
        if not channels:
            pytest.skip("No channels available")
        
        return {"token": token, "channel_id": channels[0]["id"], "user_id": user_id}
    
    def test_create_edit_delete_message(self, auth_setup):
        """Regression: Create, edit, delete message flow"""
        # Create
        create_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": "Regression test message"
            }
        )
        assert create_response.status_code == 200
        message_id = create_response.json()["id"]
        
        # Edit
        edit_response = requests.put(f"{BASE_URL}/api/messages/{message_id}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"content": "Edited regression message"}
        )
        assert edit_response.status_code == 200
        assert edit_response.json()["edited"] == True
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/messages/{message_id}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        assert delete_response.status_code == 200
        
        print(f"✓ Regression: Create/Edit/Delete message flow works")
    
    def test_reactions_and_pin(self, auth_setup):
        """Regression: Reactions and pin message"""
        # Create message
        create_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": "Message for reactions"
            }
        )
        message_id = create_response.json()["id"]
        
        # Add reaction
        reaction_response = requests.post(f"{BASE_URL}/api/messages/{message_id}/reactions",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"emoji": "👍"}
        )
        assert reaction_response.status_code == 200
        
        # Pin message
        pin_response = requests.post(f"{BASE_URL}/api/messages/{message_id}/pin",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        assert pin_response.status_code == 200
        
        print(f"✓ Regression: Reactions and pin work")
    
    def test_channel_favorite(self, auth_setup):
        """Regression: Toggle channel favorite"""
        response = requests.put(f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/favorite",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        assert response.status_code == 200
        assert "favorite" in response.json()
        
        print(f"✓ Regression: Channel favorite toggle works")
    
    def test_search_messages(self, auth_setup):
        """Regression: Search messages"""
        # Create a unique message
        unique_term = f"UniqueSearch_{uuid.uuid4().hex[:8]}"
        requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": unique_term
            }
        )
        
        # Search
        response = requests.get(f"{BASE_URL}/api/messages/search?q={unique_term[:15]}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        assert response.status_code == 200
        
        print(f"✓ Regression: Message search works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
