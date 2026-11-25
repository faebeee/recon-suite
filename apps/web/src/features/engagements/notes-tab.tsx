import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Save } from 'lucide-react';
import { useId, useState } from 'react';
import {
  ENGAGEMENT_API,
  noteInputSchema,
  type Note,
  type NoteInput,
} from '@recon/shared';
import { Panel, Tag } from '@/components/cyber';
import { PivotLinks } from '@/components/tool';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiDelete, apiPatch, apiPost, type ApiError } from '@/lib/api-client';
import { ENGAGEMENTS_KEY } from '@/lib/engagement';
import { formatDateTime } from '@/lib/format';
import { NotesImport } from './notes-import';
import { notesQuery } from './queries';
import {
  ConfirmDelete,
  ErrorText,
  Field,
  parseTags,
  textareaClass,
} from './ui';

export function NotesTab({ engagementId }: { engagementId: string }) {
  const notes = useQuery(notesQuery(engagementId));
  const [editing, setEditing] = useState<Note | null>(null);

  const sorted = [...(notes.data ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="space-y-4">
      <NotesImport engagementId={engagementId} />
      <NoteForm
        key={editing?.id ?? 'new'}
        engagementId={engagementId}
        note={editing}
        onDone={() => setEditing(null)}
      />
      {notes.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notes.isError ? (
        <ErrorText error={notes.error} />
      ) : sorted.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No notes yet.
        </p>
      ) : (
        sorted.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            isEditing={editing?.id === note.id}
            onEdit={() => {
              setEditing(note);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onDeleted={() => {
              if (editing?.id === note.id) setEditing(null);
            }}
          />
        ))
      )}
    </div>
  );
}

function NoteForm({
  engagementId,
  note,
  onDone,
}: {
  engagementId: string;
  note: Note | null;
  onDone: () => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(note?.title ?? '');
  const [target, setTarget] = useState(note?.target ?? '');
  const [tags, setTags] = useState(note?.tags.join(', ') ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [validation, setValidation] = useState<string | null>(null);

  const save = useMutation<Note, ApiError, NoteInput>({
    mutationFn: (input) =>
      note
        ? apiPatch(ENGAGEMENT_API.note(note.id), input)
        : apiPost(ENGAGEMENT_API.notes(engagementId), input),
    onSuccess: () => {
      setTitle('');
      setTarget('');
      setTags('');
      setBody('');
      onDone();
      void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
    },
  });

  return (
    <Panel title={note ? 'Edit note' : 'New note'}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = noteInputSchema.safeParse({
            title,
            body,
            target: target.trim() || undefined,
            tags: parseTags(tags),
          });
          if (!parsed.success) {
            setValidation(parsed.error.issues[0]?.message ?? 'Invalid input');
            return;
          }
          setValidation(null);
          save.mutate(parsed.data);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Title" htmlFor={`${id}-title`}>
            <Input
              id={`${id}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </Field>
          <Field label="Target (optional)" htmlFor={`${id}-target`}>
            <Input
              id={`${id}-target`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              maxLength={260}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <Field label="Tags (comma separated)" htmlFor={`${id}-tags`}>
            <Input
              id={`${id}-tags`}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
        <Field label="Body" htmlFor={`${id}-body`}>
          <textarea
            id={`${id}-body`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={50_000}
            className={textareaClass}
          />
        </Field>
        <ErrorText error={validation ?? save.error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="animate-spin" />
            ) : note ? (
              <Save />
            ) : (
              <Plus />
            )}
            {note ? 'Save note' : 'Add note'}
          </Button>
          {note && (
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}

function NoteCard({
  note,
  isEditing,
  onEdit,
  onDeleted,
}: {
  note: Note;
  isEditing: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation<void, ApiError>({
    mutationFn: () => apiDelete(ENGAGEMENT_API.note(note.id)),
    onSuccess: () => {
      onDeleted();
      void queryClient.invalidateQueries({ queryKey: ENGAGEMENTS_KEY });
    },
  });

  return (
    <Panel
      title={note.title}
      tone={isEditing ? 'yellow' : 'cyan'}
      actions={
        <>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Edit note ${note.title}`}
            title="Edit"
            onClick={onEdit}
          >
            <Pencil />
          </Button>
          <ConfirmDelete
            label={`Delete note ${note.title}`}
            pending={remove.isPending}
            onConfirm={() => remove.mutate()}
          />
        </>
      }
      bodyClassName="space-y-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{formatDateTime(note.createdAt)}</span>
        {note.updatedAt !== note.createdAt && (
          <span>edited {formatDateTime(note.updatedAt)}</span>
        )}
        {note.target && (
          <span className="inline-flex items-center gap-1">
            <span className="break-all text-primary">{note.target}</span>
            <PivotLinks value={note.target} />
          </span>
        )}
        {note.tags.map((t) => (
          <Tag key={t} tone="muted">
            {t}
          </Tag>
        ))}
      </div>
      {note.body && (
        <p className="text-sm break-words whitespace-pre-wrap">{note.body}</p>
      )}
      <ErrorText error={remove.error} />
    </Panel>
  );
}
