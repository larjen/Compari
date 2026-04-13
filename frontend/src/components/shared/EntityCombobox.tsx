'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/Command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { useEntities } from '@/hooks/useEntities';
import { useDebounce } from '@/hooks/useDebounce';
import { getNuancedEntityName } from '@/lib/utils';
import { Blueprint } from '@/lib/types';

interface EntityComboboxProps {
  type: 'requirement' | 'offering';
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  blueprints: Blueprint[];
  disabled?: boolean;
}

export function EntityCombobox({ type, label, value, onChange, blueprints, disabled }: EntityComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 500);

  const { entities, loading, refetch } = useEntities({
    type,
    search: debouncedSearch,
    limit: 12,
  });

  React.useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const selectedEntity = entities.find((e) => e.id === value);
  const displayValue = selectedEntity ? `#${selectedEntity.id} - ${getNuancedEntityName(selectedEntity, blueprints)}` : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-white border border-accent-sand/30 text-accent-forest hover:bg-accent-sand/10"
        >
          {value ? displayValue : `Select a ${label.toLowerCase()}...`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 shadow-lg border-accent-sand/30" 
        align="start" 
        sideOffset={-42} 
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={`Search ${label.toLowerCase()}s...`} 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="p-4 flex items-center justify-center text-sm text-accent-forest/70">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...
              </div>
            )}
            {!loading && entities.length === 0 && (
              <CommandEmpty>No {label.toLowerCase()}s found.</CommandEmpty>
            )}
            <CommandGroup>
              {entities.map((entity) => {
                const entityName = `#${entity.id} - ${getNuancedEntityName(entity, blueprints)}`;
                return (
                  <CommandItem
                    key={entity.id}
                    value={entity.id.toString()}
                    onSelect={() => {
                      onChange(entity.id === value ? null : entity.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === entity.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {entityName}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}