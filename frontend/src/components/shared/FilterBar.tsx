import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-forest/40" />
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
          <Filter className="w-4 h-4 text-accent-forest/60" />
          <select
            className="w-full md:w-auto bg-white border border-border-light rounded-lg px-4 py-2.5 text-sm text-accent-forest placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-sage/30 focus:border-accent-sage transition-all duration-200 cursor-pointer"
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
          >
            {filterOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}