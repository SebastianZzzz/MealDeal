"use client";

import type { CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";

// Slider with round minus / plus buttons on either side. Buttons stay within [min, max].
export function RangeField({ id, label, value, min, max, step = 1, buttonStep = step, format = String, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step?: number; buttonStep?: number;
  format?: (value: number) => string; onChange: (value: number) => void;
}) {
  const current = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  const set = (next: number) => onChange(Number(Math.min(max, Math.max(min, next)).toFixed(2)));
  const name = label.toLowerCase();
  const progress = `${((current - min) / (max - min)) * 100}%`;
  return (
    <div className="range-field" role="group" aria-labelledby={`${id}-label`}>
      <div className="range-label"><span id={`${id}-label`}>{label}</span><b aria-live="polite">{format(current)}</b></div>
      <div className="range-row">
        <button type="button" className="round-btn" aria-label={`Decrease ${name}`} disabled={current <= min} onClick={() => set(current - buttonStep)}><Minus size={20} strokeWidth={2.4} /></button>
        <input id={id} type="range" min={min} max={max} step={step} value={current} aria-label={label} aria-valuetext={format(current)}
          style={{ "--progress": progress } as CSSProperties} onChange={(event) => set(Number(event.target.value))} />
        <button type="button" className="round-btn" aria-label={`Increase ${name}`} disabled={current >= max} onClick={() => set(current + buttonStep)}><Plus size={20} strokeWidth={2.4} /></button>
      </div>
      <div className="range-ends" aria-hidden="true"><span>{format(min)}</span><span>{format(max)}</span></div>
    </div>
  );
}
