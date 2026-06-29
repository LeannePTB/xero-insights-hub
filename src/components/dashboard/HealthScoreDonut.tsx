type Props = {
  score: number;
  band: "strong" | "watch" | "urgent";
  size?: number;
};

export function HealthScoreDonut({ score, band, size = 96 }: Props) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;

  const color =
    band === "strong"
      ? "hsl(var(--primary, 142 76% 36%))"
      : band === "watch"
        ? "#b45309" // amber-700
        : "hsl(var(--destructive))";

  const textColor =
    band === "strong"
      ? "text-foreground"
      : band === "watch"
        ? "text-amber-700 dark:text-amber-400"
        : "text-destructive";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <div
          className={`absolute inset-0 grid place-items-center font-display text-2xl font-semibold ${textColor}`}
        >
          {score}
        </div>
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">Overall score</p>
    </div>
  );
}
