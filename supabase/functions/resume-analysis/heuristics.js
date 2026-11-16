// Plain-JS mirror of the resume-detection heuristic in index.ts so it can be unit
// tested with Vitest (index.ts imports Deno-only modules). Keep both in sync.
export const RESUME_SECTION_KEYWORDS = [
  'resume', 'curriculum vitae', 'cv', 'work experience', 'professional experience',
  'employment history', 'education', 'technical skills', 'projects', 'certification',
  'internship', 'objective', 'professional summary', 'qualifications', 'achievements',
];
export const CONTACT_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(?:^|[\s(])\+?\d[\d\s().-]{7,}\d/,
  /\b(linkedin\.com|github\.com|gitlab\.com|behance\.net|stackoverflow\.com)\b/i,
];

export function looksLikeResume(text) {
  const normalized = text.toLowerCase();
  if (normalized.replace(/\s+/g, '').length < 300) return false;
  const sectionMatches = RESUME_SECTION_KEYWORDS.reduce(
    (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
  const hasContact = CONTACT_PATTERNS.some((pattern) => pattern.test(text));
  return sectionMatches >= 3 && (hasContact || sectionMatches >= 5);
}
