'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function FullscreenToggle() {
  const t = useTranslations('nav');
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('fullscreen')}
      aria-pressed={on}
      className="hidden md:inline-flex"
      onClick={() =>
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen()
      }
    >
      {on ? <Minimize2 /> : <Maximize2 />}
    </Button>
  );
}
