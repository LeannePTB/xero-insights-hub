import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function friendlyXeroError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (message.includes("429") || lower.includes("rate limit")) {
    return "Xero has paused requests for this organisation because too many were sent. Wait about a minute, then try again.";
  }
  if (message.includes("401") || lower.includes("unauthorized")) {
    return "Xero says this connection needs to be reconnected before this data can load.";
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