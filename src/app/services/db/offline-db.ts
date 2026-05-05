import Dexie, { Table } from 'dexie';
import { TOTPSecret } from './models/totp-secret.model';
import { OTPHistory } from './models/otp-history.model';
import { UserSettings } from './models/user-settings.model';

export class OfflineAuthDB extends Dexie {
  totpSecrets!: Table<TOTPSecret>;
  otpHistory!: Table<OTPHistory>;
  userSettings!: Table<UserSettings>;

  constructor() {
    super('OfflineAuthDB');
    this.version(1).stores({
      totpSecrets: '++id, account, issuer, active',
      otpHistory: '++id, secretId, generatedAt',
      userSettings: 'id',
    });
  }
}

export const db = new OfflineAuthDB();
