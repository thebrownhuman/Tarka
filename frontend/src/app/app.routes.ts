import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { candidateHomeRedirectGuard } from './core/guards/candidate-home-redirect.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () => import('./features/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  // Candidate routes (Feature 6 - candidate UI)
  {
    path: 'tests',
    canActivate: [authGuard],
    loadComponent: () => import('./features/candidate/test-list/test-list.component').then((m) => m.TestListComponent),
  },
  {
    path: 'take-test/:attemptId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/candidate/take-test/take-test.component').then((m) => m.TakeTestComponent),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/candidate/history/history-list/history-list.component').then((m) => m.HistoryListComponent),
  },
  {
    path: 'history/:attemptId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/candidate/history/history-detail/history-detail.component').then((m) => m.HistoryDetailComponent),
  },
  {
    path: '',
    canActivate: [authGuard, candidateHomeRedirectGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
  },
  { path: '**', redirectTo: '' },
];
