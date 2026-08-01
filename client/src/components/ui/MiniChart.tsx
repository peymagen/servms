import styles from "./MiniChart.module.css";

export interface MiniChartDatum {
  label: string;
  value: number;
}

interface MiniChartProps {
  type: "bar" | "pie" | "doughnut";
  data: MiniChartDatum[];
  onSliceClick?: (label: string) => void;
}

// Small hand-rolled SVG-free chart (CSS bars / conic-gradient pie-doughnut),
// matching the project's existing no-external-chart-library convention (see
// the legacy CSS bar chart / conic-gradient donut this replaces in
// DashboardPage.tsx) rather than introducing recharts/chart.js as a new dependency.
const COLORS = [
  "var(--color-sidebar)",
  "var(--color-info)",
  "var(--color-danger)",
  "var(--color-warning)",
  "var(--color-success)",
  "var(--color-primary)",
];

export default function MiniChart({ type, data, onSliceClick }: MiniChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  if (type === "bar") {
    const max = Math.max(1, ...data.map((d) => d.value));
    return (
      <div className={styles.barChart}>
        {data.map((d, i) => (
          <button
            key={d.label}
            type="button"
            className={styles.barCol}
            onClick={onSliceClick ? () => onSliceClick(d.label) : undefined}
            title={`${d.label}: ${d.value}`}
          >
            <div className={styles.barTrack}>
              <div
                className={styles.bar}
                style={{ height: `${(d.value / max) * 100}%`, background: COLORS[i % COLORS.length] }}
              />
            </div>
            <span className={styles.barValue}>{d.value}</span>
            <span className={styles.barLabel}>{d.label}</span>
          </button>
        ))}
      </div>
    );
  }

  let cursor = 0;
  const stops: string[] = [];
  data.forEach((d, i) => {
    const angle = (d.value / total) * 360;
    stops.push(`${COLORS[i % COLORS.length]} ${cursor}deg ${cursor + angle}deg`);
    cursor += angle;
  });
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className={styles.pieRow}>
      <div className={type === "doughnut" ? styles.doughnut : styles.pie} style={{ background: gradient }}>
        {type === "doughnut" && <div className={styles.doughnutHole} />}
      </div>
      <ul className={styles.legend}>
        {data.map((d, i) => (
          <li key={d.label}>
            <button
              type="button"
              className={styles.legendItem}
              onClick={onSliceClick ? () => onSliceClick(d.label) : undefined}
            >
              <span className={styles.dot} style={{ background: COLORS[i % COLORS.length] }} />
              {d.label}: {d.value}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
