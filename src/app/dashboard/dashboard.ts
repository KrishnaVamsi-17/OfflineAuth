import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConnectivityService } from '../services/connectivity.service';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly router = inject(Router);
  private readonly connectivity = inject(ConnectivityService);
  private readonly sessionService = inject(SessionService);

  protected readonly isOnline = this.connectivity.isOnline;
  protected readonly sessionLabel = computed(() =>
    this.sessionService.isOfflineAuthenticated() ? 'Offline TOTP session' : 'Preview session',
  );

  public goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  public logout(): void {
    this.sessionService.clearSession();
    this.router.navigate(['/login']);
  }
}