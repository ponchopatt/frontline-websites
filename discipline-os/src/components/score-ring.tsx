import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  /** The streak line, drawn as a short tick across the ring. */
  threshold?: number;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
  /** Shown small after the number, e.g. "%". */
  suffix?: string;
}

/** The day's score: a plain number inside a thin ring. No confetti. */
export function ScoreRing({ score, threshold, size = 96, stroke = 2.5, className, label = "Score", suffix }: ScoreRingProps) {
  const value = Math.min(100, Math.max(0, Math.round(score)));
  const center = size / 2;
  const r = center - stroke * 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const theta = threshold !== undefined ? (threshold / 100) * 2 * Math.PI : null;
  const met = threshold !== undefined && value >= threshold;

  return (
    <div
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${value}${suffix === "%" ? "%" : " out of 100"}${threshold !== undefined ? `, streak line ${threshold}${suffix === "%" ? "%" : ""}` : ""}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          opacity={value === 0 ? 0 : 1}
          className="transition-[stroke-dashoffset] duration-700 ease-(--ease-out-quart)"
        />
        {theta !== null && (
          <line
            x1={center + (r - stroke * 2) * Math.cos(theta)}
            y1={center + (r - stroke * 2) * Math.sin(theta)}
            x2={center + (r + stroke * 2) * Math.cos(theta)}
            y2={center + (r + stroke * 2) * Math.sin(theta)}
            stroke={met ? "var(--primary)" : "var(--muted-foreground)"}
            strokeWidth={1.25}
          />
        )}
      </svg>
      <span className="relative leading-none font-normal tracking-tight" style={{ fontSize: Math.round(size * 0.34) }}>
        {value}
        {suffix && <span className="text-[0.45em] text-muted-foreground">{suffix}</span>}
      </span>
    </div>
  );
}
