import { useId, useState } from 'react';
import {
  DIR_BUSTER_EXTENSIONS,
  MAX_DIR_BUSTER_EXTENSIONS,
  MAX_DIR_BUSTER_EXTRA_WORDS,
  TOOL_CATALOG,
  type DirBusterExtension,
  type DirBusterWordlist,
} from '@recon/shared';
import { ChipToggle, Segmented } from '@/components/cyber';
import {
  FormOption,
  TargetForm,
  ToolPage,
  ToolResultView,
} from '@/components/tool';
import { useToolRunner } from '@/lib/use-tool-runner';
import { DirBusterResults } from './dir-buster-results';

const WORDLISTS: { value: DirBusterWordlist; label: string }[] = [
  { value: 'quick', label: 'quick (~100)' },
  { value: 'common', label: 'common (~350)' },
];

/** One word per line or separated by spaces/commas; blank entries dropped. */
function parseWords(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((w) => w.trim())
        .filter(Boolean),
    ),
  ];
}

export function DirBusterTool({ initialTarget }: { initialTarget?: string }) {
  const id = useId();
  const [wordlist, setWordlist] = useState<DirBusterWordlist>('quick');
  const [extensions, setExtensions] = useState<DirBusterExtension[]>([]);
  const [depth, setDepth] = useState(1);
  const [threads, setThreads] = useState(5);
  const [extra, setExtra] = useState('');
  const extraWords = parseWords(extra);

  const runner = useToolRunner('dir-buster', {
    initialTarget,
    buildInput: (target) => ({
      target,
      wordlist,
      extensions,
      depth,
      threads,
      extraWords,
    }),
  });

  return (
    <ToolPage toolId="dir-buster">
      <TargetForm
        value={runner.target}
        onChange={runner.setTarget}
        onSubmit={() => runner.run()}
        pending={runner.mutation.isPending}
        placeholder={TOOL_CATALOG['dir-buster'].targetHint}
        error={runner.validationError}
        label="Base URL"
      >
        <FormOption label="Wordlist">
          <Segmented
            label="Wordlist"
            options={WORDLISTS}
            value={wordlist}
            onChange={setWordlist}
          />
        </FormOption>
        <FormOption label={`Extensions (max ${MAX_DIR_BUSTER_EXTENSIONS})`}>
          <ChipToggle
            label="File extensions"
            options={DIR_BUSTER_EXTENSIONS.map((e) => ({
              value: e,
              label: `.${e}`,
            }))}
            value={extensions}
            onChange={(next) =>
              setExtensions(next.slice(0, MAX_DIR_BUSTER_EXTENSIONS))
            }
          />
        </FormOption>
        <FormOption label="Depth">
          <Segmented
            label="Recursion depth"
            options={[
              { value: 1, label: '1 (base only)' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
            ]}
            value={depth}
            onChange={setDepth}
          />
        </FormOption>
        <FormOption label="Threads">
          <Segmented
            label="Parallel requests"
            options={[2, 5, 10].map((n) => ({ value: n }))}
            value={threads}
            onChange={setThreads}
          />
        </FormOption>
        <FormOption label="Extra words">
          <div className="w-full space-y-1">
            <label htmlFor={`${id}-words`} className="sr-only">
              Extra words
            </label>
            <textarea
              id={`${id}-words`}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={2}
              spellCheck={false}
              autoCapitalize="none"
              placeholder="intranet, legacy-api, app.config"
              className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <p className="text-xs text-muted-foreground">
              {extraWords.length}/{MAX_DIR_BUSTER_EXTRA_WORDS} words, one path
              segment each (letters, digits, <code>. _ ~ -</code>)
            </p>
          </div>
        </FormOption>
      </TargetForm>
      <ToolResultView mutation={runner.mutation} loadingLabel="Busting paths">
        {(data) => <DirBusterResults data={data} />}
      </ToolResultView>
    </ToolPage>
  );
}
