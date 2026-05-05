import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { QRDecoderService } from '../../services/qr-decoder.service';
import { DexieService } from '../../services/dexie.service';
import { TOTPGeneratorService } from '../../services/totp-generator.service';

@Component({
  selector: 'app-setup-totp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup-totp.html',
  styleUrl: './setup-totp.scss',
})
export class SetupTotpComponent implements OnInit {
  public step: 'method' | 'manual' | 'confirmation' = 'method';
  public scanMethod: 'qr' | 'manual' | null = null;
  public loading = false;
  public error: string | null = null;

  public manualSecret = '';
  public manualAccount = '';
  public manualIssuer = '';

  public totpData: any = null;
  public previewCode = '';
  public backupCodes: string[] = [];

  constructor(
    private qrDecoder: QRDecoderService,
    private dexieService: DexieService,
    private totpGenerator: TOTPGeneratorService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.generateBackupCodes();
  }

  /**
   * Handle QR code file upload
   */
  async onQRFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.loading = true;
    this.error = null;

    try {
      // For now, show manual entry instead (QR decoding requires additional library)
      this.error = 'QR scanning requires camera/library integration. Use manual entry instead.';
      this.scanMethod = 'manual';
      this.step = 'manual';
    } catch (err) {
      this.error = `Failed to decode QR: ${err}`;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Start manual entry flow
   */
  startManualEntry(): void {
    this.scanMethod = 'manual';
    this.step = 'manual';
    this.error = null;
  }

  /**
   * Validate and proceed with manual secret
   */
  async proceedWithManual(): Promise<void> {
    const sanitizedSecret = this.qrDecoder.sanitizeBase32Secret(this.manualSecret);

    if (!this.qrDecoder.isValidBase32Secret(sanitizedSecret)) {
      this.error = 'Invalid Base32 secret format';
      return;
    }

    if (!this.manualAccount.trim()) {
      this.error = 'Account name is required';
      return;
    }

    if (!this.manualIssuer.trim()) {
      this.error = 'Issuer name is required';
      return;
    }

    this.totpData = {
      secret: sanitizedSecret,
      account: this.manualAccount.trim(),
      issuer: this.manualIssuer.trim(),
      period: 30,
      digits: 6,
      algorithm: 'SHA1',
    };

    // Generate preview code
    try {
      this.previewCode = this.totpGenerator.generateTOTP(this.totpData.secret);
      this.step = 'confirmation';
      this.error = null;
    } catch (err) {
      this.error = `Failed to generate TOTP: ${err}`;
    }
  }

  /**
   * Cancel and go back
   */
  cancel(): void {
    if (this.step === 'confirmation') {
      this.step = 'manual';
    } else if (this.step === 'manual') {
      this.step = 'method';
    } else {
      this.router.navigate(['/settings']);
    }
  }

  /**
   * Save TOTP secret
   */
  async saveTOTPSecret(): Promise<void> {
    if (!this.totpData) return;

    this.loading = true;
    this.error = null;

    try {
      await this.dexieService.addTOTPSecret({
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

      // Navigate to settings
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
