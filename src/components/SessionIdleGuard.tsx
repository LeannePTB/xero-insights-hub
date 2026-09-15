import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { touchSessionActivity } from "@/lib/session-activity.functions";
import { logAuthEvent } from "@/lib/audit.functions";
import {
  INACTIVITY_WARN_AT_MS,
  INACTIVITY_WINDOW_MS,
  SESSION_CHANNEL,
  clearIdleDeadline,
  markSignedOutIdle,
  readIdleDeadline,
  writeIdleDeadline,
} from "@/lib/session-cutoff";

/**
 * Inactivity timeout — the browser half.
 *
 * The control is the server: `app_private.is_session_active()` compares the
 * server-held `session_activity.last_activity_at` with a 30 minute window, so
 * every query and every definer function refuses an idle session (raising
 * SESSION_IDLE, never MFA_REQUIRED). This component only makes that pleasant:
 * it warns a minute before, offers "Stay signed in", and signs out cleanly on
 * expiry so nobody lands on a half-broken page.
 *
 * Deliberate properties:
 * - The deadline is an ABSOLUTE timestamp in localStorage, so a closed laptop
 *   is already expired the moment it wakes; no timer has to have been running.
 * - Every tab of one session shares that deadline and a BroadcastChannel, so
 *   activity in one tab extends all of them and expiry ends all of them.
 * - Only real interaction counts: pointerdown, keydown and route navigation.
 *   The presence heartbeat, snapshot polling and token refresh never call in.
 * - The server call is debounced to at most once a minute.
 * - This layer can only ever sign out EARLIER than the server. If the browser
 *   clock is wrong or storage is cleared, the database still refuses.
 */
const TOUCH_MIN_INTERVAL_MS = 60_000;
const TICK_MS = 5_000;

export function SessionIdleGuard() {
  const navigate = useNavigate();
  const touch = useServerFn(touchSessionActivity);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [warnUntil, setWarnUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastTouchRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const endingRef = useRef(false);

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    clearIdleDeadline();
    markSignedOutIdle();
    try {
      channelRef.current?.postMessage({ type: "expired" });
    } catch {}
    try {
      await logAuthEvent({ data: { action: "signed_out" } });
    } catch {
      /* audit is best-effort */
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }, [navigate]);

  /** Real interaction: extend the shared deadline and tell the server. */
  const registerActivity = useCallback(
    (opts: { force?: boolean } = {}) => {
      if (endingRef.current) return;
      const deadline = Date.now() + INACTIVITY_WINDOW_MS;
      writeIdleDeadline(deadline);
      setWarnUntil(null);
      try {
        channelRef.current?.postMessage({ type: "activity", deadline });
      } catch {}
      const since = Date.now() - lastTouchRef.current;
      if (opts.force || since >= TOUCH_MIN_INTERVAL_MS) {
        lastTouchRef.current = Date.now();
        void touch({ data: undefined } as never).catch(() => {
          /* the server is the control; a failed ping never grants time */
        });
      }
    },
    [touch],
  );

  // One shared channel and one starting deadline for this tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SESSION_CHANNEL);
      channelRef.current = channel;
      channel.onmessage = (event) => {
        const msg = event.data as { type?: string; deadline?: number } | null;
        if (msg?.type === "activity" && typeof msg.deadline === "number") {
          writeIdleDeadline(msg.deadline);
          setWarnUntil(null);
        } else if (msg?.type === "expired") {
          void endSession();
        }
      };
    } catch {
      /* older browsers: the per-tab deadline and the server still apply */
    }
    if (readIdleDeadline() === null) writeIdleDeadline(Date.now() + INACTIVITY_WINDOW_MS);
    return () => {
      channel?.close();
      channelRef.current = null;
    };
  }, [endSession]);

  // Real interaction only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onActivity = () => registerActivity();
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [registerActivity]);

  // Navigation counts as activity too.
  useEffect(() => {
    registerActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // The clock. An absolute deadline means a woken laptop expires immediately.
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      const deadline = readIdleDeadline();
      if (deadline === null) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        void endSession();
      } else if (remaining <= INACTIVITY_WINDOW_MS - INACTIVITY_WARN_AT_MS) {
        setWarnUntil(deadline);
      }
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    const onVisible = () => tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [endSession]);

  const secondsLeft = warnUntil ? Math.max(0, Math.ceil((warnUntil - now) / 1000)) : 0;

  return (
    <AlertDialog open={warnUntil !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            For security, you'll be signed out in {secondsLeft} second{secondsLeft === 1 ? "" : "s"}{" "}
            because there has been no activity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => void endSession()}>
            Sign out now
          </Button>
          <AlertDialogAction onClick={() => registerActivity({ force: true })}>
            Stay signed in
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
