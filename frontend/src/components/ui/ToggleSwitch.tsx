'use client';

/**
 * @module ToggleSwitch
 * @description A reusable toggle switch component for boolean settings.
 * @responsibility Encapsulates toggle switch UI and state management.
 * @boundary_rules
 * - ✅ Pure UI component, no business logic.
 * - ✅ Emits boolean state changes via onChange callback.
 */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  labelOn?: string;
  labelOff?: string;
}

/**
 * Toggle switch with on/off labels.
 * 
 * @param checked - Current toggle state
 * @param onChange - Callback fired when toggle state changes
 * @param labelOn - Label text when checked (default: 'On')
 * @param labelOff - Label text when unchecked (default: 'Off')
 */
export function ToggleSwitch({ checked, onChange, disabled = false, labelOn = 'On', labelOff = 'Off' }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <label className={`relative inline-flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => {
            if (!disabled) onChange(e.target.checked);
          }}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-themed-input-border peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-sage"></div>
        <span className="ml-3 text-sm font-medium text-themed-fg-main">
          {checked ? labelOn : labelOff}
        </span>
      </label>
    </div>
  );
}