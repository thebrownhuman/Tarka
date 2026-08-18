import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { candidateGuard } from './core/guards/candidate.guard';
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
  // Candidate routes (Feature 6 - candidate UI). candidateGuard redirects an
  // admin session to /admin instead of rendering the candidate shell only to
  // have every API call rejected with 403 (mirror of adminGuard below).
  {
    path: 'tests',
    canActivate: [authGuard, candidateGuard],
    loadComponent: () => import('./features/candidate/test-list/test-list.component').then((m) => m.TestListComponent),
  },
  {
    path: 'take-test/:attemptId',
    canActivate: [authGuard, candidateGuard],
    loadComponent: () => import('./features/candidate/take-test/take-test.component').then((m) => m.TakeTestComponent),
  },
  {
    path: 'history',
    canActivate: [authGuard, candidateGuard],
    loadComponent: () =>
      import('./features/candidate/history/history-list/history-list.component').then((m) => m.HistoryListComponent),
  },
  {
    path: 'history/:attemptId',
    canActivate: [authGuard, candidateGuard],
    loadComponent: () =>
      import('./features/candidate/history/history-detail/history-detail.component').then((m) => m.HistoryDetailComponent),
  },
  // Admin routes (Feature 6 - admin UI). adminGuard redirects non-admin
  // sessions to /tests so they never see the admin shell only to have every
  // API call rejected with 403; the backend role check remains the real
  // security boundary regardless of what the frontend guard allows.
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin/dashboard/dashboard.component').then((m) => m.AdminDashboardComponent),
    children: [
      { path: '', redirectTo: 'candidates', pathMatch: 'full' },
      {
        path: 'candidates',
        loadComponent: () => import('./features/admin/candidates/candidates.component').then((m) => m.CandidatesComponent),
      },
      {
        path: 'questions',
        loadComponent: () => import('./features/admin/questions/questions.component').then((m) => m.QuestionsComponent),
      },
      {
        path: 'tests',
        loadComponent: () => import('./features/admin/tests/tests.component').then((m) => m.TestsComponent),
      },
      {
        path: 'attempts',
        loadComponent: () => import('./features/admin/attempts/attempts.component').then((m) => m.AttemptsComponent),
      },
      {
        path: 'extensions',
        loadComponent: () =>
          import('./features/admin/extension-requests/extension-requests.component').then((m) => m.ExtensionRequestsComponent),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard, candidateHomeRedirectGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
  },
  { path: '**', redirectTo: '' },
];
