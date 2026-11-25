// Launch switches. Flip a flag here to turn a feature back on everywhere.

/**
 * Reviews and ratings are off for launch: no stars on workshop cards or
 * profiles, no rating filter or sort, no review form for clients, and the
 * workshop Reviews page is not reachable. Existing rows in `reviews` are
 * kept untouched, so turning this back on restores everything.
 */
export const REVIEWS_ENABLED = false;
