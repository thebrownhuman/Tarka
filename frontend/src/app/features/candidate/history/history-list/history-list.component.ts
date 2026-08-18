import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TestAttemptService } from '../../../../core/services/test-attempt.service';
import { AttemptHistoryItem } from '../../../../core/models/test-attempt.model';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './history-list.component.html',
  styleUrl: './history-list.component.scss',
})
export class HistoryListComponent implements OnInit {
  private readonly testAttemptService = inject(TestAttemptService);

  readonly items = signal<AttemptHistoryItem[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  get hasMore(): boolean {
    return this.offset() + this.items().length < this.total();
  }

  ngOnInit(): void {
    this.loadPage(0);
  }

  loadMore(): void {
    this.loadPage(this.offset() + PAGE_SIZE);
  }

  private loadPage(offset: number): void {
    this.loading.set(true);
    this.testAttemptService.listHistory(offset, PAGE_SIZE).subscribe({
      next: (response) => {
        this.items.set(offset === 0 ? response.items : [...this.items(), ...response.items]);
        this.total.set(response.total);
        this.offset.set(offset);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load your history. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
