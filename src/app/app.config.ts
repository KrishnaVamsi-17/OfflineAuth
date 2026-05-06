import { ApplicationConfig, provideBrowserGlobalErrorListeners, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  MSAL_INSTANCE,
  MSAL_GUARD_CONFIG,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuardConfiguration,
  MsalInterceptorConfiguration,
} from '@azure/msal-angular';
import { IPublicClientApplication, PublicClientApplication, InteractionType } from '@azure/msal-browser';
import { msalConfig, msalInterceptorConfig } from './config/msal.config';

/**
 * Factory function to create MSAL instance
 */
export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication(msalConfig);
}

import { routes } from './app.routes';

// MSAL Providers
const msalProviders: Provider[] = [
  {
    provide: MSAL_INSTANCE,
    useFactory: MSALInstanceFactory,
  },
  {
    provide: MSAL_GUARD_CONFIG,
    useValue: {
      interactionType: InteractionType.Redirect,
      authRequest: {
        scopes: ['openid', 'profile', 'email'],
      },
      loginFailedRoute: '/auth',
    } as MsalGuardConfiguration,
  },
  {
    provide: MSAL_INTERCEPTOR_CONFIG,
    useValue: msalInterceptorConfig,
  },
  MsalBroadcastService,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    ...msalProviders,
  ]
};