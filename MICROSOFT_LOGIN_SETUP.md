# Microsoft Login Implementation Guide

## Overview

This implementation adds Microsoft Azure AD authentication to your Angular application using MSAL (Microsoft Authentication Library) with a backend-driven PKCE flow. The authentication process works as follows:

1. User clicks "Sign in with Microsoft"
2. MSAL opens Microsoft login page
3. User authenticates and consents to permissions
4. Microsoft redirects to your app with an authorization code
5. Your Angular app sends the code to your backend
6. Backend exchanges the code for an access token using its client secret
7. Backend returns the token to the Angular app
8. Angular app stores the token and navigates to dashboard

## Files Created/Modified

### New Files Created:

1. **`src/app/config/msal.config.ts`**
   - MSAL configuration with placeholders
   - Auth configuration exports for services

2. **`src/app/services/microsoft-auth.service.ts`**
   - Manages MSAL initialization and login flow
   - Handles authentication state
   - Provides methods for login, logout, and token management

3. **`src/app/services/token-exchange.service.ts`**
   - Exchanges auth code with backend for access token
   - Implements PKCE security (code verifier/challenge)
   - Handles token refresh and storage

4. **`src/app/auth/auth-callback.component.ts`**
   - Handles Microsoft redirect callback
   - Processes auth code and initiates token exchange
   - Displays loading/success/error states

### Modified Files:

1. **`src/app/app.config.ts`**
   - Added MSAL providers configuration
   - Added HTTP client provider

2. **`src/app/auth/auth.ts`**
   - Injected `MicrosoftAuthService` and `TokenExchangeService`
   - Added `loginWithMicrosoft()` method
   - Added `login WithMicrosoftRedirect()` method
   - Added `exchangeAuthCodeForToken()` method
   - Added `isMicrosoftLoggingIn` signal for UI state

3. **`src/app/auth/auth.html`**
   - Added Microsoft login button in online mode
   - Added fallback redirect login option
   - Integrated with existing UI

4. **`src/app/auth/auth.scss`**
   - Added Microsoft button styles
   - Added fallback link styles

5. **`src/app/app.routes.ts`**
   - Added `/auth-callback` route for OAuth redirect
   - Added `/auth` route for auth component

## Configuration Steps

### 1. Azure App Registration Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Enter app name: `OfflineAuth`
5. Select "Single-page application (SPA)" platform
6. Add redirect URI: `http://localhost:4200/auth-callback` (for development)
7. Note your **Application (client) ID** - needed for `msal.config.ts`

### 2. Update MSAL Configuration

In `src/app/config/msal.config.ts`, update:

```typescript
// Line 13: Replace with your Azure App Registration Client ID
const CLIENT_ID = 'YOUR_CLIENT_ID_FROM_AZURE_PORTAL';

// Line 16: Replace with your backend URL
const BACKEND_URL = 'http://localhost:3000'; // or your production backend
```

Also update the redirect URI if needed:

