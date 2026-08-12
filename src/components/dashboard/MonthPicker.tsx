import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth() {
  return monthKeyOf(new Date());
}

/** First/last day of a "YYYY-MM" month, as ISO date strings. */
export function monthBounds(key: string) {
  const [y, m] = key.split("-").map(Number);
  const year = y ?? new Date().getFullYear();
  const month = (m ?? 1) - 1;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(first), to: iso(last) };
}

export function monthLabelOf(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y ?? 2000, (m ?? 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Session-persisted month selection, defaulting to the current month. */
export function usePersistedMonth(key: string): [string, (m: string) => void] {
  const [month, setMonth] = useState<string>(() => {
    if (typeof window === "undefined") return currentMonth();
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
    } catch {}
    return currentMonth();
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, month);
    } catch {}
  }, [key, month]);
  return [month, setMonth];
}

export function MonthPicker({
  value,
  onChange,
  count = 24,
  className = "",
}: {
  value: string;
  onChange: (m: string) => void;
  count?: number;
  className?: string;
}) {
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i < count; i++) {
    options.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  if (!options.includes(value)) options.unshift(value);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Month
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((m) => (
            <SelectItem key={m} value={m}>
              {monthLabelOf(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
