import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  EXPORT_FORMATS,
  MAX_CHANGE_PAIRS,
  engagementInputSchema,
  engagementPatchSchema,
  noteInputSchema,
  notesImportSchema,
  runListQuerySchema,
  runPatchSchema,
  type Engagement,
  type EngagementFinding,
  type ExportFormat,
  type Note,
  type PostureSeries,
  type RunChanges,
  type RunDetail,
  type RunDiff,
  type RunPage,
  type RunSummary,
} from '@recon/shared';
import { z } from 'zod';
import { compareSnapshots, sameInput, snapshot } from './changes.js';
import { diffValues } from './diff.js';
import { EngagementsRepository } from './engagements.repository.js';
import { buildPosture } from './posture.js';
import { renderCsv, renderMarkdown, sortFindings } from './export.js';

const uuid = new ParseUUIDPipe({ version: '4' });
const notePatchSchema = noteInputSchema.partial();
const exportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS).default('md'),
});

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@Controller()
export class EngagementsController {
  constructor(private readonly repo: EngagementsRepository) {}

  // ------------------------------------------------------------ engagements

  @Get('engagements')
  list(): Promise<Engagement[]> {
    return this.repo.listEngagements();
  }

  @Post('engagements')
  create(
    @Body({ schema: engagementInputSchema })
    body: z.output<typeof engagementInputSchema>,
  ): Promise<Engagement> {
    return this.repo.createEngagement(body);
  }

  @Get('engagements/:id')
  get(@Param('id', uuid) id: string): Promise<Engagement> {
    return this.repo.getEngagement(id);
  }

  @Patch('engagements/:id')
  update(
    @Param('id', uuid) id: string,
    @Body({ schema: engagementPatchSchema })
    body: z.output<typeof engagementPatchSchema>,
  ): Promise<Engagement> {
    return this.repo.updateEngagement(id, body);
  }

  @Delete('engagements/:id')
  @HttpCode(204)
  async remove(@Param('id', uuid) id: string): Promise<void> {
    await this.repo.deleteEngagement(id);
  }

  // ------------------------------------------------------------ runs

  @Get('engagements/:id/runs')
  async runs(
    @Param('id', uuid) id: string,
    @Query({ schema: runListQuerySchema })
    q: z.output<typeof runListQuerySchema>,
  ): Promise<RunPage> {
    await this.repo.engagementRow(id);
    return this.repo.listRuns(id, q);
  }

  @Get('runs/:runId')
  run(@Param('runId', uuid) runId: string): Promise<RunDetail> {
    return this.repo.getRun(runId);
  }

  @Patch('runs/:runId')
  tagRun(
    @Param('runId', uuid) runId: string,
    @Body({ schema: runPatchSchema }) body: z.output<typeof runPatchSchema>,
  ): Promise<RunSummary> {
    return this.repo.setRunTags(runId, body.tags);
  }

  @Delete('runs/:runId')
  @HttpCode(204)
  async removeRun(@Param('runId', uuid) runId: string): Promise<void> {
    await this.repo.deleteRun(runId);
  }

  @Get('runs/:before/diff/:after')
  async diff(
    @Param('before', uuid) beforeId: string,
    @Param('after', uuid) afterId: string,
  ): Promise<RunDiff> {
    const [before, after] = await Promise.all([
      this.repo.getRun(beforeId),
      this.repo.getRun(afterId),
    ]);
    if (before.tool !== after.tool) {
      throw new BadRequestException(
        'Only runs of the same tool can be compared',
      );
    }
    const { input: _bi, result: br, ...b } = before;
    const { input: _ai, result: ar, ...a } = after;
    return { before: b, after: a, entries: diffValues(br?.data, ar?.data) };
  }

  @Get('runs/:runId/changes')
  async runChanges(@Param('runId', uuid) runId: string): Promise<RunChanges> {
    const run = await this.repo.getRun(runId);
    if (run.status !== 'ok') {
      throw new BadRequestException('Failed runs have no output to compare');
    }
    return compareRuns(await this.repo.previousOkRun(run), run);
  }

  @Get('engagements/:id/changes')
  async changes(@Param('id', uuid) id: string): Promise<RunChanges[]> {
    await this.repo.engagementRow(id);
    const pairs = await this.repo.latestOkPairs(id, MAX_CHANGE_PAIRS);
    return pairs.flatMap(([after, before]) =>
      after ? [compareRuns(before ?? null, after)] : [],
    );
  }

