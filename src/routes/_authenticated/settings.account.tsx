import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { changeMyPassword } from "@/lib/advisors.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/account")({
  head: () => ({ meta: [{ title: "Account — Traction Advisory" }] }),
  component: AccountSettings,
});

function AccountSettings() {
  const changePwFn = useServerFn(changeMyPassword);

  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const valid =
    currentPassword.length >= 1 &&
    newPassword.length >= 8 &&
    /[A-Za-z]/.test(newPassword) &&
    /[0-9]/.test(newPassword) &&
    newPassword === confirm;

  const mut = useMutation({
    mutationFn: () => changePwFn({ data: { currentPassword, newPassword } }),
    onSuccess: () => {
      toast.success("Password updated");
      setCurrent("");
      setNew("");
      setConfirm("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-xl px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> All clients</Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-semibold">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your sign-in details.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] space-y-4">
          <h2 className="font-display text-lg font-semibold">Change password</h2>

          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <div className="relative">
              <Input
                id="current"
                type={show ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Hide passwords" : "Show passwords"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new">New password</Label>
            <Input
              id="new"
              type={show ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNew(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters with one letter and one number.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            {confirm.length > 0 && confirm !== newPassword && (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            )}
          </div>

          <Button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}>
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Update password
          </Button>
        </section>
      </main>
    </div>
  );
}
