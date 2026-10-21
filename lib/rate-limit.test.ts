import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";

// No UPSTASH_REDIS_REST_URL/TOKEN are set in this test environment, so
// checkRateLimit's module-level `redis` is null and every call here
// exercises the in-memory fallback path specifically. See
// rate-limit.distributed.test.ts for the Redis-backed path -- it needs
// those env vars set *before* this module is first imported, which a
// separate test file (importing its own fresh module instance) is the
// clean way to arrange.
//
// checkRateLimit tracks state in a module-level Map that isn't reset
// between tests, so every test uses its own unique key prefix rather than
// relying on isolation the module doesn't provide.
let keyCounter = 0;
function uniqueKey() {
  keyCounter += 1;
  return `test-key-${keyCounter}`;
}

describe("checkRateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calls up to the limit within the window", async () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit(key, 5, 60_000)).toBe(true);
    }
  });

  it("blocks a call once the limit is exceeded within the window", async () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, 5, 60_000);
    }
    // 6th call in the same window exceeds the limit of 5.
    expect(await checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it("keeps blocking on repeated calls after the limit is hit, within the same window", async () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, 5, 60_000);
    }
    expect(await checkRateLimit(key, 5, 60_000)).toBe(false);
    expect(await checkRateLimit(key, 5, 60_000)).toBe(false);
    expect(await checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it("resets and allows calls again once the window has elapsed", async () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, 5, 60_000);
    }
    expect(await checkRateLimit(key, 5, 60_000)).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(await checkRateLimit(key, 5, 60_000)).toBe(true);
  });

  it("tracks separate keys independently", async () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();

    for (let i = 0; i < 5; i++) {
      await checkRateLimit(keyA, 5, 60_000);
    }
    expect(await checkRateLimit(keyA, 5, 60_000)).toBe(false);

    // keyB has never been called -- must not be affected by keyA's usage.
    expect(await checkRateLimit(keyB, 5, 60_000)).toBe(true);
  });

  it("supports a limit of 1 (blocks on the second call)", async () => {
    const key = uniqueKey();
    expect(await checkRateLimit(key, 1, 60_000)).toBe(true);
    expect(await checkRateLimit(key, 1, 60_000)).toBe(false);
  });
});
