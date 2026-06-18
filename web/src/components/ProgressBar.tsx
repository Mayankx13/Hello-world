/**
 * Step progress indicator. `total` segments, `current` (0-based) is the active
 * one: earlier segments are `.done`, the current is `.on`. Announced to AT via
 * role="progressbar" (valuenow = current+1, valuemax = total).
 */
import type { JSX } from "react";

export interface ProgressBarProps {
  total: number;
  current: number;
  label: string;
}

export default function ProgressBar({ total, current, label }: ProgressBarProps): JSX.Element {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuenow={Math.min(current + 1, total)}
      aria-valuemax={total}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < current ? "done" : i === current ? "on" : ""} />
      ))}
    </div>
  );
}
