import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Settings2 } from "lucide-react";
import { getTrueBreakevenInputs } from "@/lib/true-breakeven.functions";
import {
  COMMITMENT_FIELDS,
  trueBreakevenFigures,
} from "@/components/dashboard/true-breakeven-figures";
import { fmtAUD } from "@/components/dashboard/useBreakevenData";
import { cn } from "@/lib/utils";

/**
 * The cash commitments section of the Break-Even card — the card key
 * `true_breakeven`. It is a section, never a card of its own.
 *
 * Nothing here changes the break-even calculation above it: it adds the money
 * that leaves the bank without appearing in the profit and loss, and shows the
 * revenue needed to cover the lot.
 */
export function TrueBreakevenSection({
  clientId,
  tenantId,
  monthlyFixed,
  grossMargin,
  monthlyIncome,
  isAdvisor,
}: {
  clientId: string;
  tenantId: string;
  monthlyFixed: number;
  grossMargin: number;
  monthlyIncome: number;
  isAdvisor: boolean;
}) {
  const fetchInputs = useServerFn(getTrueBreakevenInputs);
  const q = useQuery({
    queryKey: ["true-breakeven-inputs", clientId, tenantId],
    queryFn: () => fetchInputs({ data: { clientId, tenantId } }),
  });

  const settingsLink = (label: string) => (
    <Link
      to="/clients/$clientId/settings"
      params={{ clientId }}
      hash="cash-commitments"
      className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
    >
      <Settings2 className="h-3 w-3" /> {label}
    </Link>
  );

  if (q.isLoading) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working out what you really need to bring
        in…
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
        The loan, tax and drawings figures could not be read just now, so the amount you really need
        to bring in is not shown. The break-even figures above are unaffected.
      </div>
    );
  }

  const f = trueBreakevenFigures({
    monthlyFixed,
    grossMargin,
    monthlyIncome,
    commitments: q.data,
  });

  if (!f.hasCommitments) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">
          What you really need to bring in — nothing entered yet
        </p>
        <p className="mt-1">
          Break-even above only covers the costs in your profit and loss. It leaves out money that
          still has to go out: loan repayments, equipment finance, tax set aside and what the owners
          take.{" "}
          {isAdvisor
            ? "Enter those monthly amounts and this section will show the revenue needed to cover the lot."
            : "Once your adviser enters those monthly amounts, this section will show the revenue needed to cover the lot."}
        </p>
        {isAdvisor && <p className="mt-2">{settingsLink("Enter loan, tax and drawings")}</p>}
      </div>
    );
  }

  const rows = COMMITMENT_FIELDS.map((field) => ({
    label: field.label,
    amount: Number(q.data?.[field.key] ?? 0) || 0,
  })).filter((r) => r.amount !== 0);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-3 py-2">
        <p className="text-sm font-semibold text-foreground">What you really need to bring in</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Break-even covers the costs in your profit and loss. This adds the money that still has to
          go out — loan repayments, tax set aside and what the owners take — which your profit and
          loss never shows as an expense.
        </p>
      </div>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-border">
            <th
              scope="row"
              className="w-1/2 bg-muted/20 px-3 py-2 text-left font-medium text-foreground"
            >
              Costs you have anyway (per month)
            </th>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtAUD(monthlyFixed)}</td>
          </tr>
          <tr className="border-b border-border">
            <th
              scope="row"
              className="w-1/2 bg-muted/20 px-3 py-2 text-left font-medium text-foreground"
            >
              Paid out but not an expense (per month)
            </th>
            <td className="px-3 py-2 text-right font-mono tabular-nums">
              {fmtAUD(f.monthlyCommitments)}
            </td>
          </tr>
          <tr className="border-b border-border">
            <th
              scope="row"
              className="w-1/2 bg-muted/20 px-3 py-2 text-left font-medium text-foreground"
            >
              Revenue needed to cover it all (per month){" "}
              <span className="italic text-muted-foreground">
                (everything above ÷ Left from each sale %)
              </span>
            </th>
            <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">
              {fmtAUD(f.monthlyRequiredRevenue)}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              className="w-1/2 bg-muted/20 px-3 py-2 text-left font-medium text-foreground"
            >
              {f.aboveRequired ? "Covered?" : "Short by (per month)"}
            </th>
            <td
              className={cn(
                "px-3 py-2 text-right font-mono tabular-nums font-semibold",
                f.aboveRequired ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {f.aboveRequired ? "Yes" : fmtAUD(f.shortfall)}
            </td>
          </tr>
        </tbody>
      </table>
      <details className="border-t border-border/60 bg-background/50">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          What is included
        </summary>
        <ul className="divide-y divide-border/40 px-3 pb-3 text-xs">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-2 py-1">
              <span className="truncate">{r.label}</span>
              <span className="font-mono tabular-nums text-foreground">{fmtAUD(r.amount)}</span>
            </li>
          ))}
        </ul>
        {isAdvisor && <p className="px-3 pb-3 text-xs">{settingsLink("Change these amounts")}</p>}
      </details>
    </div>
  );
}
