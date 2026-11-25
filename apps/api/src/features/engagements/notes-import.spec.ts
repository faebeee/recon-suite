import { NOTES_IMPORT_FORMAT, detectNotesImport } from '@recon/shared';

const valid = {
  format: NOTES_IMPORT_FORMAT,
  version: 1,
  notes: [
    { title: 'Admin panel', target: 'example.com', tags: ['Web'] },
    { title: 'Kickoff', body: 'Scope confirmed' },
  ],
};

describe('detectNotesImport', () => {
  it('ignores text that is not a notes import', () => {
    expect(detectNotesImport('hello').kind).toBe('none');
    expect(detectNotesImport('{ not json').kind).toBe('none');
    expect(detectNotesImport('[1, 2]').kind).toBe('none');
    expect(detectNotesImport('{"title":"x"}').kind).toBe('none');
    expect(
      detectNotesImport(JSON.stringify({ ...valid, format: 'other' })).kind,
    ).toBe('none');
  });

  it('parses a valid import and applies note defaults', () => {
    const r = detectNotesImport(`  ${JSON.stringify(valid)}\n`);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.data.notes).toEqual([
      { title: 'Admin panel', body: '', target: 'example.com', tags: ['web'] },
      { title: 'Kickoff', body: 'Scope confirmed', tags: [] },
    ]);
  });

  it('reports why a marked import is invalid', () => {
    const noTitle = detectNotesImport(
      JSON.stringify({ ...valid, notes: [{ body: 'x' }] }),
    );
    expect(noTitle).toMatchObject({ kind: 'invalid' });
    if (noTitle.kind === 'invalid') {
      expect(noTitle.message).toContain('notes.0.title');
    }
    expect(
      detectNotesImport(JSON.stringify({ ...valid, version: 2 })),
    ).toMatchObject({ kind: 'invalid' });
    expect(
      detectNotesImport(JSON.stringify({ ...valid, notes: [] })),
    ).toMatchObject({ kind: 'invalid' });
  });
});
