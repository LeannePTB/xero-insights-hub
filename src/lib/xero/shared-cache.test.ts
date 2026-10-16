import { describe, it, expect, beforeEach } from "vitest";
import { sharedCacheGet, sharedCacheSet, sharedCacheClearTenant, isSharedCacheable, XERO_SHARED_CACHE_TTL_MS, _sharedCacheReset } from "./shared-cache.server";
import { XERO_FILE_HOUR_CEILING, XERO_FILE_CEILING_MESSAGE } from "./file-ceiling.server";
import { isGateWait, isXeroPaused } from "./live-load";

describe("shared Xero reference cache", () => {
  beforeEach(() => _sharedCacheReset());
  it("expires after 10 minutes", () => {
    sharedCacheSet("t1|Accounts", "t1", { a: 1 }, 0);
    expect(sharedCacheGet("t1|Accounts", XERO_SHARED_CACHE_TTL_MS - 1)).toEqual({ a: 1 });
    expect(sharedCacheGet("t1|Accounts", XERO_SHARED_CACHE_TTL_MS + 1)).toBeUndefined();
    expect(XERO_SHARED_CACHE_TTL_MS).toBe(600_000);
  });
  it("refresh clears only that file", () => {
    sharedCacheSet("t1|Accounts", "t1", 1); sharedCacheSet("t2|Accounts", "t2", 2);
    sharedCacheClearTenant("t1");
    expect(sharedCacheGet("t1|Accounts")).toBeUndefined();
    expect(sharedCacheGet("t2|Accounts")).toBe(2);
  });
  it("never caches transactions or invoices", () => {
    expect(isSharedCacheable("Invoices")).toBe(false);
    expect(isSharedCacheable("BankTransactions")).toBe(false);
    expect(isSharedCacheable("Accounts")).toBe(true);
  });
});

describe("our hourly hold", () => {
  it("is 1,500 calls per file per hour", () => expect(XERO_FILE_HOUR_CEILING).toBe(1500));
  it("reads as a wait, never as Xero pausing", () => {
    expect(isGateWait(XERO_FILE_CEILING_MESSAGE)).toBe(true);
    expect(isXeroPaused(XERO_FILE_CEILING_MESSAGE)).toBe(false);
  });
});
