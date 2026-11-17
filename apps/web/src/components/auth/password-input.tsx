'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

export function PasswordInput(props: ComponentProps<'input'> & { toggleLabel: string }) {
  const { toggleLabel, ...rest } = props;
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...rest} type={show ? 'text' : 'password'} className="pe-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={toggleLabel}
        aria-pressed={show}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
