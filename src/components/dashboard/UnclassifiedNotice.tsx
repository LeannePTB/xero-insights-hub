import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

/**
 * Shown on every card whose figures rest on cost classification. A break-even
 * or scenario number computed from untagged accounts must never look
 * definitive.
 */
export function UnclassifiedNotice({
  clientId,
  count,
}: {
  clientId?: string;
  count: number;
}) {
  if (!clientId || count <= 0) return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">
        <strong>{count}</strong> expense {count === 1 ? "account is" : "accounts are"} unclassified
        and treated as fixed.{" "}
        <Link
          to="/clients/$clientId/settings"
          params={{ clientId }}
          hash="cost-classification"
          className="font-medium underline underline-offset-2"
        >
          Classify accounts
        </Link>
      </div>
    </div>
  );
}
