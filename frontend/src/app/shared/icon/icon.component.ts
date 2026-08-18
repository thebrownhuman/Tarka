import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Names are deliberately narrow (only what the app actually uses) rather than
 * a general-purpose icon library — keeps the bundle small and every icon
 * reviewed for stroke-weight consistency at 24x24/1.75.
 */
export type IconName =
  | 'brand'
  | 'users'
  | 'upload'
  | 'list-checks'
  | 'clipboard-list'
  | 'clock'
  | 'log-out'
  | 'chevron-left'
  | 'chevron-right'
  | 'plus'
  | 'eye'
  | 'eye-off'
  | 'check-circle'
  | 'x-circle'
  | 'alert-triangle'
  | 'inbox'
  | 'search'
  | 'trash'
  | 'history'
  | 'file-question'
  | 'sun'
  | 'moon';

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="app-icon"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name()) {
        @case ('brand') {
          <path d="M4 7h16M4 12h16M9 17h6" />
        }
        @case ('users') {
          <path
            d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.36M14.5 4.13a3.5 3.5 0 0 1 0 6.74"
          />
          <circle cx="9" cy="7.5" r="3.25" />
        }
        @case ('upload') {
          <path d="M12 16V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        }
        @case ('list-checks') {
          <path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9" />
        }
        @case ('clipboard-list') {
          <path
            d="M9 4.5h6a1 1 0 0 1 1 1V6h1.5A1.5 1.5 0 0 1 19 7.5v11A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-11A1.5 1.5 0 0 1 6.5 6H8v-.5a1 1 0 0 1 1-1Z"
          />
          <path d="M8.5 11h7M8.5 14.5h7M8.5 17.5h4" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="8.25" />
          <path d="M12 7.5V12l3 2" />
        }
        @case ('log-out') {
          <path d="M15 17.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1.5" />
          <path d="M20 12H9.5M20 12l-3-3M20 12l-3 3" />
        }
        @case ('chevron-left') {
          <path d="M15 5l-7 7 7 7" />
        }
        @case ('chevron-right') {
          <path d="M9 5l7 7-7 7" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('eye') {
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.75" />
        }
        @case ('eye-off') {
          <path
            d="M3.5 3.5l17 17M9.9 9.9a2.75 2.75 0 0 0 3.9 3.9M6.2 6.5C4 8.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.7 0 3.1-.5 4.3-1.2M10.6 5.7A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.8 15.8 0 0 1-2.9 3.7"
          />
        }
        @case ('check-circle') {
          <circle cx="12" cy="12" r="8.25" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5.5" />
        }
        @case ('x-circle') {
          <circle cx="12" cy="12" r="8.25" />
          <path d="m9.25 9.25 5.5 5.5M14.75 9.25l-5.5 5.5" />
        }
        @case ('alert-triangle') {
          <path d="M12 4.5 21.5 20h-19L12 4.5Z" />
          <path d="M12 10v3.5M12 16.5h.01" />
        }
        @case ('inbox') {
          <path d="M4 12.5h4.2l1.2 2.5h5.2l1.2-2.5H20" />
          <path d="M5.5 6h13l1.5 6.5v6a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5v-6L5.5 6Z" />
        }
        @case ('search') {
          <circle cx="10.5" cy="10.5" r="6.25" />
          <path d="m19 19-4.3-4.3" />
        }
        @case ('trash') {
          <path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M18 7l-.7 12a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 7" />
        }
        @case ('history') {
          <path d="M4 12a8 8 0 1 0 2.6-5.9" />
          <path d="M4 4.5V9h4.5M12 8v4.5l3 2" />
        }
        @case ('file-question') {
          <path d="M8 3.5h6l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5Z" />
          <path d="M14 3.5V8h4.5" />
          <path d="M10.3 12.2a1.7 1.7 0 1 1 2.5 1.5c-.7.4-1.1.8-1.1 1.6M11.7 17.5h.01" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4.25" />
          <path
            d="M12 2.5v2.25M12 19.25v2.25M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.25M19.25 12h2.25M4.4 19.6l1.6-1.6M18 6l1.6-1.6"
          />
        }
        @case ('moon') {
          <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
      }

      .app-icon {
        display: block;
        flex-shrink: 0;
      }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<number>(20);
}
