import { Injectable } from '@angular/core';
import { db } from './db/offline-db';
import { TOTPSecret } from './db/models/totp-secret.model';
import { OTPHistory } from './db/models/otp-history.model';
import { UserSettings } from './db/models/user-settings.model';

@Injectable({
  providedIn: 'root',
})
export class DexieService {
  // ==================== TOTP Secrets ====================

  /**
   * Add new TOTP secret
   */
  async addTOTPSecret(payload: Omit<TOTPSecret, 'id'>): Promise<string> {
    const id = this.generateId();

    const secret: TOTPSecret = {
      ...payload,
      id,
      active: true,
    };

    await db.totpSecrets.add(secret);
    return id;
  }

  /**
   * Replace any existing TOTP configuration with a single active secret
   */
  async saveSingleTOTPSecret(payload: Omit<TOTPSecret, 'id'>): Promise<string> {
    await db.transaction('rw', db.totpSecrets, db.otpHistory, async () => {
      await db.totpSecrets.clear();
      await db.otpHistory.clear();
    });

    return this.addTOTPSecret(payload);
  }

  /**
   * Get TOTP secret by ID
   */
  async getTOTPSecret(id: string): Promise<TOTPSecret | null> {
    return (await db.totpSecrets.get(id)) || null;
  }

  /**
   * Get all TOTP secrets (decrypted)
   */
  async getAllTOTPSecrets(): Promise<TOTPSecret[]> {
    const secrets = await db.totpSecrets.toArray();
    return secrets.filter((secret) => secret.active !== false);
  }

  /**
   * Update TOTP secret
   */
  async updateTOTPSecret(id: string, updates: Partial<TOTPSecret>): Promise<void> {
    await db.totpSecrets.update(id, updates);
  }

  /**
   * Delete TOTP secret
   */
  async deleteTOTPSecret(id: string): Promise<void> {
    await db.totpSecrets.delete(id);
    // Also delete history for this secret
    await db.otpHistory.where('secretId').equals(id).delete();
  }

  /**
   * Search TOTP secrets by account or issuer
   */
  async searchTOTPSecrets(query: string): Promise<TOTPSecret[]> {
    const allSecrets = await this.getAllTOTPSecrets();
    const queryLower = query.toLowerCase();

    return allSecrets.filter(
      (s) =>
        s.account.toLowerCase().includes(queryLower) || s.issuer.toLowerCase().includes(queryLower),
    );
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: string): Promise<void> {
    await db.totpSecrets.update(id, { lastUsed: new Date() });
  }

  // ==================== OTP History ====================

  /**
   * Record OTP usage
   */
  async recordOTPUsage(secretId: string, code: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 1000); // Expires in 30 seconds

    const history: OTPHistory = {
      id: this.generateId(),
      secretId,
      code,
      generatedAt: now,
      expiresAt,
      used: true,
      usedAt: now,
    };

    await db.otpHistory.add(history);
    await this.updateLastUsed(secretId);
  }

  /**
   * Get OTP history for a secret
   */
  async getOTPHistory(secretId: string, limit: number = 10): Promise<OTPHistory[]> {
    return db.otpHistory.where('secretId').equals(secretId).reverse().limit(limit).toArray();
  }

  /**
   * Check if code was already used
   */
  async isCodeUsed(secretId: string, code: string): Promise<boolean> {
    const record = await db.otpHistory.where('secretId').equals(secretId).toArray();
    return record.some((r) => r.code === code && r.used);
  }

  /**
   * Clear expired OTP history
   */
  async clearExpiredOTPHistory(): Promise<number> {
    const now = new Date();
    const expired = await db.otpHistory.where('expiresAt').below(now).toArray();

    await db.otpHistory.bulkDelete(expired.map((e) => e.id));
    return expired.length;
  }

  // ==================== User Settings ====================

  /**
   * Save user settings (PIN, session timeout, etc.)
   */
  async saveSettings(settings: UserSettings): Promise<void> {
    const existing = await db.userSettings.get('settings');

    if (existing) {
      await db.userSettings.update('settings', settings);
    } else {
      await db.userSettings.add({ ...settings, id: 'settings' });
    }
  }

  /**
   * Get user settings
   */
  async getSettings(): Promise<UserSettings | null> {
    return (await db.userSettings.get('settings')) || null;
  }

  /**
   * Update last unlocked timestamp
   */
  async updateLastUnlockedAt(): Promise<void> {
    const settings = await this.getSettings();
    if (settings) {
      await db.userSettings.update('settings', { lastUnlockedAt: new Date() });
    }
  }

  /**
   * Check if session is expired
   */
  async isSessionExpired(): Promise<boolean> {
    const settings = await this.getSettings();

    if (!settings || !settings.lastUnlockedAt || !settings.sessionTimeout) {
      return true;
    }

    const elapsedMinutes = (Date.now() - settings.lastUnlockedAt.getTime()) / (1000 * 60);
    return elapsedMinutes > settings.sessionTimeout;
  }

  // ==================== Utility ====================

  /**
   * Clear all data (for logout)
   */
  async clearAll(): Promise<void> {
    await db.totpSecrets.clear();
    await db.otpHistory.clear();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
