import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, RefreshResponse, Session } from '../models/session.model';

const ACCESS_TOKEN_KEY = 'tarka_access_token';
const REFRESH_TOKEN_KEY = 'tarka_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<Session | null>(null);
  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  constructor(private readonly http: HttpClient) {}

  login(loginId: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, { loginId, password }).pipe(
      tap((response) => {
        this.storeTokens(response.accessToken, response.refreshToken);
        this.sessionSignal.set({
          role: response.role,
          displayName: response.displayName,
          mustChangePassword: response.mustChangePassword,
        });
      }),
    );
  }

  refreshAccessToken(): Observable<RefreshResponse> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<RefreshResponse>(`${environment.apiBaseUrl}/auth/refresh`, { refreshToken }).pipe(
      tap((response) => this.storeTokens(response.accessToken, response.refreshToken)),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ success: boolean }> {
    return this.http
      .post<{ success: boolean }>(`${environment.apiBaseUrl}/auth/change-password`, {
        currentPassword,
        newPassword,
      })
      .pipe(
        tap(() => {
          const current = this.sessionSignal();
          if (current) {
            this.sessionSignal.set({ ...current, mustChangePassword: false });
          }
        }),
      );
  }

  fetchMe(): Observable<Session> {
    return this.http.get<Session>(`${environment.apiBaseUrl}/auth/me`).pipe(tap((session) => this.sessionSignal.set(session)));
  }

  logout(): Observable<{ success: boolean }> {
    const refreshToken = this.getRefreshToken();
    return this.http
      .post<{ success: boolean }>(`${environment.apiBaseUrl}/auth/logout`, { refreshToken })
      .pipe(tap(() => this.clearSession()));
  }

  clearSession(): void {
    this.sessionSignal.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}
