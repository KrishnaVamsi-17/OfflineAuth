export interface OTPHistory {
  id: string;
  secretId: string;
  code: string;
  generatedAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
}
