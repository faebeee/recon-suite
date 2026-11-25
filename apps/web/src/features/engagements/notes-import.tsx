import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ENGAGEMENT_API,
  MAX_NOTES_PER_IMPORT,
  NOTES_IMPORT_FORMAT,
  NOTES_IMPORT_VERSION,
  detectNotesImport,
  type Note,
  type NotesImport,
} from '@recon/shared';
import { CopyButton } from '@/components/cyber';
import { apiPost, type ApiError } from '@/lib/api-client';
import { ENGAGEMENTS_KEY } from '@/lib/engagement';
import { ErrorText, labelClass } from './ui';

const EXAMPLE: NotesImport = {
  format: NOTES_IMPORT_FORMAT,
  version: NOTES_IMPORT_VERSION,
  notes: [
    {
      title: 'Admin panel reachable',
      body: 'GET /admin returns the login page without IP restriction.',
      target: 'https://example.com/admin',
      tags: ['web', 'source:my-scanner'],
    },
    { title: 'Kickoff', body: 'Scope confirmed by IT.' },
  ],
};
const EXAMPLE_JSON = JSON.stringify(EXAMPLE, null, 2);

/**
 * Listens for pastes anywhere on the page while the Notes tab is open. Text in the
 * `recon-suite/notes` format is imported as notes instead of being pasted; any other text
 * pastes normally.
 */
export function NotesImport({ engagementId }: { engagementId: string }) {
  const queryClient = useQueryClient();
  const [invalid, setInvalid] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  const importNotes = useMutation<Note[], ApiError, NotesImport>({
    mutationFn: (input) =>
      apiPost(ENGAGEMENT_API.notesImport(engagementId), input),
    onSuccess: (notes) => {
      setImported(notes.length);
      void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
    },
  });
  const { mutate, isPending } = importNotes;

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      const detected = detectNotesImport(text);
      if (detected.kind === 'none') return;
      e.preventDefault();
      setImported(null);
      if (detected.kind === 'invalid') {
        setInvalid(detected.message);
        return;
      }
      if (isPending) return;
      setInvalid(null);
      mutate(detected.data);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [mutate, isPending]);

  return (
    <div className="space-y-2 border border-dashed border-border px-4 py-3 text-xs">
      <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <ClipboardPaste className="size-4 shrink-0" aria-hidden />
        <span>
          Paste JSON in the{' '}
          <code className="text-primary">{NOTES_IMPORT_FORMAT}</code> format
          anywhere on this tab to import up to {MAX_NOTES_PER_IMPORT} notes at
          once.
        </span>
      </p>
      <details>
        <summary className={`${labelClass} cursor-pointer`}>Format</summary>
        <div className="mt-2 space-y-1">
          <p className="text-muted-foreground">
            Only <code>title</code> is required per note. Tags are 1-40 letters,
            digits, <code>_ - : .</code>; max 20 per note.
          </p>
          <div className="relative">
            <pre className="overflow-x-auto border border-border bg-background/60 px-2 py-1.5 text-foreground/80">
              {EXAMPLE_JSON}
            </pre>
            <div className="absolute top-1 right-1">
              <CopyButton value={EXAMPLE_JSON} label="Copy example" iconOnly />
            </div>
          </div>
        </div>
      </details>
      <div aria-live="polite">
        {isPending && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Importing notes…
          </p>
        )}
        {imported !== null && (
          <p className="text-neon-green">
            Imported {imported} {imported === 1 ? 'note' : 'notes'}.
          </p>
        )}
      </div>
      <ErrorText error={invalid ?? importNotes.error} />
    </div>
  );
}
