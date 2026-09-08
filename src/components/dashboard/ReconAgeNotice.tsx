import { AlertTriangle } from "lucide-react";

/**
 * A saved reconciliation is reused for its date until somebody asks for a new
 * one — there is no automatic expiry, because recalculating is a real Xero
 * call. What must never happen is a stale calculation passing quietly, so once
 * a saved calculation is older than the overnight cycle the card says so in
 * plain words.
 */
const NIGHTLY_CYCLE_HOURS = 30;

export function reconIsOlderThanNightlyCycle(generatedAt: string | null | undefined): boolean {
  if (!generatedAt) return false;
  const then = new Date(generatedAt).getTime();
  if (isNaN(then)) return false;
  return Date.now() - then >= NIGHTLY_CYCLE_HOURS * 3600 * 1000;
}

function ageWords(generatedAt: string): string {
  const hours = Math.round((Date.now() - new Date(generatedAt).getTime()) / 3_600_000);
  if (hours < 48) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

export function ReconAgeNotice({
  generatedAt,
  fromSnapshot,
  canRecalculate,
  className = "",
}: {
  generatedAt: string | null | undefined;
  fromSnapshot: boolean | undefined;
  canRecalculate: boolean | undefined;
  className?: string;
}) {
  if (!fromSnapshot || !generatedAt || !reconIsOlderThanNightlyCycle(generatedAt)) return null;
  return (
    <p
      className={`flex items-start gap-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        These figures were worked out {ageWords(generatedAt)} and have not been recalculated since.
        Anything entered in Xero after that is not included.
        {canRecalculate ? " Press Recalculate to work them out again from Xero." : ""}
      </span>
    </p>
  );
}
