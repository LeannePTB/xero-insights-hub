import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTrueBreakevenInputs,
  upsertTrueBreakevenInputs,
  type TrueBreakevenInputs,
} from "@/lib/true-breakeven.functions";
import { getTaxLiabilities } from "@/lib/xero/reports.functions";

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

type EditableField =
  | "loan_principal"
  | "credit_card_interest"
  | "owner_drawings"
  | "tax_payments"
  | "ato_payment_plan"
  | "equipment_finance"
  | "other";

type RowDef = {
  key: EditableField;
  label: string;
  hint?: string;
  autofill?: boolean;
};

const ROWS: RowDef[] = [
  { key: "loan_principal", label: "Loan Principal Repayments" },
  { key: "credit_card_interest", label: "Credit Card Interest Payments" },
  { key: "owner_drawings", label: "Owner Drawings" },
  {
    key: "tax_payments",
    label: "Tax Payments (GST/PAYG)",
    hint: "previous month's amount",
    autofill: true,
  },
  { key: "ato_payment_plan", label: "ATO Payment Plans" },
  { key: "equipment_finance", label: "Equipment Finance" },
  { key: "other", label: "Other" },
];

export function TrueBreakevenSection({
  clientId,
  tenantId,
  fixedOpex,
  grossMargin,
  monthlyIncome,
  months,
  toDateISO,
}: {
  clientId: string;
  tenantId: string;
  fixedOpex: number;
  grossMargin: number;
  monthlyIncome: number;
  months: number;
  toDateISO: string;
}) {
  const queryClient = useQueryClient();
  const fetchInputs = useServerFn(getTrueBreakevenInputs);
  const saveInputs = useServerFn(upsertTrueBreakevenInputs);
  const fetchTax = useServerFn(getTaxLiabilities);

  const queryKey = ["true-breakeven-inputs", clientId, tenantId];

  const { data: saved, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchInputs({ data: { clientId, tenantId } }),
  });

  // Local editable copy
  const [draft, setDraft] = useState<TrueBreakevenInputs | null>(null);
  useEffect(() => {
    if (saved && !draft) setDraft(saved);
  }, [saved, draft]);

  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFilledOnce, setAutoFilledOnce] = useState(false);

  // Auto-fill tax once on first load if not yet set
  useEffect(() => {
    if (!saved || autoFilledOnce) return;
    if (saved.tax_payments !== null) {
      setAutoFilledOnce(true);
      return;
    }
    setAutoFilledOnce(true);
    void runAutoFillTax(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const debounceRef = useRef<number | null>(null);
  function persist(next: TrueBreakevenInputs) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void saveInputs({
        data: { clientId, tenantId, inputs: next },
      }).then(() => {
        queryClient.setQueryData(queryKey, next);
      });
    }, 500);
  }

  function updateField(key: EditableField, value: number | null) {
    if (!draft) return;
    const next: TrueBreakevenInputs = { ...draft, [key]: value as never };
    setDraft(next);
    persist(next);
  }

  async function runAutoFillTax(showFeedback: boolean) {
    if (!draft) return;
    setAutoFilling(true);
    try {
      const res = await fetchTax({
        data: { tenantId, date: toDateISO, mode: "balance" },
      });
      const total = (res.gst ?? 0) + (res.payg ?? 0);
      const next: TrueBreakevenInputs = { ...draft, tax_payments: total };
      setDraft(next);
      persist(next);
    } catch {
      if (showFeedback) {
        // swallow; user will see no change
      }
    } finally {
      setAutoFilling(false);
    }
  }

  const values = draft ?? saved;
  const sum = values
    ? (values.loan_principal || 0) +
      (values.credit_card_interest || 0) +
      (values.owner_drawings || 0) +
      (values.tax_payments || 0) +
      (values.ato_payment_plan || 0) +
      (values.equipment_finance || 0) +
      (values.other || 0)
    : 0;

  const monthlyFixed = fixedOpex / Math.max(months, 0.0001);
  const adjustedMonthlyFixed = monthlyFixed + sum;
  const trueBreakevenMonthly =
    grossMargin > 0 ? adjustedMonthlyFixed / grossMargin : 0;
  const aboveTrue = monthlyIncome >= trueBreakevenMonthly && trueBreakevenMonthly > 0;
  const surplus = monthlyIncome - trueBreakevenMonthly;

  return (
    <div className="mt-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        True Break-Even (Cash)
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-foreground">
                Cash Commitment (monthly)
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground">
                Monthly Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading || !values ? (
              <tr>
                <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
                  Loading inputs…
                </td>
              </tr>
            ) : (
              <>
                {ROWS.map((row) => {
                  const v = values[row.key];
                  return (
                    <tr key={row.key} className="border-b border-border">
                      <th
                        scope="row"
                        className="bg-muted/20 px-3 py-1.5 text-left font-medium text-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <span>{row.label}</span>
                          {row.hint && (
                            <span className="text-[10px] italic text-muted-foreground">
                              ({row.hint})
                            </span>
                          )}
                          {row.autofill && (
                            <button
                              type="button"
                              onClick={() => runAutoFillTax(true)}
                              disabled={autoFilling}
                              className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                              title="Auto-fill from Xero (current GST + PAYG balance)"
                            >
                              <RefreshCw
                                className={cn(
                                  "h-3 w-3",
                                  autoFilling && "animate-spin",
                                )}
                              />
                              Auto-fill
                            </button>
                          )}
                        </div>
                      </th>
                      <td className="px-2 py-1 text-right">
                        <CurrencyInput
                          value={typeof v === "number" ? v : 0}
                          onCommit={(n) => updateField(row.key, n)}
                        />
                      </td>
                    </tr>
                  );
                })}

                <tr className="border-b border-border bg-muted/30">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    Total Additional Cash Commitments
                  </th>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">
                    {fmt(sum)}
                  </td>
                </tr>

                <tr className="border-b border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    Adjusted Fixed Costs / mo{" "}
                    <span className="text-[10px] italic text-muted-foreground">
                      (Fixed + Cash Commitments)
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {fmt(adjustedMonthlyFixed)}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    True Break-Even Revenue / mo{" "}
                    <span className="text-[10px] italic text-muted-foreground">
                      (Adjusted Fixed ÷ Gross Margin %)
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">
                    {fmt(trueBreakevenMonthly)}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    Monthly Revenue
                  </th>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {fmt(monthlyIncome)}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    Above or Below True Break-Even?
                  </th>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums font-semibold",
                      aboveTrue ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {aboveTrue ? "Above" : "Below"}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {surplus >= 0 ? "Cash Surplus / mo" : "Cash Shortfall / mo"}
                  </th>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums font-semibold",
                      surplus >= 0 ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {fmt(Math.abs(surplus))}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        True (Cash) Break-Even adds real cash obligations that don't appear on the P&L —
        loan principal, owner drawings, tax payments — so you know the revenue you
        actually need to stay afloat. Tax pre-fills from your Xero Balance Sheet
        (current GST + PAYG balance). All values save automatically.
      </p>
    </div>
  );
}

function CurrencyInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(() => formatForInput(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatForInput(value));
  }, [value, focused]);

  function commit() {
    const n = parseNumber(text);
    if (n !== value) onCommit(n);
    setText(formatForInput(n));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-right font-mono text-sm tabular-nums hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
      placeholder="0"
    />
  );
}

function formatForInput(n: number): string {
  if (!n) return "";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(n);
}

function parseNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
