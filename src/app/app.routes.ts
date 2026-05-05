import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth';
import { SettingsComponent } from './settings/settings';
import { SetupTotpComponent } from './auth/setup-totp/setup-totp';
import { TOTPDisplayComponent } from './auth/totp-display/totp-display';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: AuthComponent },
  { path: 'settings', component: SettingsComponent },
  {
    path: 'auth',
    children: [
      { path: 'setup-totp', component: SetupTotpComponent },
      { path: 'totp-display', component: TOTPDisplayComponent },
    ],
  },
];
