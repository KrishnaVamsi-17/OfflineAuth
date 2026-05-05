export interface UserSettings {
  id: string;
  pinHash: string; // Hashed PIN for validation
  pinSalt: string; // Salt for PIN hashing
  encryptionKeyDerived: boolean; // Whether encryption key is derived from PIN
  lastUnlockedAt?: Date;
  sessionTimeout: number; // Minutes
}
