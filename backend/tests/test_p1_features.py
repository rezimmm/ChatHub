"""
Backend API Tests for P1 Features - Iteration 3
Tests: Inline auth validation, Read receipts, Thread/conversation support
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_P1_"


class TestInlineAuthValidation:
    """Tests for inline validation errors on auth form"""
    
    def test_short_password_returns_422_with_field_error(self):
        """POST /api/auth/register - short password should return 422 with field-level error"""
        unique_email = f"{TEST_PREFIX}shortpwd_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}ShortPwd_{uuid.uuid4().hex[:4]}",
            "password": "12345"  # Only 5 chars - should fail
        })
        
        assert response.status_code == 422, f"Expected 422 for short password, got {response.status_code}"
        data = response.json()
        
        # Check that error is field-level (detail is array with loc)
        assert "detail" in data, "Response should have detail field"
        if isinstance(data["detail"], list):
            # Pydantic validation error format
            password_error = any(
                "password" in str(err.get("loc", [])).lower() 
                for err in data["detail"]
            )
            assert password_error, f"Error should mention password field: {data['detail']}"
        else:
            # String error format
            assert "password" in str(data["detail"]).lower() or "6" in str(data["detail"])
        
        print(f"✓ Short password returns 422 with field-level error")
    
    def test_short_username_returns_422_with_field_error(self):
        """POST /api/auth/register - short username should return 422 with field-level error"""
        unique_email = f"{TEST_PREFIX}shortuser_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": "A",  # Only 1 char - should fail
            "password": "Test@1234"
        })
        
        assert response.status_code == 422, f"Expected 422 for short username, got {response.status_code}"
        data = response.json()
        
        assert "detail" in data, "Response should have detail field"
        if isinstance(data["detail"], list):
            username_error = any(
                "username" in str(err.get("loc", [])).lower() 
                for err in data["detail"]
            )
            assert username_error, f"Error should mention username field: {data['detail']}"
        else:
            assert "username" in str(data["detail"]).lower() or "2" in str(data["detail"])
        
        print(f"✓ Short username returns 422 with field-level error")
    
    def test_duplicate_email_returns_400_with_email_error(self):
        """POST /api/auth/register - duplicate email should return 400 with email-specific error"""
        unique_email = f"{TEST_PREFIX}dupemail_{uuid.uuid4().hex[:8]}@chat.com"
        
        # First registration
        first_response = requests.post(f"{BASE_URL}/api/auth/register", json={
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
        
        # Error message should mention email
        assert "email" in data.get("detail", "").lower(), f"Error should mention email: {data}"
        print(f"✓ Duplicate email returns 400 with email-specific error")
    
    def test_invalid_email_format_returns_422(self):
        """POST /api/auth/register - invalid email format should return 422"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "not-an-email",
            "username": f"{TEST_PREFIX}InvalidEmail_{uuid.uuid4().hex[:4]}",
            "password": "Test@1234"
        })
        
        assert response.status_code == 422, f"Expected 422 for invalid email, got {response.status_code}"
        print(f"✓ Invalid email format returns 422")


