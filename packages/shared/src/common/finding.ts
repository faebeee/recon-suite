/**
 * Graded findings shared by analysis tools (email security, web files, ...).
 * `info` findings are shown but do not count towards the score.
 */
export type FindingStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface Finding {
  /** Stable id, e.g. "spf.all". */
  id: string;
  status: FindingStatus;
  title: string;
  /** Human-readable explanation or recommendation. */
  message: string;
  value?: string;
}

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface GradedReport {
  grade: Grade;
  /** 0-100 */
  score: number;
  findings: Finding[];
}

/** pass = 1 point, warn = 0.5, fail = 0; info is ignored. Any fail caps the grade at B. */
export function gradeFindings(findings: Finding[]): GradedReport {
  const scored = findings.filter((f) => f.status !== 'info');
  const points = scored.reduce(
    (sum, f) => sum + (f.status === 'pass' ? 1 : f.status === 'warn' ? 0.5 : 0),
    0,
  );
  const score = scored.length ? Math.round((points / scored.length) * 100) : 0;
  const hasFail = scored.some((f) => f.status === 'fail');
  let grade: Grade;
  if (score === 100) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';
  if (hasFail && (grade === 'A+' || grade === 'A')) grade = 'B';
  return { grade, score, findings };
}
