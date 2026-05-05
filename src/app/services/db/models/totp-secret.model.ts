export interface TOTPSecret {
  id: string;
  account: string;
  issuer: string;
  secret: string; // Encrypted Base32 secret
  period: number;
  digits: number;
  algorithm: string;
  createdAt: Date;
  lastUsed?: Date;
  active: boolean;
  backupCodes?: string[]; // Encrypted backup codes
}
