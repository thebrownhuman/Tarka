import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TestAttemptService } from '../../../../core/services/test-attempt.service';
import { AttemptDetailResponse } from '../../../../core/models/test-attempt.model';

@Component({
  selector: 'app-history-detail',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './history-detail.component.html',
  styleUrl: './history-detail.component.scss',
})
export class HistoryDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly testAttemptService = inject(TestAttemptService);

  readonly loading = signal(true);
  readonly detail = signal<AttemptDetailResponse | null>(null);
  readonly pendingRelease = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const attemptId = this.route.snapshot.paramMap.get('attemptId') ?? '';
    this.testAttemptService.getHistoryDetail(attemptId).subscribe({
      next: (response) => {
        this.detail.set(response);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof HttpErrorResponse && err.error?.error?.code === 'RESULTS_NOT_YET_RELEASED') {
          this.pendingRelease.set(true);
          return;
        }
        this.errorMessage.set('Could not load this attempt. Please try again.');
      },
    });
  }
}
