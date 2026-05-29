"""
Backend API Tests for Iteration 4 Features
Tests: Channel member management (add/remove members), Channel settings (update name/description),
       Get channel details, Get channel members
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_IT4_"


class TestChannelDetails:
    """GET /api/channels/{id} - Get channel details"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and create a channel"""
        unique_email = f"{TEST_PREFIX}detail_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}DetailUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not register user")
        
        token = reg_response.json()["access_token"]
        user_id = reg_response.json()["user"]["id"]
        
        # Create a test channel
        ch_response = requests.post(f"{BASE_URL}/api/channels",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": f"{TEST_PREFIX}TestChannel_{uuid.uuid4().hex[:6]}",
                "description": "Test channel for details"
            }
        )
        if ch_response.status_code != 200:
            pytest.skip("Could not create channel")
        
        channel = ch_response.json()
        return {"token": token, "channel_id": channel["id"], "user_id": user_id}
    
    def test_get_channel_details_success(self, auth_setup):
        """GET /api/channels/{id} - should return channel details for member"""
        response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Get channel failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should include id"
        assert "name" in data, "Response should include name"
        assert "members" in data, "Response should include members"
        assert "created_by" in data, "Response should include created_by"
        assert auth_setup["user_id"] in data["members"], "Creator should be in members"
        print(f"✓ GET /api/channels/{{id}} works - Channel: {data['name']}")
    
    def test_get_channel_details_not_found(self, auth_setup):
        """GET /api/channels/{id} - should return 404 for non-existent channel"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/channels/{fake_id}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ GET /api/channels/{{id}} returns 404 for non-existent channel")
    
    def test_get_channel_details_access_denied(self, auth_setup):
        """GET /api/channels/{id} - should return 403 for non-member"""
        # Create another user
        other_email = f"{TEST_PREFIX}other_{uuid.uuid4().hex[:8]}@chat.com"
        other_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": other_email,
            "username": f"{TEST_PREFIX}OtherUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if other_response.status_code != 200:
            pytest.skip("Could not create other user")
        
        other_token = other_response.json()["access_token"]
        
        # Try to access channel as non-member
        response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}",
            headers={"Authorization": f"Bearer {other_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ GET /api/channels/{{id}} returns 403 for non-member")


class TestChannelUpdate:
    """PUT /api/channels/{id} - Update channel name/description"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and create a channel"""
        unique_email = f"{TEST_PREFIX}update_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}UpdateUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if reg_response.status_code != 200:
            pytest.skip("Could not register user")
        
        token = reg_response.json()["access_token"]
        user_id = reg_response.json()["user"]["id"]
        
        # Create a test channel
        ch_response = requests.post(f"{BASE_URL}/api/channels",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": f"{TEST_PREFIX}UpdateChannel_{uuid.uuid4().hex[:6]}",
                "description": "Original description"
            }
        )
        if ch_response.status_code != 200:
            pytest.skip("Could not create channel")
        
        channel = ch_response.json()
        return {"token": token, "channel_id": channel["id"], "user_id": user_id}
    
    def test_update_channel_name(self, auth_setup):
        """PUT /api/channels/{id} - creator can update channel name"""
        new_name = f"{TEST_PREFIX}UpdatedName_{uuid.uuid4().hex[:6]}"
        response = requests.put(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"name": new_name}
        )
        
        assert response.status_code == 200, f"Update channel failed: {response.text}"
        data = response.json()
        
        assert data["name"] == new_name, f"Name should be updated to {new_name}"
        print(f"✓ PUT /api/channels/{{id}} - name update works")
    
    def test_update_channel_description(self, auth_setup):
        """PUT /api/channels/{id} - creator can update channel description"""
        new_desc = "Updated description for testing"
        response = requests.put(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"description": new_desc}
        )
        
        assert response.status_code == 200, f"Update channel failed: {response.text}"
        data = response.json()
        
        assert data["description"] == new_desc, f"Description should be updated"
        print(f"✓ PUT /api/channels/{{id}} - description update works")
    
    def test_update_channel_non_creator_forbidden(self, auth_setup):
        """PUT /api/channels/{id} - non-creator should get 403"""
        # Create another user and add to channel
        other_email = f"{TEST_PREFIX}noncreator_{uuid.uuid4().hex[:8]}@chat.com"
        other_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": other_email,
            "username": f"{TEST_PREFIX}NonCreator_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if other_response.status_code != 200:
            pytest.skip("Could not create other user")
        
        other_token = other_response.json()["access_token"]
        other_user_id = other_response.json()["user"]["id"]
        
        # Add other user to channel
        requests.post(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"user_id": other_user_id}
        )
        
        # Try to update as non-creator
        response = requests.put(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}",
            headers={"Authorization": f"Bearer {other_token}"},
            json={"name": "Unauthorized update"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ PUT /api/channels/{{id}} - non-creator gets 403")


class TestChannelMembers:
    """Channel member management tests"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and create a channel with another user"""
        # Create main user (channel creator)
        main_email = f"{TEST_PREFIX}main_{uuid.uuid4().hex[:8]}@chat.com"
        main_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": main_email,
            "username": f"{TEST_PREFIX}MainUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if main_response.status_code != 200:
            pytest.skip("Could not register main user")
        
        main_token = main_response.json()["access_token"]
        main_user_id = main_response.json()["user"]["id"]
        
        # Create another user to add/remove
        other_email = f"{TEST_PREFIX}member_{uuid.uuid4().hex[:8]}@chat.com"
        other_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": other_email,
            "username": f"{TEST_PREFIX}MemberUser_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if other_response.status_code != 200:
            pytest.skip("Could not register other user")
        
        other_user_id = other_response.json()["user"]["id"]
        other_token = other_response.json()["access_token"]
        
        # Create a test channel
        ch_response = requests.post(f"{BASE_URL}/api/channels",
            headers={"Authorization": f"Bearer {main_token}"},
            json={
                "name": f"{TEST_PREFIX}MemberChannel_{uuid.uuid4().hex[:6]}",
                "description": "Test channel for member management"
            }
        )
        if ch_response.status_code != 200:
            pytest.skip("Could not create channel")
        
        channel = ch_response.json()
        return {
            "token": main_token,
            "channel_id": channel["id"],
            "user_id": main_user_id,
            "other_user_id": other_user_id,
            "other_token": other_token
        }
    
    def test_add_member_to_channel(self, auth_setup):
        """POST /api/channels/{id}/members - add member to channel"""
        response = requests.post(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"user_id": auth_setup["other_user_id"]}
        )
        
        assert response.status_code == 200, f"Add member failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Response should indicate success"
        print(f"✓ POST /api/channels/{{id}}/members - add member works")
        
        # Verify member was added
        members_response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        members_data = members_response.json()
        member_ids = [m["id"] for m in members_data["members"]]
        assert auth_setup["other_user_id"] in member_ids, "Added user should be in members"
        print(f"✓ Member verified in channel members list")
    
    def test_add_member_already_exists(self, auth_setup):
        """POST /api/channels/{id}/members - adding existing member returns success"""
        # First add
        requests.post(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"user_id": auth_setup["other_user_id"]}
        )
        
        # Second add (should still succeed)
        response = requests.post(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"user_id": auth_setup["other_user_id"]}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "already" in data.get("message", "").lower() or data.get("success") == True
        print(f"✓ Adding existing member returns success with appropriate message")
    
    def test_remove_member_from_channel(self, auth_setup):
        """DELETE /api/channels/{id}/members/{user_id} - remove member from channel"""
        # First add the member
        requests.post(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"user_id": auth_setup["other_user_id"]}
        )
        
        # Now remove
        response = requests.delete(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members/{auth_setup['other_user_id']}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Remove member failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print(f"✓ DELETE /api/channels/{{id}}/members/{{user_id}} - remove member works")
        
        # Verify member was removed
        members_response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        members_data = members_response.json()
        member_ids = [m["id"] for m in members_data["members"]]
        assert auth_setup["other_user_id"] not in member_ids, "Removed user should not be in members"
        print(f"✓ Member verified removed from channel members list")
    
    def test_cannot_remove_creator(self, auth_setup):
        """DELETE /api/channels/{id}/members/{user_id} - cannot remove channel creator"""
        # Add other user first
        requests.post(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"user_id": auth_setup["other_user_id"]}
        )
        
        # Try to remove creator (should fail)
        response = requests.delete(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members/{auth_setup['user_id']}",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "creator" in data.get("detail", "").lower(), "Error should mention creator"
        print(f"✓ Cannot remove channel creator - returns 400")
    
    def test_get_channel_members(self, auth_setup):
        """GET /api/channels/{id}/members - list channel members with created_by"""
        # Add another member
        requests.post(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={"user_id": auth_setup["other_user_id"]}
        )
        
        response = requests.get(
            f"{BASE_URL}/api/channels/{auth_setup['channel_id']}/members",
            headers={"Authorization": f"Bearer {auth_setup['token']}"}
        )
        
        assert response.status_code == 200, f"Get members failed: {response.text}"
        data = response.json()
        
        assert "members" in data, "Response should include members"
        assert "created_by" in data, "Response should include created_by"
        assert len(data["members"]) >= 2, "Should have at least 2 members"
        assert data["created_by"] == auth_setup["user_id"], "created_by should match creator"
        
        # Verify member structure
        for member in data["members"]:
            assert "id" in member, "Member should have id"
            assert "username" in member, "Member should have username"
            assert "email" in member, "Member should have email"
        
        print(f"✓ GET /api/channels/{{id}}/members - returns members with created_by")


class TestDMChannelRestrictions:
    """DM channel restrictions - cannot add/remove members"""
    
    @pytest.fixture
    def dm_setup(self):
        """Create two users and a DM channel between them"""
        # Create first user
        user1_email = f"{TEST_PREFIX}dm1_{uuid.uuid4().hex[:8]}@chat.com"
        user1_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": user1_email,
            "username": f"{TEST_PREFIX}DMUser1_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if user1_response.status_code != 200:
            pytest.skip("Could not register user1")
        
        user1_token = user1_response.json()["access_token"]
        user1_id = user1_response.json()["user"]["id"]
        
        # Create second user
        user2_email = f"{TEST_PREFIX}dm2_{uuid.uuid4().hex[:8]}@chat.com"
        user2_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": user2_email,
            "username": f"{TEST_PREFIX}DMUser2_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if user2_response.status_code != 200:
            pytest.skip("Could not register user2")
        
        user2_id = user2_response.json()["user"]["id"]
        
        # Create third user to try adding
        user3_email = f"{TEST_PREFIX}dm3_{uuid.uuid4().hex[:8]}@chat.com"
        user3_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": user3_email,
            "username": f"{TEST_PREFIX}DMUser3_{uuid.uuid4().hex[:6]}",
            "password": "Test@1234"
        })
        if user3_response.status_code != 200:
            pytest.skip("Could not register user3")
        
        user3_id = user3_response.json()["user"]["id"]
        
        # Create DM channel
        dm_response = requests.post(f"{BASE_URL}/api/channels",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={
                "name": f"DM_{uuid.uuid4().hex[:6]}",
                "is_dm": True,
                "members": [user1_id, user2_id]
            }
        )
        if dm_response.status_code != 200:
            pytest.skip("Could not create DM channel")
        
        dm_channel = dm_response.json()
        return {
            "token": user1_token,
            "dm_channel_id": dm_channel["id"],
            "user1_id": user1_id,
            "user2_id": user2_id,
            "user3_id": user3_id
        }
    
    def test_cannot_add_member_to_dm(self, dm_setup):
        """POST /api/channels/{id}/members - cannot add member to DM channel"""
        response = requests.post(
            f"{BASE_URL}/api/channels/{dm_setup['dm_channel_id']}/members",
            headers={"Authorization": f"Bearer {dm_setup['token']}"},
            json={"user_id": dm_setup["user3_id"]}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "dm" in data.get("detail", "").lower(), "Error should mention DM"
        print(f"✓ Cannot add member to DM channel - returns 400")
    
    def test_cannot_remove_member_from_dm(self, dm_setup):
        """DELETE /api/channels/{id}/members/{user_id} - cannot remove member from DM"""
        response = requests.delete(
            f"{BASE_URL}/api/channels/{dm_setup['dm_channel_id']}/members/{dm_setup['user2_id']}",
            headers={"Authorization": f"Bearer {dm_setup['token']}"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "dm" in data.get("detail", "").lower(), "Error should mention DM"
        print(f"✓ Cannot remove member from DM channel - returns 400")
    
    def test_cannot_edit_dm_channel(self, dm_setup):
        """PUT /api/channels/{id} - cannot edit DM channel"""
        response = requests.put(
            f"{BASE_URL}/api/channels/{dm_setup['dm_channel_id']}",
            headers={"Authorization": f"Bearer {dm_setup['token']}"},
            json={"name": "New DM Name"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "dm" in data.get("detail", "").lower(), "Error should mention DM"
        print(f"✓ Cannot edit DM channel - returns 400")


class TestMarkdownSanitization:
    """Test that markdown content is properly handled (not over-sanitized)"""
    
    @pytest.fixture
    def auth_setup(self):
        """Get auth token and channel"""
        unique_email = f"{TEST_PREFIX}md_{uuid.uuid4().hex[:8]}@chat.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "username": f"{TEST_PREFIX}MDUser_{uuid.uuid4().hex[:6]}",
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
    
    def test_markdown_bold_preserved(self, auth_setup):
        """POST /api/messages - markdown bold syntax preserved"""
        content = "This is **bold** text"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert "**bold**" in data["content"], f"Bold markdown should be preserved: {data['content']}"
        print(f"✓ Markdown bold syntax preserved")
    
    def test_markdown_italic_preserved(self, auth_setup):
        """POST /api/messages - markdown italic syntax preserved"""
        content = "This is *italic* text"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert "*italic*" in data["content"], f"Italic markdown should be preserved: {data['content']}"
        print(f"✓ Markdown italic syntax preserved")
    
    def test_markdown_code_block_preserved(self, auth_setup):
        """POST /api/messages - markdown code block syntax preserved"""
        content = "```python\nprint('hello')\n```"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert "```python" in data["content"], f"Code block should be preserved: {data['content']}"
        print(f"✓ Markdown code block syntax preserved")
    
    def test_markdown_inline_code_preserved(self, auth_setup):
        """POST /api/messages - markdown inline code syntax preserved"""
        content = "Use `const x = 1` for variables"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert "`const x = 1`" in data["content"], f"Inline code should be preserved: {data['content']}"
        print(f"✓ Markdown inline code syntax preserved")
    
    def test_markdown_link_preserved(self, auth_setup):
        """POST /api/messages - markdown link syntax preserved"""
        content = "Check out [Google](https://google.com)"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert "[Google]" in data["content"], f"Link text should be preserved: {data['content']}"
        assert "https://google.com" in data["content"], f"Link URL should be preserved: {data['content']}"
        print(f"✓ Markdown link syntax preserved")
    
    def test_html_tags_escaped(self, auth_setup):
        """POST /api/messages - HTML tags should be escaped for XSS prevention"""
        content = "<script>alert('xss')</script>"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert "<script>" not in data["content"], "Script tags should be escaped"
        assert "&lt;script&gt;" in data["content"], f"HTML should be escaped: {data['content']}"
        print(f"✓ HTML tags properly escaped for XSS prevention")
    
    def test_markdown_list_preserved(self, auth_setup):
        """POST /api/messages - markdown list syntax preserved"""
        content = "- Item 1\n- Item 2\n- Item 3"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert "- Item 1" in data["content"], f"List should be preserved: {data['content']}"
        print(f"✓ Markdown list syntax preserved")
    
    def test_markdown_blockquote_preserved(self, auth_setup):
        """POST /api/messages - markdown blockquote syntax preserved"""
        content = "> This is a quote"
        response = requests.post(f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {auth_setup['token']}"},
            json={
                "channel_id": auth_setup["channel_id"],
                "content": content
            }
        )
        
        assert response.status_code == 200, f"Create message failed: {response.text}"
        data = response.json()
        
        assert "> This is a quote" in data["content"], f"Blockquote should be preserved: {data['content']}"
        print(f"✓ Markdown blockquote syntax preserved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
