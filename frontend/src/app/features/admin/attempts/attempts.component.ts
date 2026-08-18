import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { AttemptSummary } from '../../../core/models/attempt-summary.model';
import { AttemptDetailResponse } from '../../../core/models/test-attempt.model';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-attempts',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './attempts.component.html',
  styleUrl: './attempts.component.scss',
})
export class AttemptsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly formBuilder = inject(FormBuilder);

  readonly items = signal<AttemptSummary[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly filterForm = this.formBuilder.group({
    candidateId: [''],
    status: [''],
  });

  readonly expandedId = signal<string | null>(null);
  readonly detail = signal<AttemptDetailResponse | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly releasingId = signal<string | null>(null);
  readonly releaseError = signal<string | null>(null);

  get hasMore(): boolean {
    return this.offset() + this.items().length < this.total();
  }

  ngOnInit(): void {
    this.loadPage(0);
  }

  applyFilters(): void {
    this.loadPage(0);
  }

  loadMore(): void {
    this.loadPage(this.offset() + PAGE_SIZE);
  }

  toggleDetail(attempt: AttemptSummary): void {
    if (this.expandedId() === attempt.id) {
      this.expandedId.set(null);
      this.detail.set(null);
      return;
    }
    this.expandedId.set(attempt.id);
    this.detail.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);

    this.adminService.getAttemptDetail(attempt.id).subscribe({
      next: (response) => {
        this.detail.set(response);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailError.set('Could not load the per-question breakdown for this attempt.');
        this.detailLoading.set(false);
      },
    });
  }

  canRelease(attempt: AttemptSummary): boolean {
    return attempt.status === 'submitted' && !attempt.resultsReleasedAt;
  }

  release(attempt: AttemptSummary): void {
    if (this.releasingId()) {
      return;
    }
    this.releaseError.set(null);
    this.releasingId.set(attempt.id);

    this.adminService.releaseResults(attempt.id).subscribe({
      next: () => {
        this.releasingId.set(null);
        this.loadPage(this.offset());
      },
      error: (err: unknown) => {
        this.releasingId.set(null);
        this.releaseError.set(this.messageFor(err));
      },
    });
  }

  private loadPage(offset: number): void {
    this.loading.set(true);
    const { candidateId, status } = this.filterForm.getRawValue();
    this.adminService
      .listAttempts({ candidateId: candidateId || undefined, status: status || undefined }, offset, PAGE_SIZE)
      .subscribe({
        next: (response) => {
          this.items.set(offset === 0 ? response.items : [...this.items(), ...response.items]);
          this.total.set(response.total);
          this.offset.set(offset);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('Could not load attempts. Please try again.');
          this.loading.set(false);
        },
      });
  }

  private messageFor(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const backendMessage = err.error?.error?.message;
      if (typeof backendMessage === 'string') {
        return backendMessage;
      }
    }
    return 'Could not release results. Please try again.';
  }
}
