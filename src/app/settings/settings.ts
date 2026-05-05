import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EncryptionService } from '../services/encryption.service';
import { DexieService } from '../services/dexie.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent implements OnInit {
  public activeTab = 'user-details';

  public userDetails = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  };

  public authConfig = {
    enableMFA: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    enableBiometric: false,
  };

  public pinSetup = {
    currentPin: '',
    newPin: '',
    confirmPin: '',
    isSet: false,
  };

  public pinError: string | null = null;
  public pinSuccess: string | null = null;
  public pinLoading = false;

  constructor(
    private encryptionService: EncryptionService,
    private dexieService: DexieService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.checkPinStatus();
  }

  /**
   * Check if PIN is already set
   */
  async checkPinStatus(): Promise<void> {
    try {
      const settings = await this.dexieService.getSettings();
      this.pinSetup.isSet = !!settings?.pinHash;
    } catch (error) {
      console.error('Failed to check PIN status:', error);
    }
  }

  /**
   * Set or update PIN
   */
  async setupPin(): Promise<void> {
    this.pinError = null;
    this.pinSuccess = null;

    if (!this.pinSetup.newPin.trim()) {
      this.pinError = 'PIN cannot be empty';
      return;
    }

    if (this.pinSetup.newPin.length < 4) {
      this.pinError = 'PIN must be at least 4 digits';
      return;
    }

    if (this.pinSetup.newPin !== this.pinSetup.confirmPin) {
      this.pinError = 'PINs do not match';
      return;
    }

    if (this.pinSetup.isSet && !this.pinSetup.currentPin.trim()) {
      this.pinError = 'Current PIN is required to change it';
      return;
    }

    this.pinLoading = true;

    try {
      // If PIN already exists, verify current PIN
      if (this.pinSetup.isSet) {
        const settings = await this.dexieService.getSettings();
        if (!settings || !settings.pinHash) {
          throw new Error('Settings not found');
        }

        const isValid = await this.encryptionService.verifyPin(
          this.pinSetup.currentPin,
          settings.pinHash,
        );

        if (!isValid) {
          this.pinError = 'Current PIN is incorrect';
          return;
        }
      }

      // Generate salt and hash new PIN
      const salt = this.encryptionService.generateSalt();
      const pinHash = await this.encryptionService.hashPin(this.pinSetup.newPin);

      // Save settings
      await this.dexieService.saveSettings({
        id: 'settings',
        pinHash: pinHash,
        pinSalt: this.bufferToBase64(salt),
        encryptionKeyDerived: true,
        sessionTimeout: 30,
      });

      this.pinSuccess = this.pinSetup.isSet ? 'PIN updated successfully!' : 'PIN set successfully!';

      this.pinSetup.isSet = true;
      this.resetPinForm();
    } catch (error) {
      this.pinError = `Failed to set PIN: ${error}`;
    } finally {
      this.pinLoading = false;
    }
  }

  /**
   * Reset PIN form
   */
  resetPinForm(): void {
    this.pinSetup.currentPin = '';
    this.pinSetup.newPin = '';
    this.pinSetup.confirmPin = '';
  }

  /**
   * Navigate to TOTP setup
   */
  addTOTPAccount(): void {
    this.router.navigate(['/auth/setup-totp']);
  }

  /**
   * Navigate to TOTP display
   */
  viewTOTPAccounts(): void {
    this.router.navigate(['/auth/totp-display']);
  }

  public saveUserDetails(): void {
    console.log('User Details saved:', this.userDetails);
  }

  public saveAuthConfig(): void {
    console.log('Auth Config saved:', this.authConfig);
  }

  public setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  /**
   * Convert Uint8Array to base64
   */
  private bufferToBase64(buffer: Uint8Array): string {
    const binary = String.fromCharCode(...buffer);
    return btoa(binary);
  }
}
