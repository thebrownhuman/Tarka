import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { Candidate } from '../../../core/models/candidate.model';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-candidates',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './candidates.component.html',
  styleUrl: './candidates.component.scss',
})
export class CandidatesComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly formBuilder = inject(FormBuilder);

  readonly items = signal<Candidate[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly createForm = this.formBuilder.group({
    loginId: ['', Validators.required],
    displayName: ['', Validators.required],
  });
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  // One-time-display credential dialog, shared between create and reset flows.
  readonly credentialDialog = signal<{ loginId: string; password: string } | null>(null);
  readonly resettingId = signal<string | null>(null);
  readonly resetError = signal<string | null>(null);

  get hasMore(): boolean {
    return this.offset() + this.items().length < this.total();
  }

  ngOnInit(): void {
    this.loadPage(0);
  }

  loadMore(): void {
    this.loadPage(this.offset() + PAGE_SIZE);
  }

  createCandidate(): void {
    if (this.createForm.invalid || this.creating()) {
      return;
    }
    this.createError.set(null);
    this.creating.set(true);

    const { loginId, displayName } = this.createForm.getRawValue();
    this.adminService.createCandidate(loginId ?? '', displayName ?? '').subscribe({
      next: (response) => {
        this.creating.set(false);
        this.createForm.reset();
        this.credentialDialog.set({ loginId: response.loginId, password: response.password });
        this.loadPage(0);
      },
      error: (err: unknown) => {
        this.creating.set(false);
        this.createError.set(this.messageFor(err));
      },
    });
  }

  resetPassword(candidate: Candidate): void {
    if (this.resettingId()) {
      return;
    }
    this.resetError.set(null);
    this.resettingId.set(candidate.id);

    this.adminService.resetPassword(candidate.id).subscribe({
      next: (response) => {
        this.resettingId.set(null);
        this.credentialDialog.set({ loginId: response.loginId, password: response.password });
      },
      error: (err: unknown) => {
        this.resettingId.set(null);
        this.resetError.set(this.messageFor(err));
      },
    });
  }

  dismissCredentialDialog(): void {
    this.credentialDialog.set(null);
  }

  private loadPage(offset: number): void {
    this.loading.set(true);
    this.adminService.listCandidates(offset, PAGE_SIZE).subscribe({
      next: (response) => {
        this.items.set(offset === 0 ? response.items : [...this.items(), ...response.items]);
        this.total.set(response.total);
        this.offset.set(offset);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load candidates. Please try again.');
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
    return 'Something went wrong. Please try again.';
  }
}
