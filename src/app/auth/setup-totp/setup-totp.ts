import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DexieService } from '../../services/dexie.service';
import { TOTPGeneratorService } from '../../services/totp-generator.service';

@Component({
  selector: 'app-setup-totp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup-totp.html',
  styleUrl: './setup-totp.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupTotpComponent implements OnInit {
  public step: 'details' | 'provision' = 'details';
  public loading = false;
  public error: string | null = null;
  public success: string | null = null;

  public readonly defaultAccountLabel = 'offline-user';
  public readonly defaultIssuerLabel = 'OfflineAuth';
  public verificationCode = '';

  public totpData: {
    secret: string;
    account: string;
    issuer: string;
    period: number;
    digits: number;
    algorithm: string;
    otpauthUri: string;
  } | null = null;
  public qrCodeDataUrl = '';
  public backupCodes: string[] = [];

  constructor(
    private dexieService: DexieService,
    private totpGenerator: TOTPGeneratorService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.generateBackupCodes();
  }

  /**
   * Prepare a new provisioning QR for the single offline account
   */
  async generateProvisioningQr(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.success = null;

    try {
      const secret = this.totpGenerator.generateSecret();
      const account = this.defaultAccountLabel;
      const issuer = this.defaultIssuerLabel;
      const otpauthUri = this.totpGenerator.buildOtpAuthUri({
        secret,
        account,
        issuer,
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
      });

      this.totpData = {
        secret,
        account,
        issuer,
        period: 30,
        digits: 6,
        algorithm: 'SHA1',
        otpauthUri,
      };
      this.qrCodeDataUrl = await this.totpGenerator.generateQRCodeDataUrl(otpauthUri);
      this.verificationCode = '';
      this.step = 'provision';
    } catch (err) {
      this.error = `Failed to generate provisioning QR: ${err}`;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Cancel and go back
   */
  cancel(): void {
    if (this.step === 'provision') {
      this.step = 'details';
      this.error = null;
    } else {
      this.router.navigate(['/settings']);
    }
  }

  /**
   * Verify the authenticator code and save the single local TOTP secret
   */
  async verifyAndSave(): Promise<void> {
    if (!this.totpData) return;

    if (!/^\d{6}$/.test(this.verificationCode.trim())) {
      this.error = 'Enter the 6-digit code currently shown in your authenticator app';
      return;
    }

    const isValid = await this.totpGenerator.validateTOTP(
      this.totpData.secret,
      this.verificationCode.trim(),
      this.totpData.digits,
      1,
      this.totpData.period,
    );

    if (!isValid) {
      this.error = 'The code did not match this QR setup. Scan again and try a fresh code.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    try {
      await this.dexieService.saveSingleTOTPSecret({
        account: this.totpData.account,
        issuer: this.totpData.issuer,
        secret: this.totpData.secret,
        period: this.totpData.period,
        digits: this.totpData.digits,
        algorithm: this.totpData.algorithm,
        active: true,
        createdAt: new Date(),
        backupCodes: this.backupCodes,
      });

      this.success = 'Authenticator linked successfully. This device now has one offline TOTP account.';
      this.router.navigate(['/settings']);
    } catch (err) {
      this.error = `Failed to save TOTP: ${err}`;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Generate random backup codes
   */
  generateBackupCodes(): void {
    this.backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const code =
        Array.from({ length: 4 }, () => Math.floor(Math.random() * 10))
          .join('')
          .match(/.{1,4}/g)
          ?.join('-') || '';
      this.backupCodes.push(code);
    }
  }

  /**
   * Copy backup codes to clipboard
   */
  copyBackupCodes(): void {
    const text = this.backupCodes.join('\n');
    navigator.clipboard.writeText(text);
  }
}