class TestReadReceipts:
    """Tests for message read receipts (read_by tracking)"""
    
    @pytest.fixture
    def auth_setup(self):
        """Create two users and get auth tokens"""
        # User 1
        email1 = f"{TEST_PREFIX}read1_{uuid.uuid4().hex[:8]}@chat.com"
        reg1 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email1,
            "username": f"{TEST_PREFIX}ReadUser1_{uuid.uuid4().hex[:4]}",
            "password": "Test@1234"
        })
        if reg1.status_code != 200:
            pytest.skip(f"Could not register user 1: {reg1.text}")
        
        token1 = reg1.json()["access_token"]
        user1 = reg1.json()["user"]
        
        # User 2
        email2 = f"{TEST_PREFIX}read2_{uuid.uuid4().hex[:8]}@chat.com"
        reg2 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email2,
            "username": f"{TEST_PREFIX}ReadUser2_{uuid.uuid4().hex[:4]}",
            "password": "Test@1234"
        })
        if reg2.status_code != 200:
            pytest.skip(f"Could not register user 2: {reg2.text}")
        
        token2 = reg2.json()["access_token"]
        user2 = reg2.json()["user"]
        
        # Get channels
        ch_response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {token1}"
        })
        channels = ch_response.json()
        if not channels:
            pytest.skip("No channels available")
        
        return {
            "token1": token1, "user1": user1,
            "token2": token2, "user2": user2,
            "channel_id": channels[0]["id"]
        }
    
    def test_message_created_with_sender_in_read_by(self, auth_setup):
        """POST /api/messages - new message should have sender in read_by"""
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token1']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": f"Read receipt test message {uuid.uuid4().hex[:8]}"
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        # Verify read_by contains sender
        assert "read_by" in data, "Message should have read_by field"
        assert auth_setup["user1"]["id"] in data["read_by"], "Sender should be in read_by"
        print(f"✓ New message has sender in read_by: {data['read_by']}")
    
    def test_mark_message_as_read(self, auth_setup):
        """POST /api/messages/{id}/read - should add user to read_by"""
        # User 1 creates a message
        create_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token1']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": f"Message to be read {uuid.uuid4().hex[:8]}"
            }
        )
        assert create_response.status_code == 200
        message_id = create_response.json()["id"]
        
        # User 2 marks it as read
        read_response = requests.post(f"{BASE_URL}/api/messages/{message_id}/read",
            headers={"Authorization": f"Bearer {auth_setup['token2']}"}
        )
        
        assert read_response.status_code == 200, f"Mark read failed: {read_response.text}"
        assert read_response.json().get("success") == True
        
        # Verify by fetching messages
        messages_response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/messages?limit=50",
            headers={"Authorization": f"Bearer {auth_setup['token1']}"}
        )
        messages = messages_response.json()
        
        # Find our message
        our_message = next((m for m in messages if m["id"] == message_id), None)
        assert our_message is not None, "Message should exist"
        assert auth_setup["user2"]["id"] in our_message["read_by"], "User 2 should be in read_by"
        
        print(f"✓ Mark message as read works - read_by: {our_message['read_by']}")
    
    def test_mark_all_messages_read(self, auth_setup):
        """POST /api/channels/{id}/read-all - should mark all messages as read"""
        # User 1 creates multiple messages
        for i in range(3):
            requests.post(f"{BASE_URL}/api/messages",
                headers={"Authorization": f"Bearer {auth_setup['token1']}"},
                json={
                    "channel_id": auth_setup["channel_id"],
                    "content": f"Bulk read test {i} - {uuid.uuid4().hex[:8]}"
                }
            )
        
        # User 2 marks all as read
        read_all_response = requests.post(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/read-all",
            headers={"Authorization": f"Bearer {auth_setup['token2']}"}
        )
        
        assert read_all_response.status_code == 200, f"Mark all read failed: {read_all_response.text}"
        assert read_all_response.json().get("success") == True
        
        print(f"✓ Mark all messages as read works")
    
    def test_mark_read_nonexistent_message(self, auth_setup):
        """POST /api/messages/{id}/read - should return 404 for nonexistent message"""
        fake_id = str(uuid.uuid4())
        response = requests.post(f"{BASE_URL}/api/messages/{fake_id}/read",
            headers={"Authorization": f"Bearer {auth_setup['token1']}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Mark read returns 404 for nonexistent message")


class TestThreadSupport:
    """Tests for thread/conversation support"""
    
    @pytest.fixture
    def auth_setup(self):
        """Create user and get auth token"""
        email = f"{TEST_PREFIX}thread_{uuid.uuid4().hex[:8]}@chat.com"
        reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "username": f"{TEST_PREFIX}ThreadUser_{uuid.uuid4().hex[:4]}",
            "password": "Test@1234"
        })
        if reg.status_code != 200:
            pytest.skip(f"Could not register user: {reg.text}")
        
        token = reg.json()["access_token"]
        user = reg.json()["user"]
        
        ch_response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {token}"
        })
        channels = ch_response.json()
        if not channels:
            pytest.skip("No channels available")
        
        return {"token": token, "user": user, "channel_id": channels[0]["id"]}
    
    def test_create_thread_reply(self, auth_setup):
        """POST /api/messages with thread_id - should create thread reply"""
        # Create parent message
        parent_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": f"Parent message for thread {uuid.uuid4().hex[:8]}"
            }
        )
        assert parent_response.status_code == 200
        parent_id = parent_response.json()["id"]
        
        # Create thread reply
        reply_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": f"Thread reply {uuid.uuid4().hex[:8]}",
                "thread_id": parent_id
            }
        )
        
        assert reply_response.status_code == 200, f"Create thread reply failed: {reply_response.text}"
        reply_data = reply_response.json()
        
        assert reply_data["thread_id"] == parent_id, "Reply should have thread_id set to parent"
        print(f"✓ Thread reply created with thread_id: {reply_data['thread_id']}")
    
    def test_thread_reply_increments_parent_reply_count(self, auth_setup):
        """POST /api/messages with thread_id - should increment parent's reply_count"""
        # Create parent message
        parent_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": f"Parent for reply count test {uuid.uuid4().hex[:8]}"
            }
        )
        assert parent_response.status_code == 200
        parent_id = parent_response.json()["id"]
        initial_reply_count = parent_response.json().get("reply_count", 0)
        
        # Create 2 thread replies
        for i in range(2):
            requests.post(f"{BASE_URL}/api/messages",
                headers={"Authorization": f"Bearer {auth_setup['token']}"},
                json={
                    "channel_id": auth_setup["channel_id"],
                    "content": f"Reply {i} - {uuid.uuid4().hex[:8]}",
                    "thread_id": parent_id
                }
            )
        
        # Fetch messages and check parent's reply_count
        messages_response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/messages?limit=50",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        messages = messages_response.json()
        
        parent_msg = next((m for m in messages if m["id"] == parent_id), None)
        assert parent_msg is not None, "Parent message should exist"
        assert parent_msg["reply_count"] == initial_reply_count + 2, f"Reply count should be {initial_reply_count + 2}, got {parent_msg['reply_count']}"
        
        print(f"✓ Thread reply increments parent reply_count: {parent_msg['reply_count']}")
    
    def test_get_thread_replies(self, auth_setup):
        """GET /api/messages/{id}/thread - should return thread replies"""
        # Create parent message
        parent_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": f"Parent for get thread test {uuid.uuid4().hex[:8]}"
            }
        )
        assert parent_response.status_code == 200
        parent_id = parent_response.json()["id"]
        
        # Create thread replies
        reply_contents = []
        for i in range(3):
            content = f"Thread reply {i} - {uuid.uuid4().hex[:8]}"
            reply_contents.append(content)
            requests.post(f"{BASE_URL}/api/messages",
                headers={"Authorization": f"Bearer {auth_setup['token']}"},
                json={
                    "channel_id": auth_setup["channel_id"],
                    "content": content,
                    "thread_id": parent_id
                }
            )
        
        # Get thread
        thread_response = requests.get(f"{BASE_URL}/api/messages/{parent_id}/thread",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert thread_response.status_code == 200, f"Get thread failed: {thread_response.text}"
        replies = thread_response.json()
        
        assert len(replies) == 3, f"Expected 3 replies, got {len(replies)}"
        
        # Verify all replies have correct thread_id
        for reply in replies:
            assert reply["thread_id"] == parent_id, f"Reply should have thread_id={parent_id}"
        
        print(f"✓ Get thread returns {len(replies)} replies")
    
    def test_get_thread_nonexistent_message(self, auth_setup):
        """GET /api/messages/{id}/thread - should return 404 for nonexistent message"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/messages/{fake_id}/thread",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Get thread returns 404 for nonexistent message")
    
    def test_thread_replies_sorted_by_timestamp(self, auth_setup):
        """GET /api/messages/{id}/thread - replies should be sorted by timestamp ascending"""
        # Create parent message
        parent_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": f"Parent for sort test {uuid.uuid4().hex[:8]}"
            }
        )
        parent_id = parent_response.json()["id"]
        
        # Create replies with small delays
        for i in range(3):
            requests.post(f"{BASE_URL}/api/messages",
                headers={"Authorization": f"Bearer {auth_setup['token']}"},
                json={
                    "channel_id": auth_setup["channel_id"],
                    "content": f"Reply {i}",
                    "thread_id": parent_id
                }
            )
            time.sleep(0.1)
        
        # Get thread
        thread_response = requests.get(f"{BASE_URL}/api/messages/{parent_id}/thread",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        replies = thread_response.json()
        
        # Verify sorted by timestamp ascending
        timestamps = [r["timestamp"] for r in replies]
        assert timestamps == sorted(timestamps), "Replies should be sorted by timestamp ascending"
        
        print(f"✓ Thread replies sorted by timestamp ascending")


class TestRegressionBasicAuth:
    """Quick regression tests for basic auth features"""
    
    def test_login_with_valid_credentials(self):
        """POST /api/auth/login - should work with valid credentials"""
        # Use existing test user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "prod_test@chat.com",
            "password": "Secure@123"
        })
        
        if response.status_code == 401:
            # User might not exist, create it
            reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": "prod_test@chat.com",
                "username": "ProdTestUser",
                "password": "Secure@123"
            })
            if reg_response.status_code == 200:
                print(f"✓ Created prod_test user")
                return
            elif reg_response.status_code == 400:
                # Email exists but password wrong - skip
                pytest.skip("prod_test user exists with different password")
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ Login with valid credentials works")
    
    def test_login_with_invalid_credentials(self):
        """POST /api/auth/login - should return 401 for invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@chat.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Login with invalid credentials returns 401")


class TestRegressionMessaging:
    """Quick regression tests for messaging features"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and channel"""
        email = f"{TEST_PREFIX}regmsg_{uuid.uuid4().hex[:8]}@chat.com"
        reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "username": f"{TEST_PREFIX}RegMsgUser_{uuid.uuid4().hex[:4]}",
            "password": "Test@1234"
        })
        if reg.status_code != 200:
            pytest.skip(f"Could not register user: {reg.text}")
        
        token = reg.json()["access_token"]
        
        ch_response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {token}"
        })
        channels = ch_response.json()
        if not channels:
            pytest.skip("No channels available")
        
        return {"token": token, "channel_id": channels[0]["id"]}
    
    def test_send_and_receive_message(self, auth_setup):
        """Regression: Send message and verify it appears in channel"""
        content = f"Regression test message {uuid.uuid4().hex[:8]}"
        
        # Send
        send_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        assert send_response.status_code == 200
        message_id = send_response.json()["id"]
        
        # Verify in channel
        messages_response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/messages?limit=50",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        messages = messages_response.json()
        
        found = any(m["id"] == message_id for m in messages)
        assert found, "Message should appear in channel"
        
        print(f"✓ Regression: Send and receive message works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
