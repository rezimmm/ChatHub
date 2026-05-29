# Test Credentials

## Test User 1
- Email: testuser1@chat.com
- Password: Test@1234
- Username: TestUser1

## Test User 2 (Production Test)
- Email: prod_test@chat.com
- Password: Secure@123
- Username: ProdTestUser

## Test User 3 (Screenshot Test)
- Email: screenshot2@chat.com
- Password: Test@1234
- Username: ScreenUser2

## Registration Endpoint
- POST /api/auth/register with {"email":"...","username":"...","password":"..."}
- Password must be at least 6 characters
- Username: 2-30 chars, letters/numbers/spaces/hyphens/underscores only

## Login Endpoint
- POST /api/auth/login with {"email":"...","password":"..."}
