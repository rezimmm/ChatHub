"""
Backend API Tests for Real-Time Chat Application
Tests: Auth (register/login), Users, Channels, Messages, Reactions, Pins, Search
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_"

class TestAuthEndpoints:
    """Authentication endpoint tests - register and login"""
    
    def test_register_new_user(self):
        """POST /api/auth/register - register new user, returns JWT token + user"""
        unique_email = f"{TEST_PREFIX}user_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}User_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "token_type" in data, "Missing token_type in response"
        assert "user" in data, "Missing user in response"
        assert data["token_type"] == "bearer"
        
        # Validate user object
        user = data["user"]
        assert user["email"] == unique_email
        assert "id" in user
        assert "username" in user
        assert "avatar_color" in user
        print(f"✓ Register successful - User ID: {user['id']}")
    
    def test_register_duplicate_email(self):
        """POST /api/auth/register - should fail for duplicate email"""
        unique_email = f"{TEST_PREFIX}dup_{uuid.uuid4().hex[:8]}@chat.com"
        
        # First registration
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}DupUser1",
            "password": "Test@1234"
        })
        
        # Second registration with same email
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}DupUser2",
            "password": "Test@1234"
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✓ Duplicate email correctly rejected: {data['detail']}")
    
    def test_login_success(self):
        """POST /api/auth/login - login with valid credentials"""
        # First register a user
        unique_email = f"{TEST_PREFIX}login_{uuid.uuid4().hex[:8]}@chat.com"
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}LoginUser",
            "password": "Test@1234"
        })
        
        # Now login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "Test@1234"
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == unique_email
        print(f"✓ Login successful - Token received")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - should fail with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@chat.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        print(f"✓ Invalid credentials correctly rejected")


class TestUserEndpoints:
    """User endpoint tests - list users, update profile"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for tests"""
        unique_email = f"{TEST_PREFIX}auth_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}AuthUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    def test_get_users_requires_auth(self):
        """GET /api/users - should require authentication"""
        response = requests.get(f"{BASE_URL}/api/users")
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}"
        print(f"✓ Users endpoint correctly requires auth")
    
    def test_get_users_with_auth(self, auth_token):
        """GET /api/users - list all users (auth required)"""
        response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get users failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of users"
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "username" in user
            assert "email" in user
            assert "hashed_password" not in user, "Password should not be exposed"
        print(f"✓ Get users successful - Found {len(data)} users")
    
    def test_update_profile(self, auth_token):
        """PUT /api/users/me - update profile (auth required)"""
        new_bio = f"Test bio {uuid.uuid4().hex[:8]}"
        response = requests.put(f"{BASE_URL}/api/users/me", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"bio": new_bio, "status": "busy"}
        )
        
        assert response.status_code == 200, f"Update profile failed: {response.text}"
        data = response.json()
        
        assert data["bio"] == new_bio, "Bio not updated"
        assert data["status"] == "busy", "Status not updated"
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/users/me", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert get_response.status_code == 200
        assert get_response.json()["bio"] == new_bio
        print(f"✓ Profile update successful and persisted")


