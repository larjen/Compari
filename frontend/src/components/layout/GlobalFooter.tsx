'use client';

import { useState, useEffect } from 'react';
import { Logo } from '@/components/ui/Logo';
import { usePathname } from 'next/navigation';
import { useBlueprints } from '@/hooks/useBlueprints';

export function GlobalFooter() {
    const pathname = usePathname();
    const { blueprints, loading: blueprintsLoading } = useBlueprints();
    const [isReady, setIsReady] = useState(false);

    if (pathname?.startsWith('/print') || pathname?.startsWith('/log-viewer')) {
        return null;
    }

    const activeBlueprint = blueprints.find(b => b.is_active) || blueprints;
    const hasDynamicData = !blueprintsLoading && activeBlueprint;

    useEffect(() => {
        if (hasDynamicData || !pathname?.includes('/matches/')) {
            setIsReady(true);
        }
    }, [hasDynamicData, pathname]);

    return (
        <footer className={`w-full mt-3 bg-themed-inner border-t border-themed-border transition-opacity duration-500 ease-in-out ${isReady ? 'opacity-100' : 'opacity-0'}`}>
            <a
                href="https://github.com/larjen/Compari"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-accent-sage/50"
            >
                <Logo width={100} height={24} className="grayscale opacity-50 shrink-0" />

                <p className="text-sm text-themed-fg-muted font-medium text-center">
                    Highly experimental AI matching engine, crafted by AI agents orchestrated by Lars Jensen in 2026.
                </p>
            </a>
        </footer>
    );
}