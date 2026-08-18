import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TestAttemptService } from '../../../core/services/test-attempt.service';
import { CandidateQuestion, QuestionResponse, QuestionType } from '../../../core/models/question.model';
import { SubmitTestResponse } from '../../../core/models/test-attempt.model';
import { IconComponent } from '../../../shared/icon/icon.component';

// Cosmetic tick rate for the client-side countdown display; the real value is
// always re-synced from the server's remainingSeconds on every API response.
const TICK_INTERVAL_MS = 1000;
// How often to check whether a pending extension has been approved while the
// candidate is locked out after time runs out.
const EXTENSION_POLL_INTERVAL_MS = 15000;

interface AttemptProgress {
  currentQuestionIndex: number;
  totalQuestions: number;
}

function progressKey(attemptId: string): string {
  return `tarka_attempt_progress_${attemptId}`;
}

export function storeAttemptProgress(attemptId: string, progress: AttemptProgress): void {
  sessionStorage.setItem(progressKey(attemptId), JSON.stringify(progress));
}

function readAttemptProgress(attemptId: string): AttemptProgress {
  const raw = sessionStorage.getItem(progressKey(attemptId));
  if (!raw) {
    return { currentQuestionIndex: 0, totalQuestions: 0 };
  }
  try {
    return JSON.parse(raw) as AttemptProgress;
  } catch {
    return { currentQuestionIndex: 0, totalQuestions: 0 };
  }
}

