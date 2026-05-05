import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TOTPGeneratorService } from '../../services/totp-generator.service';
import { DexieService } from '../../services/dexie.service';
import { TOTPSecret } from '../../services/db/models/totp-secret.model';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-totp-display',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './totp-display.html',
  styleUrl: './totp-display.scss',
})
export class TOTPDisplayComponent implements OnInit, OnDestroy {
  public secrets: TOTPSecret[] = [];
  public totpCodes: Map<string, { code: string; remainingSeconds: number }> = new Map();
  public loading = true;
  public error: string | null = null;
  public searchQuery = '';
  public copiedCode: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private totpGenerator: TOTPGeneratorService,
    private dexieService: DexieService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadSecrets();
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load all TOTP secrets from IndexedDB
   */
  async loadSecrets(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      this.secrets = await this.dexieService.getAllTOTPSecrets();
      this.generateAllCodes();
    } catch (err) {
      this.error = `Failed to load TOTP secrets: ${err}`;
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Generate TOTP codes for all secrets
   */
  generateAllCodes(): void {
    this.secrets.forEach((secret) => {
      try {
        const { code, remainingSeconds } = this.totpGenerator.getTOTPWithTimer(
          secret.secret,
          secret.digits,
          secret.period,
        );
        this.totpCodes.set(secret.id, { code, remainingSeconds });
      } catch (err) {
        console.error(`Failed to generate code for ${secret.account}:`, err);
      }
    });
  }

  /**
   * Start real-time update timer
   */
  startTimer(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.generateAllCodes();
      });
  }

  /**
   * Copy TOTP code to clipboard
   */
  copyCode(secretId: string, code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.copiedCode = secretId;
      setTimeout(() => {
        this.copiedCode = null;
      }, 2000);
    });
  }

  /**
   * Delete TOTP secret
   */
  async deleteSecret(secretId: string): Promise<void> {
    if (!confirm('Are you sure? You can use backup codes to recover.')) {
      return;
    }

    try {
      await this.dexieService.deleteTOTPSecret(secretId);
      this.secrets = this.secrets.filter((s) => s.id !== secretId);
      this.totpCodes.delete(secretId);
    } catch (err) {
      this.error = `Failed to delete secret: ${err}`;
    }
  }

  /**
   * Add new TOTP account
   */
  addNewAccount(): void {
    this.router.navigate(['/auth/setup-totp']);
  }

  /**
   * Search secrets by account or issuer
   */
  getFilteredSecrets(): TOTPSecret[] {
    if (!this.searchQuery.trim()) {
      return this.secrets;
    }

    const query = this.searchQuery.toLowerCase();
    return this.secrets.filter(
      (s) => s.account.toLowerCase().includes(query) || s.issuer.toLowerCase().includes(query),
    );
  }

  /**
   * Get progress percentage for timer
   */
  getTimerProgress(remainingSeconds: number, period: number = 30): number {
    return (remainingSeconds / period) * 100;
  }
}
