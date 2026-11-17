'use client';

import type { IssuedPassword } from '@latif/shared';
import { Copy, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';

/** Shows an admin-issued one-time password once, with copy + WhatsApp share. */
export function IssuedPasswordDialog({
  issued,
  onClose,
}: {
  issued: IssuedPassword | null;
  onClose: () => void;
}) {
  const t = useTranslations('credentials');
  const tc = useTranslations('common');
  if (!issued) return null;
  const site = typeof window === 'undefined' ? '' : window.location.origin;
  const text = t('shareText', {
    name: issued.fullName,
    site,
    identifier: issued.identifier,
    password: issued.tempPassword,
  });
  const phone = issued.identifier.startsWith('+') ? issued.identifier.slice(1) : '';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t('title')} description={t('hint')} closeLabel={tc('close')}>
        <dl className="grid gap-3 rounded-2xl bg-muted p-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t('identifier')}</dt>
            <dd dir="ltr" className="text-start font-medium">
              {issued.identifier}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('password')}</dt>
            <dd dir="ltr" className="text-start font-mono text-2xl font-bold tracking-wider">
              {issued.tempPassword}
            </dd>
          </div>
        </dl>
        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              toast.success(t('copied'));
            }}
          >
            <Copy /> {t('copy')}
          </Button>
          <Button asChild variant="outline">
            <a
              href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> {t('whatsapp')}
            </a>
          </Button>
          <Button onClick={onClose}>{t('done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