@Component({
  selector: 'app-take-test',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './take-test.component.html',
  styleUrl: './take-test.component.scss',
})
export class TakeTestComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly testAttemptService = inject(TestAttemptService);

  private attemptId = '';
  private tickIntervalId?: ReturnType<typeof setInterval>;
  private pollIntervalId?: ReturnType<typeof setInterval>;

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly closedReason = signal<'submitted' | null>(null);

  readonly totalQuestions = signal(0);
  readonly currentQuestionIndex = signal(0);
  readonly viewingIndex = signal(0);
  readonly question = signal<CandidateQuestion | null>(null);
  readonly remainingSeconds = signal(0);
  readonly remainingLabel = computed(() => {
    const total = Math.max(0, this.remainingSeconds());
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });
  readonly selectedOptionIds = signal<string[]>([]);

  readonly savingAnswer = signal(false);
  readonly advancing = signal(false);
  readonly completed = signal(false);

  readonly requestingExtension = signal(false);
  readonly extensionRequested = signal(false);
  readonly extensionErrorMessage = signal<string | null>(null);

  readonly submittingTest = signal(false);
  readonly submitResult = signal<SubmitTestResponse | null>(null);
  readonly showSubmitConfirm = signal(false);

  get isTimesUp(): boolean {
    return this.remainingSeconds() <= 0;
  }

  get isViewingCurrent(): boolean {
    return this.viewingIndex() === this.currentQuestionIndex();
  }

  get questionNumbers(): number[] {
    return Array.from({ length: this.totalQuestions() }, (_, i) => i);
  }

  ngOnInit(): void {
    this.attemptId = this.route.snapshot.paramMap.get('attemptId') ?? '';
    const progress = readAttemptProgress(this.attemptId);
    this.totalQuestions.set(progress.totalQuestions);
    this.currentQuestionIndex.set(progress.currentQuestionIndex);
    this.viewingIndex.set(progress.currentQuestionIndex);

    this.loadCurrentQuestion(true);
    this.tickIntervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId);
    }
    this.stopPolling();
  }

  selectSingle(optionId: string): void {
    if (!this.canEdit()) {
      return;
    }
    this.selectedOptionIds.set([optionId]);
    this.saveAnswer();
  }

  toggleMulti(optionId: string, checked: boolean): void {
    if (!this.canEdit()) {
      return;
    }
    const current = this.selectedOptionIds();
    const next = checked ? [...current, optionId] : current.filter((id) => id !== optionId);
    this.selectedOptionIds.set(next);
    this.saveAnswer();
  }

  isSelected(optionId: string): boolean {
    return this.selectedOptionIds().includes(optionId);
  }

  goToQuestion(index: number): void {
    if (index > this.currentQuestionIndex() || index === this.viewingIndex() || this.isTimesUp || this.completed()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.testAttemptService.getQuestionAt(this.attemptId, index).subscribe({
      next: (response) => {
        this.viewingIndex.set(index);
        this.applyQuestionResponse(response);
        this.loading.set(false);
      },
      error: (err: unknown) => this.handleAttemptError(err),
    });
  }

  next(): void {
    if (this.advancing() || !this.isViewingCurrent || this.isTimesUp) {
      return;
    }

    this.advancing.set(true);
    this.errorMessage.set(null);
    this.testAttemptService.advanceNext(this.attemptId).subscribe({
      next: (response) => {
        this.currentQuestionIndex.set(response.currentQuestionIndex);
        this.completed.set(response.completed);
        storeAttemptProgress(this.attemptId, {
          currentQuestionIndex: response.currentQuestionIndex,
          totalQuestions: this.totalQuestions(),
        });

        if (response.completed) {
          this.advancing.set(false);
          this.question.set(null);
          return;
        }

        this.viewingIndex.set(response.currentQuestionIndex);
        this.loadCurrentQuestion(false, () => this.advancing.set(false));
      },
      error: (err: unknown) => {
        this.advancing.set(false);
        this.handleAttemptError(err);
      },
    });
  }

  requestExtension(): void {
    if (this.requestingExtension() || this.extensionRequested()) {
      return;
    }
    this.requestingExtension.set(true);
    this.extensionErrorMessage.set(null);
    this.testAttemptService.requestExtension(this.attemptId).subscribe({
      next: () => {
        this.requestingExtension.set(false);
        this.extensionRequested.set(true);
        this.startPolling();
      },
      error: (err: unknown) => {
        this.requestingExtension.set(false);
        this.extensionErrorMessage.set(this.messageFor(err));
      },
    });
  }

  confirmSubmit(): void {
    if (this.submittingTest()) {
      return;
    }
    this.showSubmitConfirm.set(true);
  }

  cancelSubmit(): void {
    this.showSubmitConfirm.set(false);
  }

  proceedSubmit(): void {
    this.showSubmitConfirm.set(false);
    this.submitTest();
  }

  backToTests(): void {
    this.router.navigate(['/tests']);
  }

  private canEdit(): boolean {
    return !this.isTimesUp && !this.completed() && !this.submitResult();
  }

  private saveAnswer(): void {
    const question = this.question();
    if (!question) {
      return;
    }
    this.savingAnswer.set(true);
    this.testAttemptService.submitAnswer(this.attemptId, question.id, this.selectedOptionIds()).subscribe({
      next: () => this.savingAnswer.set(false),
      error: (err: unknown) => {
        this.savingAnswer.set(false);
        this.handleAttemptError(err);
      },
    });
  }

  private submitTest(): void {
    this.submittingTest.set(true);
    this.errorMessage.set(null);
    this.testAttemptService.submitTest(this.attemptId).subscribe({
      next: (response) => {
        this.submittingTest.set(false);
        this.submitResult.set(response);
        sessionStorage.removeItem(progressKey(this.attemptId));
      },
      error: (err: unknown) => {
        this.submittingTest.set(false);
        this.errorMessage.set(this.messageFor(err));
      },
    });
  }

  private loadCurrentQuestion(initialLoad: boolean, onDone?: () => void): void {
    this.testAttemptService.getCurrentQuestion(this.attemptId).subscribe({
      next: (response) => {
        this.viewingIndex.set(this.currentQuestionIndex());
        this.applyQuestionResponse(response);
        this.loading.set(false);
        onDone?.();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        onDone?.();
        this.handleAttemptError(err, initialLoad);
      },
    });
  }

  private applyQuestionResponse(response: QuestionResponse): void {
    this.question.set({
      id: response.id,
      questionText: response.questionText,
      imageUrl: response.imageUrl,
      options: response.options,
      questionType: response.questionType as QuestionType,
      selectedOptionIds: response.selectedOptionIds,
      passageText: response.passageText,
    });
    this.selectedOptionIds.set(response.selectedOptionIds ?? []);
    this.remainingSeconds.set(response.remainingSeconds);

    if (response.remainingSeconds > 0 && this.pollIntervalId) {
      // Extension came through - resume normally.
      this.stopPolling();
      this.extensionRequested.set(false);
    }
  }

  private tick(): void {
    if (this.remainingSeconds() <= 0) {
      return;
    }
    this.remainingSeconds.set(Math.max(0, this.remainingSeconds() - 1));
    if (this.remainingSeconds() <= 0) {
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.pollIntervalId) {
      return;
    }
    this.pollIntervalId = setInterval(() => {
      this.testAttemptService.getCurrentQuestion(this.attemptId).subscribe({
        next: (response) => this.applyQuestionResponse(response),
        // Expired-attempt errors are expected while waiting for approval -
        // just keep polling silently.
        error: () => undefined,
      });
    }, EXTENSION_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = undefined;
    }
  }

  private handleAttemptError(err: unknown, initialLoad = false): void {
    if (err instanceof HttpErrorResponse) {
      const code = err.error?.error?.code;
      if (code === 'TEST_ATTEMPT_ALREADY_SUBMITTED') {
        this.closedReason.set('submitted');
        return;
      }
      if (code === 'TEST_ATTEMPT_EXPIRED') {
        this.remainingSeconds.set(0);
        if (initialLoad) {
          this.startPolling();
        }
        return;
      }
    }
    this.errorMessage.set(this.messageFor(err));
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
