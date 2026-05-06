import { Injectable } from '@angular/core';
import {
  AuthenticationResult,
  IPublicClientApplication,
  InteractionRequiredAuthError,
  PublicClientApplication,
} from '@azure/msal-browser';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { msalConfig } from '../config/msal.config';
import { authConfig } from '../config/msal.config';

interface AuthState {
  isAuthenticated: boolean;
  user: any;
  authCode: string | null;
  token: string | null;
  error: string | null;
}

/**
 * Microsoft Authentication Service
 * Handles MSAL initialization, login flow with PKCE, and auth code retrieval
 */
@Injectable({
  providedIn: 'root',
})
export class MicrosoftAuthService {
  private msalInstance: IPublicClientApplication | null = null;
  private initializationPromise: Promise<void>;
  private interactionInProgress = false;

  private destroy$ = new Subject<void>();
  private authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    authCode: null,
    token: null,
    error: null,
  });

  public authState: Observable<AuthState> = this.authState$.asObservable();
  public isAuthenticated$ = this.authState$.pipe(map(state => state.isAuthenticated));
  public user$ = this.authState$.pipe(map(state => state.user));
  public authCode$ = this.authState$.pipe(map(state => state.authCode));
  public token$ = this.authState$.pipe(map(state => state.token));

  constructor() {
    this.initializationPromise = this.initializeMsalInstance();
  }

  private async ensureMsalReady(): Promise<IPublicClientApplication> {
    await this.initializationPromise;
    if (!this.msalInstance) {
      throw new Error('MSAL instance is not initialized');
    }
    return this.msalInstance;
  }

  /**
   * Initialize MSAL instance
   */
  private async initializeMsalInstance(): Promise<void> {
    try {
      console.log('Initializing MSAL instance...');

      // Create MSAL instance
      this.msalInstance = new PublicClientApplication(msalConfig);

      // Call initialize explicitly to ensure it's ready
      await this.msalInstance.initialize();

      // Must always be processed on startup to clear pending interactions.
      const redirectResult = await this.msalInstance.handleRedirectPromise();
      if (redirectResult) {
        this.handleLoginSuccess(redirectResult);
      }

      console.log('MSAL initialized successfully');

      // Set initial display state
      this.setLoginDisplay();
    } catch (error) {
      console.error('Failed to initialize MSAL:', error);
      this.authState$.next({
        ...this.authState$.value,
        error: 'Failed to initialize authentication service',
      });
    }
  }

  /**
   * Update login display based on accounts
   */
  private setLoginDisplay(): void {
    if (!this.msalInstance) {
      console.warn('MSAL instance not available for setLoginDisplay');
      return;
    }

    try {
      const accounts = this.msalInstance.getAllAccounts();
      const isAuthenticated = accounts.length > 0;

      if (isAuthenticated) {
        const user = accounts[0];
        this.authState$.next({
          ...this.authState$.value,
          isAuthenticated: true,
          user,
        });
      }
    } catch (error) {
      console.error('Error getting accounts:', error);
    }
  }

  /**
   * Initiate Microsoft login with PKCE flow
   * This will redirect to Microsoft login page
   */
  public login(): void {
    void this.startPopupLogin();
  }

  private async startPopupLogin(): Promise<void> {
    if (this.interactionInProgress) {
      this.authState$.next({
        ...this.authState$.value,
        error: 'Login already in progress. Please complete the Microsoft window.',
      });
      return;
    }

    try {
      const msal = await this.ensureMsalReady();
      this.interactionInProgress = true;

      const result = await msal.loginPopup({
        scopes: ['openid', 'profile', 'email'],
        prompt: 'select_account',
        redirectUri: authConfig.redirectUri,
      });

      this.handleLoginSuccess(result);
    } catch (error) {
      this.handleLoginError(error);
    } finally {
      this.interactionInProgress = false;
    }
  }

  /**
   * Initiate Microsoft login with redirect
   * This is useful if popup is blocked
   */
  public loginWithRedirect(): void {
    void this.startRedirectLogin();
  }

  private async startRedirectLogin(): Promise<void> {
    if (this.interactionInProgress) {
      this.authState$.next({
        ...this.authState$.value,
        error: 'Login already in progress. Please wait.',
      });
      return;
    }

    try {
      const msal = await this.ensureMsalReady();
      this.interactionInProgress = true;

      const loginRequest = {
        scopes: ['openid', 'profile', 'email'],
        prompt: 'select_account' as const,
        redirectUri: authConfig.redirectUri,
      };

      await msal.loginRedirect(loginRequest);
    } catch (error) {
      this.handleLoginError(error);
      this.interactionInProgress = false;
    }
  }

  /**
   * Handle successful login
   */
  private handleLoginSuccess(result: AuthenticationResult): void {
    if (!this.msalInstance) {
      console.error('MSAL instance not available for handleLoginSuccess');
      return;
    }

    try {
      const accounts = this.msalInstance.getAllAccounts();
      const user = accounts[0];

      this.authState$.next({
        ...this.authState$.value,
        isAuthenticated: true,
        user,
        error: null,
      });
    } catch (error) {
      console.error('Error handling login success:', error);
    }
  }

  /**
   * Handle login errors
   */
  private handleLoginError(error: any): void {
    console.error('Login error:', error);

    if (error?.errorCode === 'interaction_in_progress') {
      this.authState$.next({
        ...this.authState$.value,
        error: 'Login is already in progress. Finish the existing Microsoft sign-in window and try again.',
      });
      return;
    }

    // Check if interaction is required
    if (error instanceof InteractionRequiredAuthError) {
      // Try silent flow first
      this.acquireTokenSilent().catch(() => {
        // Do not auto-trigger another interactive login here; user action should start it.
      });
    }

    this.authState$.next({
      ...this.authState$.value,
      error: error.errorCode || 'Authentication failed',
    });
  }

  /**
   * Acquire token silently (uses refresh token)
   */
  public acquireTokenSilent(): Promise<AuthenticationResult> {
    if (!this.msalInstance) {
      return Promise.reject('MSAL instance not available');
    }

    try {
      const accounts = this.msalInstance.getAllAccounts();

      if (accounts.length === 0) {
        return Promise.reject('No accounts found');
      }

      const silentRequest = {
        scopes: ['openid', 'profile', 'email'],
        account: accounts[0],
      };

      return this.msalInstance.acquireTokenSilent(silentRequest);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Get the current authenticated user
   */
  public getUser(): any {
    return this.authState$.value.user;
  }

  /**
   * Get current auth state
   */
  public getAuthState(): AuthState {
    return this.authState$.value;
  }

  /**
   * Set token after backend exchange
   */
  public setToken(token: string): void {
    this.authState$.next({
      ...this.authState$.value,
      token,
    });
  }

  /**
   * Logout user
   */
  public logout(): void {
    try {
      if (!this.msalInstance) {
        console.warn('MSAL instance not available for logout');
        this.authState$.next({
          isAuthenticated: false,
          user: null,
          authCode: null,
          token: null,
          error: null,
        });
        return;
      }

      const logoutRequest = {
        postLogoutRedirectUri: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200'}/auth`,
      };

      this.msalInstance.logoutPopup(logoutRequest).catch(() => {
        // Fallback to redirect logout if popup fails
        if (this.msalInstance) {
          this.msalInstance.logoutRedirect();
        }
      });

      this.authState$.next({
        isAuthenticated: false,
        user: null,
        authCode: null,
        token: null,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    if (!this.msalInstance) {
      return false;
    }
    try {
      return this.msalInstance.getAllAccounts().length > 0;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Get access token for API calls
   */
  public getAccessToken(): Promise<string> {
    const storedToken = this.authState$.value.token;
    if (storedToken) {
      return Promise.resolve(storedToken);
    }

    return this.acquireTokenSilent()
      .then((result) => result.accessToken)
      .catch(() => {
        // If silent acquisition fails, try login
        return new Promise<string>((resolve) => {
          this.login();
          resolve('');
        });
      });
  }

  /**
   * Cleanup
   */
  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
