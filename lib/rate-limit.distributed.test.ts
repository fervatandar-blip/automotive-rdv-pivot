import { beforeEach, describe, expect, it, vi } from "vitest";

// checkRateLimit decides whether to use Redis at module-import time (a
// module-level `const redis = process.env.X && process.env.Y ? new Redis(...)
// : null`), so these env vars must be set BEFORE that module is first
// imported. Vitest isolates modules per test file by default, so this file
// gets its own fresh instance of lib/rate-limit.ts with Redis configured,
// independent of rate-limit.test.ts's (unset-env, in-memory-only) instance.
process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.example";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

// Minimal fake backing store: tracks a value and whether it's still
// "unexpired" well enough to exercise the real SET-NX-PX-then-INCR logic
// in lib/rate-limit.ts, without needing real TTL expiry (these tests don't
// need to test Redis's own expiry behavior, only that our code calls set/
// incr correctly and interprets their results correctly).
let store = new Map<string, number>();
let setShouldThrow = false;
let incrShouldThrow = false;

const fakeSet = vi.fn(
  async (key: string, value: number, opts: { nx?: boolean; px?: number }) => {
    if (setShouldThrow) throw new Error("simulated Redis outage");
    if (opts.nx && store.has(key)) {
      return null; // NX: key already exists, SET is a no-op
    }
    store.set(key, value);
    return "OK";
  }
);

const fakeIncr = vi.fn(async (key: string) => {
  if (incrShouldThrow) throw new Error("simulated Redis outage");
  const next = (store.get(key) ?? 0) + 1;
  store.set(key, next);
  return next;
});

vi.mock("@upstash/redis", () => ({
  Redis: class {
    set = fakeSet;
    incr = fakeIncr;
  },
}));

const { checkRateLimit } = await import("./rate-limit");

let keyCounter = 0;
function uniqueKey() {
  keyCounter += 1;
  return `dist-test-key-${keyCounter}`;
}

beforeEach(() => {
  store = new Map();
  setShouldThrow = false;
  incrShouldThrow = false;
  fakeSet.mockClear();
  fakeIncr.mockClear();
});

describe("checkRateLimit (distributed, Redis configured)", () => {
  it("uses SET NX PX for the first call in a window -- never calls INCR for it", async () => {
    const key = uniqueKey();
    const allowed = await checkRateLimit(key, 5, 60_000);

    expect(allowed).toBe(true);
    expect(fakeSet).toHaveBeenCalledWith(key, 1, { nx: true, px: 60_000 });
    expect(fakeIncr).not.toHaveBeenCalled();
  });

  it("falls through to INCR for subsequent calls once the key exists", async () => {
    const key = uniqueKey();
    await checkRateLimit(key, 5, 60_000);

    const second = await checkRateLimit(key, 5, 60_000);

    expect(second).toBe(true);
    expect(fakeIncr).toHaveBeenCalledWith(key);
  });

  it("blocks once INCR's count exceeds the limit", async () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, 5, 60_000);
    }

    expect(await checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it("falls back to the in-memory limiter if Redis SET throws (fails open, not closed)", async () => {
    setShouldThrow = true;
    const key = uniqueKey();

    // Despite Redis being unreachable, the request is still allowed --
    // a Redis outage must not take down every rate-limited public
    // endpoint platform-wide.
    const allowed = await checkRateLimit(key, 5, 60_000);
    expect(allowed).toBe(true);
  });

  it("falls back to the in-memory limiter if Redis INCR throws", async () => {
    const key = uniqueKey();
    await checkRateLimit(key, 5, 60_000); // first call succeeds via SET NX

    incrShouldThrow = true;
    const allowed = await checkRateLimit(key, 5, 60_000);
    expect(allowed).toBe(true);
  });
});
