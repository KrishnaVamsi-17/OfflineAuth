import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConnectivityService } from '../services/connectivity.service';
import { DexieService } from '../services/dexie.service';
import { EncryptionService } from '../services/encryption.service';
import { SessionService } from '../services/session.service';
import { TOTPGeneratorService } from '../services/totp-generator.service';
import { TOTPSecret } from '../services/db/models/totp-secret.model';

@Component({
  selector: 'app-auth',
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthComponent {
  protected readonly connectivity = inject(ConnectivityService);
  private readonly dexieService = inject(DexieService);
  private readonly encryptionService = inject(EncryptionService);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly totpGenerator = inject(TOTPGeneratorService);

  public offlineCode = '';
  public offlinePin = '';
  public readonly loading = signal(false);
  public readonly error = signal<string | null>(null);
  public readonly info = signal<string | null>(null);
  public readonly hasOfflineEnrollment = signal(false);
  public readonly hasPinFallback = signal(false);
  public readonly pinHash = signal<string | null>(null);
  public readonly enrolledAccount = signal<TOTPSecret | null>(null);
  public readonly isOnline = this.connectivity.isOnline;
  public readonly isOffline = computed(() => !this.isOnline());
  public readonly offlineMethodLabel = computed(() =>
    this.hasOfflineEnrollment() ? 'TOTP' : this.hasPinFallback() ? 'PIN' : 'Not configured',
  );

  constructor() {
    effect(() => {
      const online = this.isOnline();

      if (online) {
        this.error.set(null);
        this.info.set('Online mode detected. Use Microsoft sign-in, then configure offline TOTP in Settings.');
        return;
      }

      void this.loadOfflineAuthOptions();
    });
  }

  async loadOfflineAuthOptions(): Promise<void> {
    try {
      const [secrets, settings] = await Promise.all([
        this.dexieService.getAllTOTPSecrets(),
        this.dexieService.getSettings(),
      ]);

      const secret = secrets[0] ?? null;
      this.enrolledAccount.set(secret);
      this.hasOfflineEnrollment.set(secret !== null);
      this.hasPinFallback.set(!!settings?.pinHash);
      this.pinHash.set(settings?.pinHash ?? null);

      if (secret) {
        this.info.set('Offline mode detected. Enter a 6-digit authenticator code to continue.');
      } else if (settings?.pinHash) {
        this.info.set('Offline mode detected. No TOTP setup found, so device PIN login is enabled.');
      } else {
        this.info.set('Offline mode detected, but neither TOTP nor PIN is configured on this device.');
      }
    } catch (error) {
      this.error.set(`Failed to load offline setup: ${error}`);
      this.hasOfflineEnrollment.set(false);
      this.hasPinFallback.set(false);
      this.pinHash.set(null);
      this.enrolledAccount.set(null);
    }
  }

  public continueOnline(): void {
    this.router.navigate(['/settings']);
  }

  public async continueOffline(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const secret = this.enrolledAccount();

      if (secret) {
        if (!/^\d{6}$/.test(this.offlineCode.trim())) {
          this.error.set('Enter the current 6-digit authenticator code.');
          return;
        }

        const code = this.offlineCode.trim();
        const alreadyUsed = await this.dexieService.isCodeUsed(secret.id, code);
        if (alreadyUsed) {
          this.error.set('That code was already used. Wait for the next TOTP code and try again.');
          return;
        }

        const isValid = await this.totpGenerator.validateTOTP(
          secret.secret,
          code,
          secret.digits,
          1,
          secret.period,
          secret.algorithm as 'SHA1' | 'SHA256' | 'SHA512',
        );

        if (!isValid) {
          this.error.set('The TOTP code is invalid or expired.');
          return;
        }

        await this.dexieService.recordOTPUsage(secret.id, code);
        this.offlineCode = '';
      } else {
        const storedPinHash = this.pinHash();
        if (!storedPinHash) {
          this.error.set('Offline login is not configured. Set up TOTP or a PIN while online first.');
          return;
        }

        if (!/^\d{4,}$/.test(this.offlinePin.trim())) {
          this.error.set('Enter your device PIN (at least 4 digits).');
          return;
        }

        const validPin = await this.encryptionService.verifyPin(this.offlinePin.trim(), storedPinHash);
        if (!validPin) {
          this.error.set('PIN is incorrect.');
          return;
        }

        this.offlinePin = '';
      }

      this.sessionService.startOfflineSession();
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.error.set(`Offline login failed: ${error}`);
    } finally {
      this.loading.set(false);
    }
  }
}
