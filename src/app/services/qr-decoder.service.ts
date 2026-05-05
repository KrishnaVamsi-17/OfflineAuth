import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class QRDecoderService {
  /**
   * Decode QR code from image file and extract otpauth:// URI
   */
  async decodeQRImage(imageFile: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e: ProgressEvent<FileReader>) => {
        try {
          const imageData = e.target?.result as string;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          const image = new Image();
          image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);

            // Use a QR code decoder library or simple pattern matching
            // For now, we'll use jsQR if available or throw error
            const decoded = this.decodeFromCanvas(canvas);
            if (decoded) {
              resolve(decoded);
            } else {
              reject(new Error('Failed to decode QR code'));
            }
          };

          image.onerror = () => {
            reject(new Error('Failed to load image'));
          };

          image.src = imageData;
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Decode QR code from canvas (requires jsQR library)
   * For now, this returns null - in production, use jsQR library
   */
  private decodeFromCanvas(canvas: HTMLCanvasElement): string | null {
    // TODO: Integrate jsQR library
    // const jsQR = require('jsqr');
    // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // const code = jsQR(imageData.data, imageData.width, imageData.height);
    // return code?.data || null;
    return null;
  }

  /**
   * Parse otpauth:// URI and extract TOTP parameters
   */
  parseOtpAuthUri(uri: string): {
    secret: string;
    account: string;
    issuer: string;
    period: number;
    digits: number;
    algorithm: string;
  } | null {
    try {
      const url = new URL(uri);

      if (url.protocol !== 'otpauth:') {
        throw new Error('Invalid otpauth URI');
      }

      const secret = url.searchParams.get('secret');
      const issuer = url.searchParams.get('issuer') || 'Unknown';
      const period = parseInt(url.searchParams.get('period') || '30', 10);
      const digits = parseInt(url.searchParams.get('digits') || '6', 10);
      const algorithm = url.searchParams.get('algorithm') || 'SHA1';

      // Extract account from pathname (format: /TOTP/account@issuer)
      const pathParts = url.pathname.split('/');
      const account = pathParts[pathParts.length - 1]?.split(':')?.pop() || 'Unknown';

      if (!secret) {
        throw new Error('Missing secret in otpauth URI');
      }

      return {
        secret: secret.toUpperCase(),
        account: decodeURIComponent(account),
        issuer: decodeURIComponent(issuer),
        period,
        digits,
        algorithm,
      };
    } catch (error) {
      console.error('Failed to parse otpauth URI:', error);
      return null;
    }
  }

  /**
   * Validate if secret is valid Base32
   */
  isValidBase32Secret(secret: string): boolean {
    try {
      // Base32 uses characters A-Z and 2-7
      const base32Regex = /^[A-Z2-7]+=*$/;
      return base32Regex.test(secret.toUpperCase());
    } catch (error) {
      return false;
    }
  }

  /**
   * Sanitize Base32 secret (remove spaces, convert to uppercase)
   */
  sanitizeBase32Secret(secret: string): string {
    return secret.replace(/\s/g, '').toUpperCase();
  }

  /**
   * Build otpauth:// URI from parameters
   */
  buildOtpAuthUri(params: {
    secret: string;
    account: string;
    issuer: string;
    digits?: number;
    period?: number;
    algorithm?: string;
  }): string {
    const digits = params.digits || 6;
    const period = params.period || 30;
    const algorithm = params.algorithm || 'SHA1';

    const encodedAccount = encodeURIComponent(params.account);
    const encodedIssuer = encodeURIComponent(params.issuer);

    return (
      `otpauth://totp/${encodedIssuer}:${encodedAccount}?` +
      `secret=${params.secret}&` +
      `issuer=${encodedIssuer}&` +
      `digits=${digits}&` +
      `period=${period}&` +
      `algorithm=${algorithm}`
    );
  }
}
