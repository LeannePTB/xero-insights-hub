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
