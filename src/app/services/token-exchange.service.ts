import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { authConfig } from '../config/msal.config';

interface TokenExchangeRequest {
  authCode: string;
  redirectUri: string;
  clientId: string;
  codeVerifier?: string; // For PKCE flow
}

interface TokenExchangeResponse {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

interface ExchangeState {
  isLoading: boolean;
  success: boolean;
  error: string | null;
  token: string | null;
}

/**
 * Token Exchange Service
 * Handles exchanging the auth code from Microsoft with backend for access token
 * Uses PKCE flow for enhanced security
 */
@Injectable({
  providedIn: 'root',
})
export class TokenExchangeService {
  private http = inject(HttpClient);

  // TODO: Replace with your actual backend auth endpoint
  private readonly AUTH_EXCHANGE_ENDPOINT = `${authConfig.backendUrl}/api/auth/exchange-code`;

  private exchangeState$ = new BehaviorSubject<ExchangeState>({
    isLoading: false,
    success: false,
    error: null,
    token: null,
  });

  public exchangeState: Observable<ExchangeState> = this.exchangeState$.asObservable();

  /**
   * Generate PKCE code challenge and verifier
   * PKCE adds extra security to the authorization code flow
   * Note: Challenge generation is async for Web Crypto API
   */
  public async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    // Generate random code verifier (43-128 characters)
    const codeVerifier = this.generateRandomString(128);

    // Generate code challenge from verifier
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate random string for PKCE
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }

    return result;
  }

  /**
   * Generate code challenge from verifier using SHA256
   * Uses Web Crypto API for hashing
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    // Use Web Crypto API to hash the verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to base64url
    return this.base64UrlEncode(new Uint8Array(hashBuffer));
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Exchange authorization code with backend for access token
   * @param authCode - Authorization code from Microsoft
   * @param codeVerifier - PKCE code verifier (optional)
   */
  public exchangeAuthCode(authCode: string, codeVerifier?: string): Observable<TokenExchangeResponse> {
    this.setLoading(true);

    const request: TokenExchangeRequest = {
      authCode,
      redirectUri: authConfig.redirectUri,
      clientId: authConfig.clientId,
      codeVerifier,
    };

    return this.http.post<TokenExchangeResponse>(
      this.AUTH_EXCHANGE_ENDPOINT,
      request
    ).pipe(
      tap((response) => {
        this.setLoading(false);
        this.setSuccess(true);
        this.setToken(response.accessToken);
        this.setError(null);
      }),
      catchError((error) => {
        this.setLoading(false);
        this.setSuccess(false);
        this.setError(error.error?.message || error.statusText || 'Token exchange failed');
        console.error('Token exchange error:', error);
        throw error;
      })
    );
  }

  /**
   * Refresh token using refresh token
   * @param refreshToken - Refresh token from previous exchange
   */
  public refreshAccessToken(refreshToken: string): Observable<TokenExchangeResponse> {
    this.setLoading(true);

    return this.http.post<TokenExchangeResponse>(
      `${authConfig.backendUrl}/api/auth/refresh-token`,
      { refreshToken }
    ).pipe(
      tap((response) => {
        this.setLoading(false);
        this.setToken(response.accessToken);
        this.setError(null);
      }),
      catchError((error) => {
        this.setLoading(false);
        this.setError(error.error?.message || 'Token refresh failed');
        throw error;
      })
    );
  }

  /**
   * Get current exchange state
   */
  public getExchangeState(): ExchangeState {
    return this.exchangeState$.value;
  }

  /**
   * Set loading state
   */
  private setLoading(isLoading: boolean): void {
    this.exchangeState$.next({
      ...this.exchangeState$.value,
      isLoading,
    });
  }

  /**
   * Set token
   */
  private setToken(token: string): void {
    this.exchangeState$.next({
      ...this.exchangeState$.value,
      token,
    });
  }

  /**
   * Set success
   */
  private setSuccess(success: boolean): void {
    this.exchangeState$.next({
      ...this.exchangeState$.value,
      success,
    });
  }

  /**
   * Set error
   */
  private setError(error: string | null): void {
    this.exchangeState$.next({
      ...this.exchangeState$.value,
      error,
    });
  }

  /**
   * Store token securely
   */
  public storeToken(token: string): void {
    // Store in sessionStorage for this session only
    sessionStorage.setItem('access_token', token);
  }

  /**
   * Retrieve stored token
   */
  public getStoredToken(): string | null {
    return sessionStorage.getItem('access_token');
  }

  /**
   * Clear token
   */
  public clearToken(): void {
    sessionStorage.removeItem('access_token');
  }
}
