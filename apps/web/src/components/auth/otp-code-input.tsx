'use client';

import { OTP } from '@latif/shared';
import { Input } from '@/components/ui/input';

export function OtpCodeInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <Input
      id={id}
      dir="ltr"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={OTP.LENGTH}
      placeholder={'•'.repeat(OTP.LENGTH)}
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, OTP.LENGTH))}
      className="h-14 text-center text-2xl tracking-[0.6em]"
    />
  );
}