  // ------------------------------------------------------------ findings & export

  @Get('engagements/:id/findings')
  async findings(@Param('id', uuid) id: string): Promise<EngagementFinding[]> {
    await this.repo.engagementRow(id);
    return sortFindings(await this.repo.findings(id));
  }

  @Get('engagements/:id/posture')
  async posture(@Param('id', uuid) id: string): Promise<PostureSeries[]> {
    await this.repo.engagementRow(id);
    return buildPosture(await this.repo.postureRows(id));
  }

  @Get('engagements/:id/export')
  async export(
    @Param('id', uuid) id: string,
    @Query({ schema: exportQuerySchema }) q: z.output<typeof exportQuerySchema>,
    @Res({ passthrough: true }) res: HeaderResponse,
  ): Promise<string> {
    const [engagement, findings, notes, runs] = await Promise.all([
      this.repo.getEngagement(id),
      this.repo.findings(id).then(sortFindings),
      this.repo.listNotes(id),
      this.repo.listRuns(id, { limit: 10_000, offset: 0 }).then((p) => p.items),
    ]);
    const generatedAt = new Date().toISOString();
    const data = { engagement, findings, notes, runs, generatedAt };
    const body = render(q.format, data);
    res.setHeader('Content-Type', CONTENT_TYPE[q.format]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName(engagement.name, generatedAt)}.${q.format}"`,
    );
    return body;
  }

  // ------------------------------------------------------------ notes

  @Get('engagements/:id/notes')
  async notes(@Param('id', uuid) id: string): Promise<Note[]> {
    await this.repo.engagementRow(id);
    return this.repo.listNotes(id);
  }

  @Post('engagements/:id/notes')
  async addNote(
    @Param('id', uuid) id: string,
    @Body({ schema: noteInputSchema }) body: z.output<typeof noteInputSchema>,
  ): Promise<Note> {
    await this.repo.engagementRow(id);
    return this.repo.createNote(id, body);
  }

  @Post('engagements/:id/notes/import')
  async importNotes(
    @Param('id', uuid) id: string,
    @Body({ schema: notesImportSchema })
    body: z.output<typeof notesImportSchema>,
  ): Promise<Note[]> {
    await this.repo.engagementRow(id);
    return this.repo.importNotes(id, body.notes);
  }

  @Patch('notes/:noteId')
  updateNote(
    @Param('noteId', uuid) noteId: string,
    @Body({ schema: notePatchSchema }) body: z.output<typeof notePatchSchema>,
  ): Promise<Note> {
    return this.repo.updateNote(noteId, body);
  }

  @Delete('notes/:noteId')
  @HttpCode(204)
  async removeNote(@Param('noteId', uuid) noteId: string): Promise<void> {
    await this.repo.deleteNote(noteId);
  }
}

/** Semantic change summary of `after` against the previous run (none for the first run). */
function compareRuns(before: RunDetail | null, after: RunDetail): RunChanges {
  const { input, result, ...summary } = after;
  const base = {
    tool: after.tool,
    target: after.target,
    after: summary,
    input,
  };
  if (!before) {
    return {
      ...base,
      before: null,
      inputChanged: false,
      items: [],
      truncated: false,
      rawDifferences: 0,
    };
  }
  const { input: beforeInput, result: beforeResult, ...beforeSummary } = before;
  return {
    ...base,
    before: beforeSummary,
    inputChanged: !sameInput(beforeInput, input),
    ...compareSnapshots(
      snapshot(after.tool, beforeResult),
      snapshot(after.tool, result),
    ),
    rawDifferences: diffValues(beforeResult?.data, result?.data).length,
  };
}

const CONTENT_TYPE: Record<ExportFormat, string> = {
  md: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
};

function render(
  format: ExportFormat,
  data: Parameters<typeof renderMarkdown>[0],
): string {
  if (format === 'md') return renderMarkdown(data);
  if (format === 'csv') return renderCsv(data.findings);
  return JSON.stringify(data, null, 2);
}

/** "ACME Q4 / Web" -> "acme-q4-web-2026-11-13" (ASCII only, safe in a header). */
export function fileName(name: string, iso: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 60);
  return `${slug || 'engagement'}-${iso.slice(0, 10)}`;
}
