import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useCanManageClient } from "@/hooks/useCanManageClient";

/**
 * Shown on every card whose figures rest on cost classification. A break-even
 * or scenario number computed from untagged accounts must never look
 * definitive.
 */
export function UnclassifiedNotice({
  clientId,
  count,
  names = [],
}: {
  clientId?: string;
  count: number;
  /** Untagged operating accounts, named so the reader knows which to fix. */
  names?: string[];
}) {
  const { canManage: isAdvisor } = useCanManageClient(clientId);
  if (count <= 0) return null;
  // Everyone is told the figure rests on an assumption. Only the preparer gets
  // the tooling link, because a client cannot act on it.
  const advisorView = isAdvisor && !!clientId;
  const named = names.length ? <> ({names.slice(0, 5).join(", ")}{names.length > 5 ? ` and ${names.length - 5} more` : ""})</> : null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-xs text-info">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">
        {advisorView ? (
          <>
            <strong>{count}</strong> expense {count === 1 ? "account is" : "accounts are"} untagged{named}
            and treated as fixed.{" "}
            <Link
              to="/clients/$clientId/settings/account-setup"
              params={{ clientId: clientId! }}
              className="font-medium underline underline-offset-2"
            >
              Classify accounts
            </Link>
          </>
        ) : (
          <>
            <strong>{count}</strong> expense {count === 1 ? "account is" : "accounts are"} not yet
            categorised{named} and {count === 1 ? "is" : "are"} treated as fixed costs, which may make these
            figures higher than they should be. Your bookkeeper is reviewing them.
          </>
        )}
      </div>
    </div>
  );
}
