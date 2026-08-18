import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { AdminQuestion } from '../../../core/models/question.model';
import { CreateTestResponse } from '../../../core/models/test.model';

const PAGE_SIZE = 20;
const SECONDS_PER_MINUTE = 60;

@Component({
  selector: 'app-admin-tests',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './tests.component.html',
  styleUrl: './tests.component.scss',
})
export class TestsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly formBuilder = inject(FormBuilder);

  readonly items = signal<AdminQuestion[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly filterForm = this.formBuilder.group({
    domain: [''],
    topic: [''],
  });

  // Selected question ids, in the order they were clicked - this becomes the
  // test's question order. A Map keeps insertion order and O(1) toggling.
  readonly selectedIds = signal<string[]>([]);
  readonly selectedTitles = signal<Map<string, string>>(new Map());

  readonly testForm = this.formBuilder.group({
    title: ['', Validators.required],
    durationMinutes: [30, [Validators.required, Validators.min(1)]],
  });
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly created = signal<CreateTestResponse | null>(null);

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

  isSelected(questionId: string): boolean {
    return this.selectedIds().includes(questionId);
  }

  toggleQuestion(question: AdminQuestion): void {
    const current = this.selectedIds();
    if (current.includes(question.id)) {
      this.selectedIds.set(current.filter((id) => id !== question.id));
      return;
    }
    this.selectedIds.set([...current, question.id]);
    const titles = new Map(this.selectedTitles());
    titles.set(question.id, question.questionText);
    this.selectedTitles.set(titles);
  }

  removeSelected(questionId: string): void {
    this.selectedIds.set(this.selectedIds().filter((id) => id !== questionId));
  }

  titleFor(questionId: string): string {
    return this.selectedTitles().get(questionId) ?? questionId;
  }

  createTest(): void {
    if (this.testForm.invalid || this.selectedIds().length === 0 || this.creating()) {
      return;
    }
    this.createError.set(null);
    this.creating.set(true);

    const { title, durationMinutes } = this.testForm.getRawValue();
    const durationSeconds = (durationMinutes ?? 0) * SECONDS_PER_MINUTE;

    this.adminService.createTest(title ?? '', durationSeconds, this.selectedIds()).subscribe({
      next: (response) => {
        this.creating.set(false);
        this.created.set(response);
        this.testForm.reset({ title: '', durationMinutes: 30 });
        this.selectedIds.set([]);
        this.selectedTitles.set(new Map());
      },
      error: (err: unknown) => {
        this.creating.set(false);
        this.createError.set(this.messageFor(err));
      },
    });
  }

  private loadPage(offset: number): void {
    this.loading.set(true);
    const { domain, topic } = this.filterForm.getRawValue();
    this.adminService
      .listQuestions({ domain: domain || undefined, topic: topic || undefined }, offset, PAGE_SIZE)
      .subscribe({
        next: (response) => {
          this.items.set(offset === 0 ? response.items : [...this.items(), ...response.items]);
          this.total.set(response.total);
          this.offset.set(offset);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('Could not load questions. Please try again.');
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
    return 'Could not create the test. Please try again.';
  }
}
