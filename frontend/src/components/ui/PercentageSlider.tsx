'use client';

import React from 'react';

/**
 * @module PercentageSlider
 * @description A reusable percentage slider component with customizable display.
 * @responsibility Encapsulates range input and percentage display UI.
 * @boundary_rules
 * - ✅ Pure UI component, no business logic.
 * - ✅ Emits change events via onChange callback.
 */
interface PercentageSliderProps {
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCommit?: (value: string) => void;
  min?: string;
  max?: string;
  step?: string;
  displayValue?: string;
  valueClassName?: string;
}

export function PercentageSlider({
  value,
  onChange,
  onCommit,
  min = '0',
  max = '100',
  step = '1',
  displayValue,
  valueClassName = 'font-mono text-sm text-themed-fg-main'
}: PercentageSliderProps) {
  const handleCommit = (e: React.MouseEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (onCommit) {
      const target = e.target as HTMLInputElement;
      onCommit(target.value);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          onMouseUp={handleCommit}
          onKeyUp={handleCommit}
          className="w-full h-2 bg-themed-input-border rounded-lg appearance-none cursor-pointer accent-accent-sage"
        />
      </div>
      <span className={`${valueClassName} min-w-[50px] text-right`}>
        {displayValue !== undefined ? displayValue : `${value}%`}
      </span>
    </div>
  );
}