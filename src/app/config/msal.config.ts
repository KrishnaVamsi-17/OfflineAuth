import {
  IPublicClientApplication,
  PublicClientApplication,
  BrowserCacheLocation,
  LogLevel,
  InteractionType,
} from '@azure/msal-browser';

/**
 * MSAL Configuration for Microsoft Authentication
 * Update these values with your Azure App Registration details
 */

// TODO: Replace with your actual Azure App Registration Client ID
const CLIENT_ID = 'ab70396c-baa0-4e66-ba37-be8340fc388d';

// TODO: Replace with your backend URL
const BACKEND_URL = 'http://localhost:7184';

// The redirect URI where Microsoft will send the auth code
// Make sure this is registered in your Azure portal
const REDIRECT_URI = 'http://localhost:4200/auth-callback';

// Scopes required for authentication - basic profile scope
const SCOPES = ['openid', 'profile', 'email'];

/**
 * MSAL Browser Configuration
 */
export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200'}/auth`,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage, // Can also use SessionStorage
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string) => {
        if (level === LogLevel.Error) {
          console.error('[MSAL]', message);
        } else if (level === LogLevel.Warning) {
          console.warn('[MSAL]', message);
        }
      },
      piiLoggingEnabled: false,
    },
  },
};

/**
 * MSAL Interceptor Configuration
 */
export const msalInterceptorConfig = {
  interactionType: InteractionType.Redirect,
  authRequest: {
    scopes: SCOPES,
  },
  protectedResourceMap: new Map<string, Array<string>>([
    [BACKEND_URL + '/*', SCOPES],
  ]),
};

/**
 * Factory function to create MSAL PublicClientApplication
 */
export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication(msalConfig);
}

/**
 * Export configuration values for use in services
 */
export const authConfig = {
  clientId: CLIENT_ID,
  redirectUri: REDIRECT_URI,
  backendUrl: BACKEND_URL,
  scopes: SCOPES,
};
