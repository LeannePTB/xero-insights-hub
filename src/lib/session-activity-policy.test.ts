import { describe, expect, it } from "vitest";
import {
  deadlineFromServerTouch,
  shouldHeartbeat,
} from "@/lib/session-activity-policy";
import { INACTIVITY_WINDOW_MS } from "@/lib/session-cutoff";

const MIN = 60_000;

/** Simulates the browser guard and the server window together. */
function simulate(events: { at: number; hidden?: boolean }[], until: number) {
  let lastTouch = 0; // sign-in counts as activity on the server
  let deadline = deadlineFromServerTouch(0);
  let signedOutAt: number | null = null;
  let serverRefusedAt: number | null = null;
  let i = 0;
  for (let t = 0; t <= until; t += 5_000) {
    while (i < events.length && events[i].at <= t) {
      const e = events[i++];
      if (shouldHeartbeat({ now: e.at, lastTouchAt: lastTouch, hidden: !!e.hidden })) {
        if (e.at - lastTouch > INACTIVITY_WINDOW_MS) serverRefusedAt ??= e.at;
        else {
          lastTouch = e.at;
          deadline = deadlineFromServerTouch(e.at);
        }
      }
    }
    if (t - lastTouch > INACTIVITY_WINDOW_MS) serverRefusedAt ??= t;
    if (t >= deadline) {
      signedOutAt = t;
      break;
    }
  }
  return { signedOutAt, serverRefusedAt };
}

describe("inactivity timeout", () => {
  it("never signs out during 90 minutes of continuous interaction", () => {
    const events = Array.from({ length: 90 * 4 }, (_, k) => ({ at: k * 15_000 }));
    const r = simulate(events, 90 * MIN);
    expect(r.signedOutAt).toBeNull();
    expect(r.serverRefusedAt).toBeNull();
  });

  it("signs out after 30 minutes with no interaction, before the server refuses", () => {
    const r = simulate([{ at: 5 * MIN }], 60 * MIN);
    expect(r.signedOutAt).toBe(35 * MIN);
    expect(r.serverRefusedAt === null || r.serverRefusedAt >= r.signedOutAt!).toBe(true);
  });

  it("a hidden background tab never keeps the session alive", () => {
    const events = Array.from({ length: 60 }, (_, k) => ({ at: k * MIN, hidden: true }));
    expect(simulate(events, 60 * MIN).signedOutAt).toBe(30 * MIN);
  });

  it("throttles heartbeats to one every two minutes", () => {
    expect(shouldHeartbeat({ now: 119_000, lastTouchAt: 0, hidden: false })).toBe(false);
    expect(shouldHeartbeat({ now: 120_000, lastTouchAt: 0, hidden: false })).toBe(true);
    expect(shouldHeartbeat({ now: 1_000, lastTouchAt: 0, hidden: false, force: true })).toBe(true);
  });
});