```typescript
// Line 19: Adjust for your environment
const REDIRECT_URI = `http://localhost:4200/auth-callback`;
```

### 3. Backend Implementation

Your backend needs the following endpoint:

**Endpoint:** `POST /api/auth/exchange-code`

**Request Body:**
```javascript
{
  "authCode": "M.C123...",           // Auth code from Microsoft
  "redirectUri": "http://...",         // Same redirect URI used in MSAL config
  "clientId": "YOUR_CLIENT_ID",        // Your Azure app client ID
  "codeVerifier": "abc123..."          // PKCE code verifier (optional but recommended)
}
```

**Response (Success - 200):**
```javascript
{
  "accessToken": "eyJhbGc...",
  "idToken": "eyJ...",                 // Optional
  "refreshToken": "0.AQs...",          // Optional - for token refresh
  "expiresIn": 3600,                   // Token expiration in seconds
  "user": {                            // Optional - user info
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

**Response (Error - 400):**
```javascript
{
  "message": "Token exchange failed: invalid_grant"
}
```

### Backend Code Example (Node.js with Express):

```typescript
import axios from 'axios';

app.post('/api/auth/exchange-code', async (req, res) => {
  try {
    const { authCode, redirectUri, codeVerifier } = req.body;

    // Exchange code for token using Microsoft Graph API
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET, // Keep this secret!
        code: authCode,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier, // For PKCE
      }
    );

    const { access_token, id_token, refresh_token, expires_in } = response.data;

    // Optionally fetch user info from Microsoft Graph
    const userInfo = await axios.get(
      'https://graph.microsoft.com/v1.0/me',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    return res.json({
      accessToken: access_token,
      idToken: id_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      user: {
        id: userInfo.data.id,
        email: userInfo.data.userPrincipalName,
        name: userInfo.data.displayName,
      },
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(400).json({
      message: error.response?.data?.error_description || 'Token exchange failed',
    });
  }
});

// Optional: Token refresh endpoint
app.post('/api/auth/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }
    );

    return res.json({
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Token refresh failed',
    });
  }
});
```

## How to Use

### For Development:

1. Start your Angular app:
   ```bash
   npm start
   ```

2. Start your backend app (on port 3000 or update `BACKEND_URL`)

3. Navigate to `http://localhost:4200`

4. Click "Sign in with Microsoft"

5. Authenticate with your Microsoft account

6. You'll be redirected to `/auth-callback` which exchanges the code

7. On success, you'll be redirected to `/dashboard`

### Token Usage:

After successful authentication, the token is stored in `sessionStorage`:

```typescript
// Get the stored token
const token = sessionStorage.getItem('access_token');

// Use in HTTP requests
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Logout:

```typescript
// Call logout on the Microsoft auth service
const microsoftAuth = inject(MicrosoftAuthService);
microsoftAuth.logout();
```

## PKCE Security

This implementation includes PKCE (Proof Key for Code Exchange) for enhanced security:

- **Code Verifier**: Random 128-character string generated by the frontend
- **Code Challenge**: SHA256 hash of the verifier (Base64 URL encoded)
- Backend must validate the code verifier when exchanging the code

The `TokenExchangeService` handles PKCE generation automatically.

## Next Steps

1. ✅ Configure Azure App Registration
2. ✅ Update `msal.config.ts` with your Client ID and Backend URL
3. ✅ Implement backend token exchange endpoint
4. ✅ Test the flow in development
5. For production:
   - Add refresh token rotation
   - Implement token expiration handling
   - Add secure HTTP-only cookie storage for tokens
   - Configure production redirect URIs in Azure Portal
   - Enable additional security features (MFA, conditional access, etc.)

## Troubleshooting

### "Popup blocked" Error:
- User has popup blocker enabled
- Use the "Use Redirect" button as fallback
- Ensure redirect URI is registered in Azure

### "Invalid redirect_uri" Error:
- Redirect URI in Azure Portal doesn't match `REDIRECT_URI` in config
- Check both must be exactly the same (including http/https and port)

### "Token exchange failed" Error:
- Backend endpoint not reachable
- Check `BACKEND_URL` in config
- Check backend has proper CORS configuration
- Verify backend is implementing the token exchange endpoint correctly

### "No users found" in MSAL:
- Clear browser storage: `localStorage.clear()` and `sessionStorage.clear()`
- Try login again

## Environment Variables (Recommended for Production)

Create a `.env` file in your project root:

```
NG_APP_CLIENT_ID=your_azure_client_id
NG_APP_BACKEND_URL=https://your-backend.com
NG_APP_REDIRECT_URI=https://your-frontend.com/auth-callback
```

Then update `msal.config.ts` to use:

```typescript
const CLIENT_ID = import.meta.env.NG_APP_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
```

## Security Best Practices

1. **Never expose Client Secret**: Keep it only on the backend
2. **Use HTTPS in Production**: Required by MSAL
3. **Validate Tokens**: Verify JWT signature on the backend
4. **Implement Refresh Token Rotation**: Issue new refresh token on exchange
5. **Set Token Expiration**: Implement proper token lifetime
6. **Secure Token Storage**: Consider HTTP-only cookies instead of sessionStorage
7. **CORS Configuration**: Restrict to your domain only

## Additional Resources

- [Microsoft Authentication Library (MSAL) for Angular](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Azure AD OAuth 2.0 Authorization Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [Azure App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
