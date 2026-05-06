import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth';
import { AuthCallbackComponent } from './auth/auth-callback.component';
import { DashboardComponent } from './dashboard/dashboard';
import { SettingsComponent } from './settings/settings';
import { SetupTotpComponent } from './auth/setup-totp/setup-totp';
import { TOTPDisplayComponent } from './auth/totp-display/totp-display';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: AuthComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'auth-callback', component: AuthCallbackComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'settings', component: SettingsComponent },
  {
    path: 'auth-routes',
    children: [
      { path: 'setup-totp', component: SetupTotpComponent },
      { path: 'totp-display', component: TOTPDisplayComponent },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
