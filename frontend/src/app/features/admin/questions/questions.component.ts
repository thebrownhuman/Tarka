import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { AdminQuestion, QuestionDifficulty, UploadQuestionInput } from '../../../core/models/question.model';
import { IconComponent } from '../../../shared/icon/icon.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-questions',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './questions.component.html',
  styleUrl: './questions.component.scss',
})
export class QuestionsComponent implements OnInit {
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
    difficulty: [''],
  });

  readonly uploading = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<number | null>(null);
  readonly selectedFileName = signal<string | null>(null);

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

  truncate(text: string, max = 90): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.selectedFileName.set(file.name);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      this.uploadFromText(typeof reader.result === 'string' ? reader.result : '');
      input.value = '';
    };
    reader.onerror = () => {
      this.uploadError.set('Could not read that file. Please try again.');
      input.value = '';
    };
    reader.readAsText(file);
  }

  private uploadFromText(rawText: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      this.uploadError.set('That file is not valid JSON.');
      return;
    }

    const questions: UploadQuestionInput[] = Array.isArray(parsed) ? parsed : (parsed as { questions?: UploadQuestionInput[] })?.questions ?? [];
    if (!Array.isArray(questions) || questions.length === 0) {
      this.uploadError.set('Expected either a JSON array of questions, or an object with a "questions" array.');
      return;
    }

    this.uploading.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    this.adminService.uploadQuestions(questions).subscribe({
      next: (response) => {
        this.uploading.set(false);
        this.uploadSuccess.set(response.inserted);
        this.loadPage(0);
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.uploadError.set(this.messageFor(err));
      },
    });
  }

  private loadPage(offset: number): void {
    this.loading.set(true);
    const { domain, topic, difficulty } = this.filterForm.getRawValue();
    this.adminService
      .listQuestions(
        {
          domain: domain || undefined,
          topic: topic || undefined,
          difficulty: (difficulty || undefined) as QuestionDifficulty | undefined,
        },
        offset,
        PAGE_SIZE,
      )
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
    return 'Upload failed. Please check the file and try again.';
  }
}
