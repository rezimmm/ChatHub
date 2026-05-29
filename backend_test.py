import requests
import sys
import json
from datetime import datetime

class ChatAppAPITester:
    def __init__(self, base_url="https://realtime-team-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.token1 = None
        self.token2 = None
        self.user1 = None
        self.user2 = None
        self.tests_run = 0
        self.tests_passed = 0
        self.channel_id = None
        self.dm_channel_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error details: {error_detail}")
                except:
                    print(f"   Response text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_register_user1(self):
        """Test user registration for first user"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Register User 1",
            "POST",
            "api/auth/register",
            200,
            data={
                "email": f"test1_{timestamp}@example.com",
                "username": f"TestUser1_{timestamp}",
                "password": "password123"
            }
        )
        if success and 'access_token' in response:
            self.token1 = response['access_token']
            self.user1 = response['user']
            print(f"   User 1 ID: {self.user1['id']}")
            return True
        return False

    def test_register_user2(self):
        """Test user registration for second user"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Register User 2",
            "POST",
            "api/auth/register",
            200,
            data={
                "email": f"test2_{timestamp}@example.com",
                "username": f"TestUser2_{timestamp}",
                "password": "password123"
            }
        )
        if success and 'access_token' in response:
            self.token2 = response['access_token']
            self.user2 = response['user']
            print(f"   User 2 ID: {self.user2['id']}")
            return True
        return False

    def test_login_user1(self):
        """Test login with user1 credentials"""
        if not self.user1:
            return False
        
        success, response = self.run_test(
            "Login User 1",
            "POST",
            "api/auth/login",
            200,
            data={
                "email": self.user1['email'],
                "password": "password123"
            }
        )
        if success and 'access_token' in response:
            print(f"   Login successful for {self.user1['username']}")
            return True
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Invalid Login",
            "POST",
            "api/auth/login",
            401,
            data={
                "email": "invalid@example.com",
                "password": "wrongpassword"
            }
        )
        return success

    def test_get_current_user(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "api/users/me",
            200,
            token=self.token1
        )
        if success and response.get('id') == self.user1['id']:
            print(f"   Current user: {response['username']}")
            return True
        return False

    def test_get_all_users(self):
        """Test getting all users"""
        success, response = self.run_test(
            "Get All Users",
            "GET",
            "api/users",
            200,
            token=self.token1
        )
        if success and isinstance(response, list) and len(response) >= 2:
            print(f"   Found {len(response)} users")
            return True
        return False

    def test_get_channels(self):
        """Test getting user channels"""
        success, response = self.run_test(
            "Get Channels",
            "GET",
            "api/channels",
            200,
            token=self.token1
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} channels")
            # Should have at least the general channel
            general_channel = next((ch for ch in response if ch['name'] == 'general'), None)
            if general_channel:
                self.channel_id = general_channel['id']
                print(f"   General channel ID: {self.channel_id}")
                return True
        return False

    def test_create_channel(self):
        """Test creating a new channel"""
        success, response = self.run_test(
            "Create Channel",
            "POST",
            "api/channels",
            200,
            data={
                "name": "project-alpha",
                "description": "Project discussions",
                "is_dm": False,
                "members": [self.user1['id'], self.user2['id']]
            },
            token=self.token1
        )
        if success and response.get('name') == 'project-alpha':
            print(f"   Created channel ID: {response['id']}")
            return True
        return False

    def test_send_message(self):
        """Test sending a message to general channel"""
        if not self.channel_id:
            return False
            
        success, response = self.run_test(
            "Send Message",
            "POST",
            "api/messages",
            200,
            data={
                "channel_id": self.channel_id,
                "content": "Hello from backend test!"
            },
            token=self.token1
        )
        if success and response.get('content') == "Hello from backend test!":
            print(f"   Message ID: {response['id']}")
            return True
        return False

    def test_get_messages(self):
        """Test getting messages from general channel"""
        if not self.channel_id:
            return False
            
        success, response = self.run_test(
            "Get Messages",
            "GET",
            f"api/channels/{self.channel_id}/messages",
            200,
            token=self.token1
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} messages")
            return True
        return False

    def test_create_dm_channel(self):
        """Test creating a direct message channel"""
        success, response = self.run_test(
            "Create DM Channel",
            "POST",
            "api/channels",
            200,
            data={
                "name": f"{self.user1['username']}, {self.user2['username']}",
                "description": "",
                "is_dm": True,
                "members": [self.user1['id'], self.user2['id']]
            },
            token=self.token1
        )
        if success and response.get('is_dm') == True:
            self.dm_channel_id = response['id']
            print(f"   DM Channel ID: {self.dm_channel_id}")
            return True
        return False

    def test_send_dm_message(self):
        """Test sending a direct message"""
        if not self.dm_channel_id:
            return False
            
        success, response = self.run_test(
            "Send DM Message",
            "POST",
            "api/messages",
            200,
            data={
                "channel_id": self.dm_channel_id,
                "content": "Hello in DM!"
            },
            token=self.token1
        )
        if success and response.get('content') == "Hello in DM!":
            print(f"   DM Message ID: {response['id']}")
            return True
        return False

def main():
    print("🚀 Starting Chat App API Tests")
    print("=" * 50)
    
    tester = ChatAppAPITester()
    
    # Test sequence
    tests = [
        ("Register User 1", tester.test_register_user1),
        ("Register User 2", tester.test_register_user2),
        ("Login User 1", tester.test_login_user1),
        ("Invalid Login", tester.test_invalid_login),
        ("Get Current User", tester.test_get_current_user),
        ("Get All Users", tester.test_get_all_users),
        ("Get Channels", tester.test_get_channels),
        ("Create Channel", tester.test_create_channel),
        ("Send Message", tester.test_send_message),
        ("Get Messages", tester.test_get_messages),
        ("Create DM Channel", tester.test_create_dm_channel),
        ("Send DM Message", tester.test_send_dm_message),
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                print(f"⚠️  {test_name} failed - continuing with remaining tests")
        except Exception as e:
            print(f"💥 {test_name} crashed: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All API tests passed!")
        return 0
    else:
        failed = tester.tests_run - tester.tests_passed
        print(f"❌ {failed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())