"use client";

// Slider with a minus and plus button on either side (A's design). Buttons stay within [min, max].
export function RangeField({ id, label, value, min, max, step = 1, buttonStep = step, format = String, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step?: number; buttonStep?: number;
  format?: (value: number) => string; onChange: (value: number) => void;
}) {
  const current = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  const set = (next: number) => onChange(Number(Math.min(max, Math.max(min, next)).toFixed(2)));
  const name = label.toLowerCase();
  return (
    <div className="range-field" role="group" aria-labelledby={`${id}-label`}>
      <div className="range-label"><strong id={`${id}-label`}>{label}</strong><b aria-live="polite">{format(current)}</b></div>
      <div className="range-row">
        <button type="button" aria-label={`Decrease ${name}`} disabled={current <= min} onClick={() => set(current - buttonStep)}>−{buttonStep}</button>
        <input id={id} type="range" min={min} max={max} step={step} value={current} aria-label={label} aria-valuetext={format(current)} onChange={(event) => set(Number(event.target.value))} />
        <button type="button" aria-label={`Increase ${name}`} disabled={current >= max} onClick={() => set(current + buttonStep)}>+{buttonStep}</button>
      </div>
      <div className="range-ends" aria-hidden="true"><span>{format(min)}</span><span>{format(max)}</span></div>
    </div>
  );
}
