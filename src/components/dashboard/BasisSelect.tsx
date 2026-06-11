import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ReportBasis = "accrual" | "cash";

export function BasisSelect({
  value,
  onChange,
  disabled,
}: {
  value: ReportBasis | undefined;
  onChange: (v: ReportBasis) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ReportBasis)} disabled={disabled}>
      <SelectTrigger
        className="h-7 w-[110px] text-[11px] font-semibold uppercase tracking-wider"
        title="Report basis"
      >
        <SelectValue placeholder="Basis" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="accrual">Accrual</SelectItem>
        <SelectItem value="cash">Cash</SelectItem>
      </SelectContent>
    </Select>
  );
}
