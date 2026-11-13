import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyButton({
  value,
  label = 'Copy',
  iconOnly = false,
}: {
  value: string;
  label?: string;
  /** Show only the icon; `label` becomes the accessible name and tooltip. */
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="text-neon-green" /> : <Copy />}
      {!iconOnly && (copied ? 'Copied' : label)}
    </Button>
  );
}
