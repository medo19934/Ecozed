'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Direction } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children, dir }: { children: ReactNode; dir: 'rtl' | 'ltr' }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Direction.Provider dir={dir}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position={dir === 'rtl' ? 'top-left' : 'top-right'} richColors dir={dir} />
        </TooltipProvider>
      </Direction.Provider>
    </QueryClientProvider>
  );
}
