import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="theme-toggle"
      (click)="themeService.toggle()"
      [attr.aria-label]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      [attr.aria-pressed]="themeService.theme() === 'dark'"
    >
      @if (themeService.theme() === 'dark') {
        <app-icon name="sun" [size]="18" />
      } @else {
        <app-icon name="moon" [size]="18" />
      }
    </button>
  `,
  styles: [
    `
      .theme-toggle {
        position: fixed;
        bottom: var(--space-lg);
        right: var(--space-lg);
        z-index: 200;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-ink);
        box-shadow: var(--shadow-md);
        cursor: pointer;
        transition: transform var(--transition-md), box-shadow var(--transition-md), background-color var(--transition-fast),
          color var(--transition-fast);

        &:hover {
          transform: translateY(-2px) rotate(-8deg);
          box-shadow: var(--shadow-lg);
        }

        &:active {
          transform: translateY(0) scale(0.94);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .theme-toggle:hover,
        .theme-toggle:active {
          transform: none;
        }
      }
    `,
  ],
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);
}
