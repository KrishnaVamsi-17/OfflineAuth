import { Injectable, signal } from '@angular/core';

const OFFLINE_SESSION_KEY = 'offline-authenticated';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  public readonly isOfflineAuthenticated = signal(
    sessionStorage.getItem(OFFLINE_SESSION_KEY) === 'true',
  );

  public startOfflineSession(): void {
    sessionStorage.setItem(OFFLINE_SESSION_KEY, 'true');
    this.isOfflineAuthenticated.set(true);
  }

  public clearSession(): void {
    sessionStorage.removeItem(OFFLINE_SESSION_KEY);
    this.isOfflineAuthenticated.set(false);
  }
}