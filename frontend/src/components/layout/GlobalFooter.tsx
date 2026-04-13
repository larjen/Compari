'use client';

import { Logo } from '@/components/ui/Logo';
import { getThemeClasses } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function GlobalFooter() {
    const pathname = usePathname();
    const theme = getThemeClasses(false);

    if (pathname?.startsWith('/print') || pathname?.startsWith('/log-viewer')) {
        return null;
    }

    return (
        <footer className={`w-full mt-3 ${theme.footer}`}>
            <a
                href="https://github.com/larjen/Compari"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent-sage/50"
            >
                <Logo width={100} height={24} className="grayscale opacity-50 shrink-0" />

                <p className="text-sm text-accent-forest/70 font-medium text-center">
                    Highly experimental AI matching engine, crafted by AI agents orchestrated by Lars Jensen in 2026.
                </p>
            </a>
        </footer>
    );
}