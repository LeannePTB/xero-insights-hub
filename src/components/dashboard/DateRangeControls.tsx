import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Default range for live cards: the current month so far (1st → today).
 * Part-month figures are now day-normalised and the cards say the period is
 * still running, so the default can show what is happening right now.
 * Only used when nothing is saved for this card.
 */
export function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
export function today() {
  return new Date();
}

/** Kept for any caller that genuinely wants the last completed month. */
export function startOfLastCompletedMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}
export function endOfLastCompletedMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0);
}


export function usePersistedDate(
  key: string,
  fallback: () => Date,
): [Date, (d: Date) => void] {
  const [date, setDate] = useState<Date>(() => {
    if (typeof window === "undefined") return fallback();
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
      }
    } catch {}
    return fallback();
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, toISO(date));
    } catch {}
  }, [key, date]);
  return [date, setDate];
}

/**
 * The four range cards (Business Health, Profit & Loss, Cash Flow,
 * Break-Even) no longer persist their range — every page load starts on the
 * default. This removes any values an earlier version left in sessionStorage
 * so nobody is left with a stranded old choice. Idempotent and cheap; each
 * card calls it once on mount.
 */
const LEGACY_RANGE_KEY_PREFIXES = [
  "health:from:",
  "health:to:",
  "pnl-range:",
  "cashflow-range:",
  "breakeven-range:",
];
export function clearLegacyRangeStorage() {
  if (typeof window === "undefined") return;
  try {
    const ss = window.sessionStorage;
    const toRemove: string[] = [];
    for (let i = 0; i < ss.length; i++) {
      const k = ss.key(i);
      if (k && LEGACY_RANGE_KEY_PREFIXES.some((p) => k.startsWith(p))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => ss.removeItem(k));
  } catch {}
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-normal">
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {format(value, "d MMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => d && onChange(d)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Named calendar-month options for cards that no longer expose free date
 * pickers. `count` completed months back, newest first, plus the running
 * current month as the default.
 */
export function monthRangeOptions(count = 6) {
  const now = new Date();
  const opts: { value: string; label: string }[] = [
    { value: "current", label: `${format(now, "MMMM yyyy")} (so far)` },
  ];
  for (let i = 1; i <= count; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({ value: `m-${i}`, label: format(start, "MMMM yyyy") });
  }
  return opts;
}

export function monthRangeFor(value: string): { from: Date; to: Date } {
  const now = new Date();
  if (value === "current") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date() };
  }
  if (value.startsWith("m-")) {
    const i = Number(value.slice(2));
    return {
      from: new Date(now.getFullYear(), now.getMonth() - i, 1),
      to: new Date(now.getFullYear(), now.getMonth() - i + 1, 0),
    };
  }
  if (value === "fytd") {
    // Australian financial year starts 1 July.
    const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: new Date(y, 6, 1), to: new Date() };
  }
  const months = Number(value);
  return {
    from: new Date(now.getFullYear(), now.getMonth() - (months - 1), 1),
    to: new Date(),
  };
}

export function DateRangeControls({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  showPresets = true,
}: {
  fromDate: Date;
  toDate: Date;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;
  showPresets?: boolean;
}) {
  function setPreset(months: number) {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
    onFromChange(start);
    onToChange(end);
  }
  function setLastMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    onFromChange(start);
    onToChange(end);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <DateField label="From" value={fromDate} onChange={onFromChange} />
      <DateField label="To" value={toDate} onChange={onToChange} />
      {showPresets && (
        <div className="ml-auto">
          <Select
            onValueChange={(v) => {
              if (v === "last") setLastMonth();
              else setPreset(Number(v));
            }}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Quick range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last">Last Month</SelectItem>
              <SelectItem value="1">This Month</SelectItem>
              <SelectItem value="3">Last 3 Months</SelectItem>
              <SelectItem value="6">Last 6 Months</SelectItem>
              <SelectItem value="12">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/**
 * Preset-only period control: no free date pickers. Used by the Profit & Loss
 * card. Other cards keep `DateRangeControls` unchanged.
 */
export function PeriodSelect({
  value,
  onChange,
  monthsBack = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  monthsBack?: number;
}) {
  const options = [
    ...monthRangeOptions(monthsBack),
    { value: "fytd", label: "Financial year to date" },
    { value: "3", label: "Last 3 months" },
    { value: "6", label: "Last 6 months" },
    { value: "12", label: "Last 12 months" },
  ];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Period
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[210px] text-xs">
          <SelectValue placeholder="Quick range" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

