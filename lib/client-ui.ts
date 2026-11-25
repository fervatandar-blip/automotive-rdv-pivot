// Shared surface and type tokens for the client portal. Light mode layers
// white cards on a zinc-50 canvas with a hairline border and a barely-there
// shadow; dark mode keeps the near-black canvas with translucent panels.

/** Page canvas, below the white top bar and next to the white sidebar. */
export const CLIENT_CANVAS = "bg-zinc-50 dark:bg-black";

/** Standard page wrapper: canvas plus the portal's page padding. */
export const CLIENT_PAGE = `flex flex-1 flex-col ${CLIENT_CANVAS} px-4 py-8 sm:px-8 sm:py-10`;

/** A content card. Add padding and layout per use. */
export const CLIENT_CARD =
  "rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:shadow-none";

export const CLIENT_PAGE_TITLE =
  "text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl";

export const CLIENT_PAGE_SUBTITLE = "text-sm text-zinc-500 dark:text-zinc-400";

// zinc-500, not zinc-400: 11px text on the zinc-50 canvas needs the darker
// shade to stay above the WCAG AA 4.5:1 contrast ratio.
export const CLIENT_SECTION_LABEL =
  "text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";

export const CLIENT_DIVIDE = "divide-y divide-zinc-200/80 dark:divide-zinc-800/60";

/** Tinted, borderless pill for everyday card actions (Message, Reschedule...). */
export const CLIENT_TINTED_PILL =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

export const CLIENT_PILL_ICON = "h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400";

/** Ghost red pill, same box as CLIENT_TINTED_PILL, for destructive actions. */
export const CLIENT_DANGER_PILL =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10";

/** Square icon button (edit, delete) inside cards. */
export const CLIENT_ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50";
