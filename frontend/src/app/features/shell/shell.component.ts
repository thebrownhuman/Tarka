import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

/**
 * Bare authenticated landing page. Real admin/candidate dashboards are
 * built in later features - this only proves the guard/session wiring works.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  template: `
    <div class="shell">
      <p>Signed in as <strong>{{ authService.session()?.displayName }}</strong> ({{ authService.session()?.role }})</p>
      <button (click)="logout()">Log out</button>
    </div>
  `,
  styles: [
    `
      .shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        min-height: 100vh;
      }
    `,
  ],
})
export class ShellComponent {
  constructor(
    readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  logout(): void {
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/login']),
    });
  }
}
