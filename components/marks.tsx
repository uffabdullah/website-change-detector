import { wordDiff, type TrackedNumber } from "@/lib/engine/change";

export function Lamp({ status }: { status: string }) {
  const kind = status === "ok" || status === "blocked" || status === "error" ? status : "error";
  return <i className={`lamp lamp-${kind}`} aria-hidden="true" />;
}

export function TextDiff({ before, after }: { before: string; after: string }) {
  const parts = wordDiff(before, after);
  return (
    <pre className="diff">
      {parts.map((part, index) => (
        <span key={`${part.type}-${index}`} className={`diff-${part.type}`}>
          {part.text}
        </span>
      ))}
    </pre>
  );
}

export function NumberChart({ points }: { points: { at: string; numbers: TrackedNumber[] }[] }) {
  const keys = new Map<string, { label: string; values: (number | null)[] }>();
  points.forEach((point, index) => {
    for (const number of point.numbers) {
      const series = keys.get(number.key) ?? { label: number.label, values: Array(points.length).fill(null) };
      series.values[index] = number.value;
      keys.set(number.key, series);
    }
  });
  const series = [...keys.values()].filter((item) => item.values.some((value) => value !== null)).slice(0, 3);
  if (series.length === 0) {
    return <p className="quiet">Tracked numbers appear here once a version mentions a price, percent, or labeled figure.</p>;
  }
  const width = 640;
  const height = 210;
  const pad = 28;
  const flat = series.flatMap((item) => item.values.filter((value): value is number => value !== null));
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const span = max - min || 1;
  const colors = ["#e2ff4d", "#c6a27a", "#f3ecdf"];
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tracked numbers">
      {[0, 1, 2, 3].map((line) => (
        <line key={line} x1={pad} x2={width - pad} y1={pad + ((height - pad * 2) / 3) * line} y2={pad + ((height - pad * 2) / 3) * line} stroke="rgba(243,236,223,0.12)" />
      ))}
      {series.map((item, seriesIndex) => {
        const coords = item.values.map((value, index) => {
          if (value === null) return null;
          const x = pad + (index * (width - pad * 2)) / Math.max(points.length - 1, 1);
          const y = height - pad - ((value - min) / span) * (height - pad * 2);
          return `${x},${y}`;
        });
        const line = coords.filter(Boolean).join(" ");
        return (
          <g key={item.label}>
            <polyline fill="none" stroke={colors[seriesIndex]} strokeWidth="2.5" points={line} />
            {coords.map((coord, index) =>
              coord ? <circle key={index} cx={coord.split(",")[0]} cy={coord.split(",")[1]} r="3.5" fill={colors[seriesIndex]} /> : null
            )}
          </g>
        );
      })}
      {series.map((item, index) => (
        <text key={item.label} x={pad + index * 160} y={16} fill={colors[index]} fontSize="12">
          {item.label}
        </text>
      ))}
    </svg>
  );
}
