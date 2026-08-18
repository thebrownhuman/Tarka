import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { TestAttemptService } from '../../../core/services/test-attempt.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AvailableTest } from '../../../core/models/test.model';
import { storeAttemptProgress } from '../take-test/take-test.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { badgeColorForIndex } from '../../../shared/badge-color.util';

@Component({
  selector: 'app-test-list',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './test-list.component.html',
  styleUrl: './test-list.component.scss',
})
export class TestListComponent implements OnInit {
  private readonly testAttemptService = inject(TestAttemptService);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);

  readonly tests = signal<AvailableTest[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly startingTestId = signal<string | null>(null);

  ngOnInit(): void {
    this.testAttemptService.listAvailableTests().subscribe({
      next: (response) => {
        this.tests.set(response.tests);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load tests. Please try again.');
        this.loading.set(false);
      },
    });
  }

  start(test: AvailableTest): void {
    if (this.startingTestId()) {
      return;
    }
    this.startingTestId.set(test.id);
    this.testAttemptService.startAttempt(test.id).subscribe({
      next: (response) => {
        storeAttemptProgress(response.attemptId, {
          currentQuestionIndex: response.currentQuestionIndex,
          totalQuestions: response.totalQuestions,
        });
        this.router.navigate(['/take-test', response.attemptId]);
      },
      error: (err: unknown) => {
        this.startingTestId.set(null);
        this.errorMessage.set(this.messageFor(err));
      },
    });
  }

  initial(): string {
    return (this.authService.session()?.displayName ?? '?').trim().charAt(0).toUpperCase();
  }

  badgeColor(index: number): string {
    return badgeColorForIndex(index);
  }

  logout(): void {
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/login']),
    });
  }

  private messageFor(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const backendMessage = err.error?.error?.message;
      if (typeof backendMessage === 'string') {
        return backendMessage;
      }
    }
    return 'Could not start the test. Please try again.';
  }
}
