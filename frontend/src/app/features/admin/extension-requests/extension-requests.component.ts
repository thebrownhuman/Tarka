import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { ExtensionRequestItem, ExtensionRequestStatus } from '../../../core/models/extension-request.model';
import { IconComponent } from '../../../shared/icon/icon.component';

const PAGE_SIZE = 20;

type TabFilter = ExtensionRequestStatus;

@Component({
  selector: 'app-admin-extension-requests',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, IconComponent],
  templateUrl: './extension-requests.component.html',
  styleUrl: './extension-requests.component.scss',
})
export class ExtensionRequestsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly tab = signal<TabFilter>('pending');
  readonly items = signal<ExtensionRequestItem[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // requestId -> granted seconds input value, kept in a plain object since
  // ngModel needs a two-way bindable target per row.
  readonly grantSeconds: Record<string, number | null> = {};
  readonly adminNotes: Record<string, string> = {};
  readonly actingId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  get hasMore(): boolean {
    return this.offset() + this.items().length < this.total();
  }

  ngOnInit(): void {
    this.loadPage(0);
  }

  selectTab(tab: TabFilter): void {
    if (this.tab() === tab) {
      return;
    }
    this.tab.set(tab);
    this.loadPage(0);
  }

  loadMore(): void {
    this.loadPage(this.offset() + PAGE_SIZE);
  }

  approve(item: ExtensionRequestItem): void {
    if (this.actingId()) {
      return;
    }
    const granted = this.grantSeconds[item.id];
    if (!granted || granted <= 0) {
      this.actionError.set('Enter how many seconds to grant before approving.');
      return;
    }
    this.actionError.set(null);
    this.actingId.set(item.id);

    this.adminService.approveExtension(item.id, granted).subscribe({
      next: () => {
        this.actingId.set(null);
        this.loadPage(this.offset());
      },
      error: (err: unknown) => {
        this.actingId.set(null);
        this.actionError.set(this.messageFor(err));
      },
    });
  }

  deny(item: ExtensionRequestItem): void {
    if (this.actingId()) {
      return;
    }
    this.actionError.set(null);
    this.actingId.set(item.id);

    this.adminService.denyExtension(item.id, this.adminNotes[item.id] || undefined).subscribe({
      next: () => {
        this.actingId.set(null);
        this.loadPage(this.offset());
      },
      error: (err: unknown) => {
        this.actingId.set(null);
        this.actionError.set(this.messageFor(err));
      },
    });
  }

  private loadPage(offset: number): void {
    this.loading.set(true);

    this.adminService.listExtensionRequests(this.tab(), offset, PAGE_SIZE).subscribe({
      next: (response) => {
        this.items.set(offset === 0 ? response.items : [...this.items(), ...response.items]);
        this.total.set(response.total);
        this.offset.set(offset);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load extension requests. Please try again.');
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
