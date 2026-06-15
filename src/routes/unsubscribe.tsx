import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Unsubscribe — Traction Advisory" }] }),
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "success" }
  | { kind: "submitting" };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token")
    : null;

  useEffect(() => {
    if (!token) { setState({ kind: "invalid", message: "Missing token." }); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) { setState({ kind: "invalid", message: j.error ?? "Invalid link." }); return; }
        if (j.valid === false && j.reason === "already_unsubscribed") {
          setState({ kind: "already" });
        } else if (j.valid) {
          setState({ kind: "ready" });
        } else {
          setState({ kind: "invalid", message: "Invalid link." });
        }
      })
      .catch(() => setState({ kind: "invalid", message: "Could not validate this link." }));
  }, [token]);

  async function confirm() {
    if (!token) return;
    setState({ kind: "submitting" });
    const r = await fetch("/email/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && (j.success || j.reason === "already_unsubscribed")) {
      setState({ kind: "success" });
    } else {
      setState({ kind: "invalid", message: j.error ?? "Could not unsubscribe." });
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full rounded-lg border bg-card p-8 space-y-4 text-center">
        <h1 className="text-xl font-semibold">Email preferences</h1>
        {state.kind === "loading" && (
          <p className="text-sm text-muted-foreground flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></p>
        )}
        {state.kind === "ready" && (
          <>
            <p className="text-sm text-muted-foreground">
              Click below to unsubscribe from Traction Advisory emails.
            </p>
            <Button onClick={confirm}>Confirm unsubscribe</Button>
          </>
        )}
        {state.kind === "submitting" && (
          <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />Working…</Button>
        )}
        {state.kind === "already" && (
          <p className="text-sm text-muted-foreground">You're already unsubscribed.</p>
        )}
        {state.kind === "success" && (
          <p className="text-sm">You've been unsubscribed. We're sorry to see you go.</p>
        )}
        {state.kind === "invalid" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
      </div>
    </div>
  );
}
