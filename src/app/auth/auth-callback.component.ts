import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MicrosoftAuthService } from '../services/microsoft-auth.service';
import { TokenExchangeService } from '../services/token-exchange.service';

/**
 * Auth Callback Component
 * Handles the redirect from Microsoft and exchanges auth code for token
 * This component is displayed when Microsoft redirects back to your app
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-callback-shell">
      <div class="callback-card">
        <div class="status">
          @if (isProcessing()) {
            <div class="processing">
              <div class="spinner"></div>
              <h2>Signing you in...</h2>
              <p>Please wait while we authenticate with Microsoft and exchange the auth code.</p>
            </div>
          }

          @if (error(); as errorMsg) {
            <div class="error">
              <h2>Authentication Error</h2>
              <p>{{ errorMsg }}</p>
              <button (click)="goBack()" class="primary-button">
                Go Back to Login
              </button>
            </div>
          }

          @if (success()) {
            <div class="success">
              <h2>Success!</h2>
              <p>You have been authenticated. Redirecting to dashboard...</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-callback-shell {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .callback-card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
      max-width: 500px;
    }

    .processing {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid #f3f3f3;
      border-top: 5px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error, .success {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    h2 {
      margin: 0;
      color: #333;
    }

    p {
      margin: 0;
      color: #666;
    }

    .primary-button {
      padding: 10px 20px;
      background-color: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1em;
      font-weight: 500;
    }

    .primary-button:hover {
      background-color: #5568d3;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackComponent implements OnInit {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private microsoftAuth = inject(MicrosoftAuthService);
  private tokenExchange = inject(TokenExchangeService);

  public isProcessing = signal(true);
  public error = signal<string | null>(null);
  public success = signal(false);

  ngOnInit(): void {
    this.handleCallback();
  }

  /**
   * Handle the callback from Microsoft
   * Check for auth code in URL and exchange it with backend
   */
  private handleCallback(): void {
    this.activatedRoute.queryParams.subscribe((params) => {
      const code = params['code'];
      const error = params['error'];
      const errorDescription = params['error_description'];

      if (error) {
        // Microsoft returned an error
        this.isProcessing.set(false);
        this.error.set(
          errorDescription || error || 'Authentication failed. Please try again.'
        );
        return;
      }

      if (code) {
        // We have an auth code, exchange it with the backend
        this.exchangeCodeWithBackend(code);
      } else {
        // No code and no error - something went wrong
        this.isProcessing.set(false);
        this.error.set(
          'No authentication code received. Please try signing in again.'
        );
      }
    });
  }

  /**
   * Exchange the auth code with backend for access token
   */
  private async exchangeCodeWithBackend(authCode: string): Promise<void> {
    try {
      // Generate PKCE code verifier for enhanced security
      const { codeVerifier } = await this.tokenExchange.generatePKCE();

      // Exchange with backend
      this.tokenExchange.exchangeAuthCode(authCode, codeVerifier).subscribe({
        next: (response) => {
          // Success! Store the token and user info
          this.tokenExchange.storeToken(response.accessToken);
          this.microsoftAuth.setToken(response.accessToken);

          if (response.user) {
            sessionStorage.setItem('user', JSON.stringify(response.user));
          }

          // Mark as success and redirect
          this.success.set(true);
          this.isProcessing.set(false);

          // Redirect to dashboard after a short delay
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1500);
        },
        error: (err) => {
          // Token exchange failed
          this.isProcessing.set(false);
          this.error.set(
            err.error?.message ||
            'Failed to exchange authentication code. Please try again.'
          );
        },
      });
    } catch (error) {
      this.isProcessing.set(false);
      this.error.set(`Authentication error: ${error}`);
    }
  }

  /**
   * Go back to login
   */
  public goBack(): void {
    this.router.navigate(['/auth']);
  }
}
