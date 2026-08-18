const BADGE_COLORS = ['indigo', 'pink', 'amber', 'emerald', 'cyan', 'violet', 'rose', 'teal'] as const;

/** Cycles through the app's accent spectrum so a grid of cards (tests, history
 * entries, etc.) reads as varied rather than a wall of identical icon badges. */
export function badgeColorForIndex(index: number): string {
  return BADGE_COLORS[index % BADGE_COLORS.length];
}
