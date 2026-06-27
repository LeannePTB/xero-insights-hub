import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWithXeroButton } from "@/components/xero/ConnectWithXeroButton";

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; error?: unknown; cause?: unknown };
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.error === "string") return maybe.error;
    if (maybe.cause) return extractErrorMessage(maybe.cause);
  }
  return String(error ?? "");
}

export function isXeroReconnectError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  if (message.includes("xero reconnect required")) return true;
  if (message.includes("invalid_grant")) return true;
  if (message.includes("xero connection not found")) return true;
  if (message.includes("missing tokens")) return true;
  if (message.includes("xero") && (message.includes("401") || message.includes("unauthorized"))) return true;
  return false;
}

export function friendlyXeroError(error: unknown) {
  const message = extractErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes("xero reconnect required")) {
    return "Xero says this connection needs to be reconnected before this data can load.";
  }

  // App session errors (Supabase auth middleware) — NOT a Xero problem.
  if (
    lower.includes("authorization header") ||
    lower.includes("invalid token") ||
    lower.includes("no token provided") ||
    lower.includes("user id found in token")
  ) {
    return "Your session has expired. Please sign in again to load this data.";
  }

  if (
    message.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("paused requests") ||
    lower.includes("too many were sent")
  ) {
    return "Xero has paused requests for this organisation because too many were sent. Wait about a minute, then try again.";
  }
  if (lower.includes("tax reports permission") || lower.includes("updated read-only permissions")) {
    return message;
  }
  // Only treat as a Xero reconnect issue when the error actually came from Xero.
  if (lower.includes("xero") && (message.includes("401") || lower.includes("unauthorized"))) {
    return "Xero says this connection needs to be reconnected before this data can load.";
  }
  if (lower.includes("unauthorized")) {
    return "Your session has expired. Please sign in again to load this data.";
  }
  if (lower.includes("taking too long") || lower.includes("timeout")) {
    return "Xero is taking too long to respond. Try again shortly.";
  }

  return "This Xero data could not load right now. Try again shortly.";
}

export function XeroLoadPrompt({
  label,
  description,
  onLoad,
}: {
  label: string;
  description: string;
  onLoad: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={onLoad}>
        {label}
      </Button>
    </div>
  );
}

export function XeroErrorNotice({
  error,
  onRetry,
  isRetrying,
}: {
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4 text-sm text-foreground">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p>{friendlyXeroError(error)}</p>
      </div>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Try again
      </Button>
    </div>
  );
}