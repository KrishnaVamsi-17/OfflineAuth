import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';

@Injectable({
  providedIn: 'root',
})
export class TOTPGeneratorService {
  private readonly base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * Generate a new Base32 secret for provisioning
   */
  generateSecret(length: number = 20): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(randomBytes, (value) => this.base32Alphabet[value % this.base32Alphabet.length]).join('');
  }

  /**
   * Build an otpauth URI for authenticator apps
   */
  buildOtpAuthUri(params: {
    secret: string;
    account: string;
    issuer: string;
    digits?: number;
    period?: number;
    algorithm?: string;
  }): string {
    const digits = params.digits ?? 6;
    const period = params.period ?? 30;
    const algorithm = params.algorithm ?? 'SHA1';
    const encodedAccount = encodeURIComponent(params.account);
    const encodedIssuer = encodeURIComponent(params.issuer);

    return (
      `otpauth://totp/${encodedIssuer}:${encodedAccount}?` +
      `secret=${params.secret}&issuer=${encodedIssuer}&digits=${digits}&period=${period}&algorithm=${algorithm}`
    );
  }

  /**
   * Render an otpauth URI as a QR code data URL
   */
  async generateQRCodeDataUrl(uri: string): Promise<string> {
    return QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
    });
  }

  /**
   * Generate current TOTP code from Base32 secret
   */
  async generateTOTP(
    secret: string,
    digits: number = 6,
    period: number = 30,
    algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1',
    timestamp: number = Date.now(),
  ): Promise<string> {
    try {
      const counter = Math.floor(timestamp / 1000 / period);
      return await this.generateHotp(secret, counter, digits, algorithm);
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
    algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1',
  ): {
    code: Promise<string>;
    remainingSeconds: number;
  } {
    const code = this.generateTOTP(secret, digits, period, algorithm);
    const remainingSeconds = this.getRemainingSeconds(period);

    return { code, remainingSeconds };
  }

  /**
   * Get current TOTP code with remaining seconds until expiry
   */
  async getResolvedTOTPWithTimer(
    secret: string,
    digits: number = 6,
    period: number = 30,
    algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1',
  ): Promise<{
    code: string;
    remainingSeconds: number;
  }> {
    const code = await this.generateTOTP(secret, digits, period, algorithm);
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
  async validateTOTP(
    secret: string,
    code: string,
    digits: number = 6,
    window: number = 1,
    period: number = 30,
    algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1',
  ): Promise<boolean> {
    try {
      const normalizedCode = code.trim();

      for (let offset = -window; offset <= window; offset++) {
        const timestamp = Date.now() + offset * period * 1000;
        const candidate = await this.generateTOTP(secret, digits, period, algorithm, timestamp);
        if (candidate === normalizedCode) {
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

  private async generateHotp(
    secret: string,
    counter: number,
    digits: number,
    algorithm: 'SHA1' | 'SHA256' | 'SHA512',
  ): Promise<string> {
    const keyBytes = this.decodeBase32(secret);
    const keyData = keyBytes.buffer.slice(
      keyBytes.byteOffset,
      keyBytes.byteOffset + keyBytes.byteLength,
    ) as ArrayBuffer;
    const counterBytes = new Uint8Array(8);
    let value = counter;

    for (let index = 7; index >= 0; index--) {
      counterBytes[index] = value & 0xff;
      value = Math.floor(value / 256);
    }

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: this.toWebCryptoAlgorithm(algorithm) },
      false,
      ['sign'],
    );

    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBytes));
    const offset = signature[signature.length - 1] & 0x0f;
    const binary =
      ((signature[offset] & 0x7f) << 24) |
      ((signature[offset + 1] & 0xff) << 16) |
      ((signature[offset + 2] & 0xff) << 8) |
      (signature[offset + 3] & 0xff);

    return (binary % 10 ** digits).toString().padStart(digits, '0');
  }

  private decodeBase32(secret: string): Uint8Array {
    const normalized = secret.toUpperCase().replace(/=+$/g, '');
    let bits = '';

    for (const char of normalized) {
      const value = this.base32Alphabet.indexOf(char);
      if (value === -1) {
        throw new Error('Invalid Base32 secret');
      }

      bits += value.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
      bytes.push(parseInt(bits.slice(index, index + 8), 2));
    }

    return new Uint8Array(bytes);
  }

  private toWebCryptoAlgorithm(algorithm: 'SHA1' | 'SHA256' | 'SHA512'): 'SHA-1' | 'SHA-256' | 'SHA-512' {
    switch (algorithm) {
      case 'SHA256':
        return 'SHA-256';
      case 'SHA512':
        return 'SHA-512';
      default:
        return 'SHA-1';
    }
  }
}
