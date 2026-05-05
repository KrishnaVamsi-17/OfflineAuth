import { Injectable } from '@angular/core';
import { totp } from 'otplib';

@Injectable({
  providedIn: 'root',
})
export class TOTPGeneratorService {
  /**
   * Generate current TOTP code from Base32 secret
   */
  generateTOTP(secret: string, digits: number = 6): string {
    try {
      totp.options = { digits: digits };
      return totp.generate(secret);
    } catch (error) {
      throw new Error(`Failed to generate TOTP: ${error}`);
    }
  }

  /**
   * Get current TOTP code with remaining seconds until expiry
   */
  getTOTPWithTimer(
    secret: string,
    digits: number = 6,
    period: number = 30,
  ): {
    code: string;
    remainingSeconds: number;
  } {
    const code = this.generateTOTP(secret, digits);
    const remainingSeconds = this.getRemainingSeconds(period);

    return { code, remainingSeconds };
  }

  /**
   * Get remaining seconds until TOTP expires
   */
  getRemainingSeconds(period: number = 30): number {
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
  }

  /**
   * Validate TOTP code (with time window tolerance)
   */
  validateTOTP(secret: string, code: string, digits: number = 6, window: number = 1): boolean {
    try {
      const now = Math.floor(Date.now() / 1000);
      const timeStep = 30;

      // Check current and ±window time steps
      for (let i = -window; i <= window; i++) {
        const timeOffset = (now + i * timeStep) * 1000;
        totp.options = { digits: digits, window: window };
        const isValid = totp.check(code, secret);
        if (isValid) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('TOTP validation error:', error);
      return false;
    }
  }

  /**
   * Check if provided secret is valid Base32 format
   */
  isValidBase32Secret(secret: string): boolean {
    try {
      // Base32 alphabet
      const base32Regex = /^[A-Z2-7]+=*$/;
      return base32Regex.test(secret.toUpperCase());
    } catch (error) {
      return false;
    }
  }
}