class TestChannelEndpoints:
    """Channel endpoint tests - create, list, favorite"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for tests"""
        unique_email = f"{TEST_PREFIX}ch_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}ChUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    def test_create_channel(self, auth_token):
        """POST /api/channels - create channel (auth required)"""
        channel_name = f"{TEST_PREFIX}channel_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/channels",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "name": channel_name,
                "description": "Test channel description",
                "is_dm": False
            }
        )
        
        assert response.status_code == 200, f"Create channel failed: {response.text}"
        data = response.json()
        
        assert data["name"] == channel_name
        assert data["description"] == "Test channel description"
        assert "id" in data
        assert "members" in data
        print(f"✓ Channel created - ID: {data['id']}")
        return data["id"]
    
    def test_get_channels(self, auth_token):
        """GET /api/channels - list user channels (auth required)"""
        response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get channels failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of channels"
        # New user should have at least 'general' channel
        assert len(data) >= 1, "User should have at least one channel"
        print(f"✓ Get channels successful - Found {len(data)} channels")
    
    def test_toggle_favorite(self, auth_token):
        """PUT /api/channels/{id}/favorite - toggle favorite (auth required)"""
        # First create a channel
        channel_name = f"{TEST_PREFIX}fav_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(f"{BASE_URL}/api/channels",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": channel_name, "description": ""}
        )
        channel_id = create_response.json()["id"]
        
        # Toggle favorite ON
        response = requests.put(f"{BASE_URL}/api/channels/{channel_id}/favorite",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Toggle favorite failed: {response.text}"
        data = response.json()
        assert "favorite" in data
        print(f"✓ Toggle favorite successful - Favorite: {data['favorite']}")


class TestMessageEndpoints:
    """Message endpoint tests - create, edit, delete, reactions, pin, search"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and channel for message tests"""
        unique_email = f"{TEST_PREFIX}msg_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}MsgUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not register user")
        
        token = reg_response.json()["access_token"]
        user_id = reg_response.json()["user"]["id"]
        
        # Get channels (user should have general channel)
        ch_response = requests.get(f"{BASE_URL}/api/channels", headers={
            "Authorization": f"Bearer {token}"
        })
        channels = ch_response.json()
        if not channels:
            pytest.skip("No channels available")
        
        return {"token": token, "channel_id": channels[0]["id"], "user_id": user_id}
    
    def test_create_message(self, auth_setup):
        """POST /api/messages - create message in channel (auth required)"""
        content = f"Test message {uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert data["content"] == content
        assert data["channel_id"] == auth_setup["channel_id"]
        assert "id" in data
        assert "timestamp" in data
        assert "username" in data
        print(f"✓ Message created - ID: {data['id']}")
        return data["id"]
    
    def test_get_channel_messages(self, auth_setup):
        """GET /api/channels/{id}/messages - get channel messages (auth required)"""
        # First create a message
        requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": f"Test message for get {uuid.uuid4().hex[:8]}"
            }
        )
        
        response = requests.get(f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of messages"
        print(f"✓ Get messages successful - Found {len(data)} messages")
    
    def test_edit_message(self, auth_setup):
        """PUT /api/messages/{id} - edit message (auth required, own messages only)"""
        # Create a message
        create_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": "Original content"
            }
        )
        message_id = create_response.json()["id"]
        
        # Edit the message
        new_content = f"Edited content {uuid.uuid4().hex[:8]}"
        response = requests.put(f"{BASE_URL}/api/messages/{message_id}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"content": new_content}
        )
        
        assert response.status_code == 200, f"Edit message failed: {response.text}"
        data = response.json()
        
        assert data["content"] == new_content
        assert data["edited"] == True
        assert "edited_at" in data
        print(f"✓ Message edited successfully")
    
    def test_delete_message(self, auth_setup):
        """DELETE /api/messages/{id} - delete message (auth required, own messages only)"""
        # Create a message
        create_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": "Message to delete"
            }
        )
        message_id = create_response.json()["id"]
        
        # Delete the message
        response = requests.delete(f"{BASE_URL}/api/messages/{message_id}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Delete message failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Message deleted successfully")
    
    def test_add_reaction(self, auth_setup):
        """POST /api/messages/{id}/reactions - add/toggle reaction (auth required)"""
        # Create a message
        create_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": "Message for reaction"
            }
        )
        message_id = create_response.json()["id"]
        
        # Add reaction
        response = requests.post(f"{BASE_URL}/api/messages/{message_id}/reactions",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"emoji": "👍"}
        )
        
        assert response.status_code == 200, f"Add reaction failed: {response.text}"
        data = response.json()
        
        assert "reactions" in data
        assert len(data["reactions"]) > 0
        assert data["reactions"][0]["emoji"] == "👍"
        print(f"✓ Reaction added successfully")
    
    def test_toggle_pin(self, auth_setup):
        """POST /api/messages/{id}/pin - toggle pin message (auth required)"""
        # Create a message
        create_response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": "Message to pin"
            }
        )
        message_id = create_response.json()["id"]
        
        # Pin the message
        response = requests.post(f"{BASE_URL}/api/messages/{message_id}/pin",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Pin message failed: {response.text}"
        data = response.json()
        assert "pinned" in data
        print(f"✓ Message pin toggled - Pinned: {data['pinned']}")
    
    def test_search_messages(self, auth_setup):
        """GET /api/messages/search?q=query - search messages (auth required)"""
        # Create a message with unique content
        unique_content = f"UniqueSearchTerm_{uuid.uuid4().hex[:8]}"
        requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": unique_content
            }
        )
        
        # Search for the message
        response = requests.get(f"{BASE_URL}/api/messages/search?q={unique_content[:20]}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of search results"
        # Should find at least the message we just created
        found = any(unique_content in msg["content"] for msg in data)
        assert found, "Search should find the created message"
        print(f"✓ Search successful - Found {len(data)} results")


class TestEdgeCases:
    """Edge case and error handling tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for tests"""
        unique_email = f"{TEST_PREFIX}edge_{uuid.uuid4().hex[:8]}@chat.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}EdgeUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    def test_edit_nonexistent_message(self, auth_token):
        """PUT /api/messages/{id} - should return 404 for nonexistent message"""
        response = requests.put(f"{BASE_URL}/api/messages/nonexistent-id",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "New content"}
        )
        assert response.status_code == 404
        print(f"✓ Nonexistent message edit correctly returns 404")
    
    def test_delete_nonexistent_message(self, auth_token):
        """DELETE /api/messages/{id} - should return 404 for nonexistent message"""
        response = requests.delete(f"{BASE_URL}/api/messages/nonexistent-id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        print(f"✓ Nonexistent message delete correctly returns 404")
    
    def test_access_nonmember_channel(self, auth_token):
        """GET /api/channels/{id}/messages - should return 403 for non-member"""
        response = requests.get(f"{BASE_URL}/api/channels/nonexistent-channel/messages",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 403
        print(f"✓ Non-member channel access correctly returns 403")
    
    def test_invalid_token(self):
        """API calls with invalid token should return 401"""
        response = requests.get(f"{BASE_URL}/api/users",
            headers={"Authorization": "Bearer invalid-token"}
        )
        assert response.status_code == 401
        print(f"✓ Invalid token correctly returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
