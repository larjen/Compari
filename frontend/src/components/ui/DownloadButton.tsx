'use client';

import { Download } from 'lucide-react';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';

interface DownloadButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The name of the item being downloaded (e.g., "PDF", "Report"). Defaults to "File". */
  itemName?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

/**
 * @component DownloadButton
 * @description Universal call-to-action button for downloading files or reports.
 * @responsibility Enforces visual and linguistic consistency (always uses the Download icon and "Download [Item]" format) across the entire application.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or file-fetching logic.
 * - ✅ Purely presentational component delegating onClick behavior to the parent.
 */
export function DownloadButton({ 
  itemName = 'File', 
  variant = 'secondary', 
  size = 'md', 
  className, 
  ...props 
}: DownloadButtonProps) {
  // Ensure the first letter is capitalized for visual consistency
  const formattedItem = itemName.charAt(0).toUpperCase() + itemName.slice(1);
  
  return (
    <Button variant={variant} size={size} className={className} {...props}>
      <Download className="w-4 h-4 mr-2 shrink-0" />
      <span className="pr-1 truncate">Download {formattedItem}</span>
    </Button>
  );
}