import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useId, useState } from 'react';
import {
  GOBUSTER_EXTENSIONS,
  MAX_GOBUSTER_EXTENSIONS,
  TOOL_CATALOG,
  type GobusterExtension,
} from '@recon/shared';
import { ChipToggle, Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToolRunner } from '@/lib/use-tool-runner';
import { GobusterResults } from './gobuster-results';
import { gobusterWordlistsQuery } from './wordlists-query';
import { gobusterIntelView } from './gobuster-intel-view';

/** "1534, 0" -> [1534, 0]; anything that isn't a whole number is dropped. */
function parseLengths(text: string): number[] {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .filter((v) => /^\d+$/.test(v))
        .map(Number),
    ),
  ].slice(0, 10);
}

export function GobusterTool({ initialTarget }: { initialTarget?: string }) {
  const id = useId();
  const lists = useQuery(gobusterWordlistsQuery);
  const [picked, setPicked] = useState<string>();
  const wordlist = picked ?? 'builtin-common';
  const [extensions, setExtensions] = useState<GobusterExtension[]>([]);
  const [threads, setThreads] = useState(10);
  const [minutes, setMinutes] = useState(10);
  const [lengths, setLengths] = useState('');

  const runner = useToolRunner('gobuster', {
    initialTarget,
    buildInput: (target) => ({
      target,
      wordlist,
      extensions,
      threads,
      timeLimitMinutes: minutes,
      excludeLengths: parseLengths(lengths),
    }),
  });

  return (
    <ToolPage toolId="gobuster">
      {lists.data && !lists.data.installed && (
        <p
          role="status"
          className="flex items-start gap-2 border-l-2 border-neon-yellow px-3 py-2 text-xs text-neon-yellow"
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          gobuster is not installed on the API host (e.g. &ldquo;sudo apt
          install gobuster&rdquo; or &ldquo;brew install gobuster&rdquo;). Dir
          Buster works without it.
        </p>
      )}
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG.gobuster.targetHint}
        error={runner.validationError}
        label="Base URL"
      >
        <FormOption label="Wordlist">
          <div className="w-full space-y-1">
            <Select
              value={wordlist}
              onValueChange={setPicked}
              disabled={lists.isPending}
            >
              <SelectTrigger
                id={`${id}-wordlist`}
                aria-label="Wordlist"
                className="h-10 w-full min-w-0 sm:w-96"
              >
                <SelectValue placeholder="Select wordlist" />
              </SelectTrigger>
              <SelectContent>
                {(lists.data?.wordlists ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="flex flex-col">
                      <span>{w.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {w.lines.toLocaleString()} words
                        {w.path ? ` · ${w.path}` : ''}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lists.isError && (
              <p className="text-xs text-neon-magenta">{lists.error.message}</p>
            )}
            {lists.data && !lists.data.wordlists.some((w) => !w.builtIn) && (
              <p className="text-xs text-muted-foreground">
                No system wordlists found on the API host. Install dirb,
                dirbuster or SecLists (&ldquo;sudo apt install seclists&rdquo;)
                for bigger lists.
              </p>
            )}
          </div>
        </FormOption>
        <FormOption label={`Extensions (max ${MAX_GOBUSTER_EXTENSIONS})`}>
          <ChipToggle
            label="File extensions"
            options={GOBUSTER_EXTENSIONS.map((e) => ({
              value: e,
              label: `.${e}`,
            }))}
            value={extensions}
            onChange={(next) =>
              setExtensions(next.slice(0, MAX_GOBUSTER_EXTENSIONS))
            }
          />
        </FormOption>
        <FormOption label="Threads">
          <Segmented
            label="Threads"
            options={[5, 10, 20, 50].map((n) => ({ value: n }))}
            value={threads}
            onChange={setThreads}
          />
        </FormOption>
        <FormOption label="Time limit">
          <Segmented
            label="Time limit"
            options={[2, 5, 10, 30].map((n) => ({
              value: n,
              label: `${n} min`,
            }))}
            value={minutes}
            onChange={setMinutes}
          />
        </FormOption>
        <FormOption label="Exclude lengths">
          <div className="w-full space-y-1">
            <label htmlFor={`${id}-lengths`} className="sr-only">
              Response sizes to exclude
            </label>
            <Input
              id={`${id}-lengths`}
              value={lengths}
              onChange={(e) => setLengths(e.target.value)}
              placeholder="e.g. 1534"
              inputMode="numeric"
              className="h-9 sm:w-60"
            />
            <p className="text-xs text-muted-foreground">
              Response sizes in bytes to ignore, comma separated: for servers
              that answer unknown paths with the same page.
            </p>
          </div>
        </FormOption>
      </TargetForm>
      <ToolResultView
        intelView={gobusterIntelView}
        mutation={runner.mutation}
        loadingLabel={`Running gobuster (up to ${minutes} min)`}
      >
        {(data) => <GobusterResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
