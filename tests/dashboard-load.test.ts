import { describe, expect, it } from 'vitest';
import { niceTicks } from '../src/lib/charts/geometry';
import { xeroRetry, xeroRetryDelay, staggered, _liveLoadState, GATE_WAIT_RETRIES, PAUSED_RETRY_MS } from '../src/lib/xero/live-load';
import { MIN_TREND_POINTS } from '../src/components/charts/StandardHistoryChart';

const gateWait = new Error('Waiting for Xero — loading shortly.');
const paused = new Error('Xero has paused requests for this organisation because too many were sent. Wait about a minute, then try again.');

describe('live Xero card loading', () => {
  it('a hold by our own gate retries automatically instead of erroring', () => {
    expect(xeroRetry(0, gateWait)).toBe(true);
    expect(xeroRetry(GATE_WAIT_RETRIES - 1, gateWait)).toBe(true);
    expect(xeroRetry(GATE_WAIT_RETRIES, gateWait)).toBe(false);
  });
  it('a real Xero pause retries once, after a minute', () => {
    expect(xeroRetry(0, paused)).toBe(true);
    expect(xeroRetry(1, paused)).toBe(false);
    expect(xeroRetryDelay(0, paused)).toBe(PAUSED_RETRY_MS);
  });
  it('other errors are not retried', () => {
    expect(xeroRetry(0, new Error('Xero reconnect required'))).toBe(false);
  });
  it('starts at most two card loads at a time', async () => {
    const releases: (() => void)[] = [];
    const jobs = Array.from({ length: 5 }, () => staggered(() => new Promise<void>(r => releases.push(r))));
    await Promise.resolve();
    expect(_liveLoadState()).toEqual({ active: 2, queued: 3 });
    while (releases.length) { releases.shift()!(); await new Promise(r => setTimeout(r, 0)); }
    await Promise.all(jobs);
    expect(_liveLoadState()).toEqual({ active: 0, queued: 0 });
  });
});

describe('chart axis ticks', () => {
  it('uses rounded steps that include zero (cash -8.7K to +5.2K)', () => {
    expect(niceTicks(-8703.2, 5235.51)).toEqual([-10000, -5000, 0, 5000, 10000]);
  });
  it('positive-only data starts at zero', () => {
    expect(niceTicks(120, 930)).toEqual([0, 250, 500, 750, 1000]);
  });
});

describe('receivables overdue trend', () => {
  it('needs at least 3 stored points before drawing', () => {
    expect(MIN_TREND_POINTS).toBe(3);
  });
});
