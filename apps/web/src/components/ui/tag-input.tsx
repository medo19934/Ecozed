'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { Input } from './input';

/** Free-text tags (e.g. staff specialties). Enter or comma adds a tag. */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  removeLabel,
  suggestions = [],
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  removeLabel: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };
  return (
    <div className="grid gap-2">
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        list={`${id}-suggestions`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft && add(draft)}
      />
      <datalist id={`${id}-suggestions`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {tag}
              <button
                type="button"
                aria-label={`${removeLabel} ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
