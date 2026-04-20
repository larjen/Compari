import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  className?: string;
}

export function FilterBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filterValue,
  onFilterChange,
  filterOptions = [],
  className
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-4 items-center", className)}>
      <div className="relative flex-1 w-full">
        <DOMAIN_ICONS.SEARCH className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-forest/40" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 text-sm"
        />
      </div>
      {filterOptions.length > 0 && onFilterChange && filterValue !== undefined && (
        <div className="flex items-center gap-2 shrink-0">
          <DOMAIN_ICONS.FILTER className="w-4 h-4 text-accent-forest/60" />
          {/*
            Custom Arrow implementation for Select.
            Uses appearance-none and absolute positioning to provide 
            precise (6px) spacing between the indicator and the border.
          */}
          <div className="relative flex-1 md:flex-none">
            <select
              className="w-full md:w-auto bg-themed-input-bg border border-themed-input-border rounded-lg pl-4 pr-9 py-2.5 text-sm text-themed-fg-main cursor-pointer appearance-none transition-all duration-200 focus:outline-hidden"
              value={filterValue}
              onFocus={(e) => e.target.blur()}
              // SoC: Purely presentational focus management to maintain the "Flat" UI aesthetic by preventing the browser's default focus ring on click.
              onChange={(e) => {
                onFilterChange(e.target.value);
                // SoC: UI interaction logic - force blur to remove focus ring immediately after selection for a cleaner look.
                e.target.blur();
              }}
            >
              {filterOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-[6px] top-1/2 -translate-y-1/2 w-4 h-4 text-accent-forest/60 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
}