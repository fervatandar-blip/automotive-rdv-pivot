// Shared surface and type tokens for the client portal, built on the
// semantic colours in app/[lang]/globals.css (canvas < surface < subtle,
// one hairline, ink / ink-muted). Every token works in both themes as is:
// light mode is white cards with a soft shadow on a warm-gray canvas; dark
// mode keeps flat charcoal panels with a hairline and no shadow.

/** Page canvas. */
export const CLIENT_CANVAS = "bg-canvas";

/** Standard scrolling page: canvas plus the portal's page padding. */
export const CLIENT_PAGE = "flex flex-1 flex-col bg-canvas px-4 py-6 sm:px-8 sm:py-8";

/**
 * A page that fits the viewport from md up and scrolls inside its panels
 * instead. Below md the phone header (h-14) and tab bar (h-16 + home
 * indicator) are outside it, and the page scrolls normally.
 */
export const CLIENT_FIT_PAGE =
  "flex flex-col bg-canvas px-4 py-6 sm:px-8 md:h-dvh md:min-h-[36rem] md:py-8";

/** An elevated white card. Add padding (CLIENT_CARD_PAD) and layout per use. */
export const CLIENT_CARD =
  "rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none";

/** Kept for existing imports: every region is a card. */
export const CLIENT_SURFACE = CLIENT_CARD;

export const CLIENT_CARD_PAD = "p-5 sm:p-6";

export const CLIENT_CARD_TITLE = "text-lg font-bold tracking-tight text-ink";

/** Secondary metadata under a card title. */
export const CLIENT_META = "text-sm text-ink-muted";

export const CLIENT_PAGE_TITLE = "text-2xl font-bold tracking-tight text-ink sm:text-3xl";

export const CLIENT_PAGE_SUBTITLE = "text-sm text-ink-muted sm:text-[15px]";

/** Heading of a card or a section. */
export const CLIENT_SECTION_LABEL = "text-base font-bold tracking-tight text-ink";

/** Header row of a card: title on the left, an action on the right. */
export const CLIENT_SURFACE_HEADER =
  "flex min-h-14 items-center justify-between gap-3 border-b border-hairline px-5 py-3 sm:px-6";

export const CLIENT_DIVIDE = "divide-y divide-hairline";

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60";

/** Primary call to action: near-black in light mode, near-white in dark. */
export const CLIENT_PRIMARY_BUTTON = `${BUTTON_BASE} bg-ink px-5 text-surface hover:bg-ink/85 focus-visible:ring-ink/40`;

/** White button with a hairline, for secondary actions in headers. */
export const CLIENT_SECONDARY_BUTTON = `${BUTTON_BASE} border border-hairline bg-surface text-ink hover:bg-subtle focus-visible:ring-ink/30`;

/** Tinted button for everyday card actions (Message, Reschedule...). */
export const CLIENT_TINTED_PILL = `${BUTTON_BASE} bg-subtle text-ink hover:bg-hairline focus-visible:ring-ink/30`;

export const CLIENT_PILL_ICON = "h-4 w-4 shrink-0 text-ink-muted";

/** Ghost red button, same box as the others, for destructive actions. */
export const CLIENT_DANGER_PILL = `${BUTTON_BASE} text-red-600 hover:bg-red-50 focus-visible:ring-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10`;

/** Square icon button (edit, delete) inside cards. */
export const CLIENT_ICON_BUTTON =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30";

/** Quiet text link with an optional trailing arrow. */
export const CLIENT_TEXT_LINK =
  "inline-flex items-center gap-1 text-sm font-semibold text-ink-muted transition-colors hover:text-ink";

/** A row inside a card that is itself a link or hover target. */
export const CLIENT_ROW_HOVER = "transition-colors hover:bg-subtle/70";

/** Category / tag pill. */
export const CLIENT_TAG = "inline-flex items-center rounded-full bg-subtle px-3 py-1 text-xs font-medium text-ink";

/** Segmented control (tabs) container and its items. */
export const CLIENT_SEGMENTED = "inline-flex rounded-xl border border-zinc-200/70 bg-surface p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none";
export const CLIENT_SEGMENT = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors";
export const CLIENT_SEGMENT_ACTIVE = "bg-ink text-surface";
export const CLIENT_SEGMENT_IDLE = "text-ink-muted hover:bg-subtle hover:text-ink";
