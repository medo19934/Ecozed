import { Baby } from 'lucide-react';
import { fileUrl } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/** Child photo (private, via BFF) or a gendered placeholder. */
export function ChildAvatar({
  src,
  name,
  gender,
  className,
}: {
  src: string | null;
  name: string;
  gender: 'MALE' | 'FEMALE';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full',
        gender === 'FEMALE' ? 'bg-[#f6e8f1] text-[#7b649b]' : 'bg-secondary text-primary',
        className,
      )}
    >
      {src ? (
        <img src={fileUrl(src)} alt={name} className="size-full object-cover" />
      ) : (
        <Baby className="size-1/2" aria-hidden />
      )}
    </span>
  );
}
