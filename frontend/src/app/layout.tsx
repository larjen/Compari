import type { Metadata } from 'next';
import '@/app/globals.css';
import { Navbar, ToastContainer, GlobalFooter } from '@/components/layout';
import { ModalProvider } from '@/hooks/useModal';
import { ToastProvider } from '@/hooks/useToast';
import { BlueprintProvider } from '@/hooks/useBlueprints';
import { DimensionProvider } from '@/hooks/useDimensions';
import { GlobalModals } from '@/components/layout/GlobalModals';

export const metadata: Metadata = {
  title: 'Compari',
  description: 'A local AI-powered semantic matching engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen flex flex-col bg-background overflow-hidden print:h-auto print:overflow-visible print:bg-white">
        <ToastProvider>
          <ModalProvider>
            <BlueprintProvider>
              <DimensionProvider>
                <Navbar />
                <main className="flex-1 flex flex-col overflow-y-scroll overflow-x-hidden print:overflow-visible print:h-auto print:block">
                  <div className="flex-1 flex flex-col">
                    {children}
                  </div>
                  <GlobalFooter />
                </main>
                <GlobalModals />
                <ToastContainer />
              </DimensionProvider>
            </BlueprintProvider>
          </ModalProvider>
        </ToastProvider>
      </body>
    </html>
  );
}