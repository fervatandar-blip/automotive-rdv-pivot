// The real "server-only" package throws on import unless resolved under
// Next's own server bundler (its "react-server" export condition), which
// Vitest doesn't set -- see scripts/seed-test-garage.ts's comment for the
// same issue in a different context. vitest.config.ts aliases "server-only"
// to this no-op so any lib/* file that imports it (lib/rate-limit.ts,
// lib/stripe.ts, etc.) can be unit tested directly.
export {};
