import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class EncryptionService {
  private encryptionKey: CryptoKey | null = null;
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly ITERATION_COUNT = 100000;

  constructor() {}

  /**
   * Initialize encryption key from PIN
   * Derives key using PBKDF2
   */
  async initializeKeyFromPin(pin: string, salt: Uint8Array): Promise<void> {
    const pinBuffer = new TextEncoder().encode(pin);

    const keyMaterial = await crypto.subtle.importKey('raw', pinBuffer, { name: 'PBKDF2' }, false, [
      'deriveKey',
    ]);

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: this.ITERATION_COUNT,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Generate a random salt for PIN hashing
   */
  generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Hash PIN using SHA-256 (for storage)
   */
  async hashPin(pin: string): Promise<string> {
    const pinBuffer = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', pinBuffer);
    return this.bufferToHex(hashBuffer);
  }

  /**
   * Verify PIN hash
   */
  async verifyPin(pin: string, hash: string): Promise<boolean> {
    const computedHash = await this.hashPin(pin);
    return computedHash === hash;
  }

  /**
   * Encrypt data using AES-256-GCM
   * Returns IV + ciphertext as base64
   */
  async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt data
    const dataBuffer = new TextEncoder().encode(data);
    const ciphertext = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv: iv },
      this.encryptionKey,
      dataBuffer,
    );

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(new Uint8Array(iv));
    combined.set(new Uint8Array(ciphertext), iv.length);

    return this.bufferToBase64(combined);
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      // Decode base64
      const combined = this.base64ToBuffer(encryptedData);

      // Extract IV (first 12 bytes) and ciphertext (remaining)
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      // Decrypt data
      const plaintext = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: iv },
        this.encryptionKey,
        ciphertext,
      );

      return new TextDecoder().decode(plaintext);
    } catch (error) {
      throw new Error('Decryption failed: Invalid PIN or corrupted data');
    }
  }

  /**
   * Check if encryption key is initialized
   */
  isInitialized(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Clear encryption key from memory
   */
  clearKey(): void {
    this.encryptionKey = null;
  }

  /**
   * Convert Uint8Array to hex string
   */
  private bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private bufferToBase64(buffer: Uint8Array): string {
    const binary = String.fromCharCode(...buffer);
    return btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
