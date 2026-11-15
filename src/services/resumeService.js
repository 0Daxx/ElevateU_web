/**
 * resumeService.js — Mock API layer for the Resume Analysis feature.
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory list of past analyses (session-scoped; heavy file contents are never stored)
let _resumeHistory = [];

/**
 * Fetch the list of past resume analyses for the current user.
 * Returns lightweight metadata only (no file contents).
 *
 * @returns {Promise<Array>}
 */
export async function getResumeHistory() {
  await delay(300);
  // Return a shallow copy so callers cannot mutate the internal list
  return [..._resumeHistory];
}

/**
 * Simulates a complex backend resume parsing and analysis process.
 * In a real app, the File object would be uploaded via FormData to an ML-powered endpoint.
 *
 * @param {File} file - The uploaded resume file.
 */
export async function analyzeResume(file) {
  // Simulate 1.5s delay to feel like "real processing"
  await delay(1500);

  const result = {
    fileName: file.name,
    analyzedAt: new Date().toISOString(),
    atsScore: 74,
    scoreBreakdown: {
      formatting: 80,
      keywords: 65,
      readability: 78,
      length: 90,
    },
    strengths: [
      'Clear reverse-chronological work history',
      'Consistent date formatting',
      'Appropriate resume length (1-2 pages)',
    ],
    issues: [
      { severity: 'high', message: 'Missing a dedicated Skills section' },
      { severity: 'medium', message: 'Contact info split across two lines — may confuse ATS parsers' },
      { severity: 'low', message: 'Some bullet points exceed 2 lines' },
    ],
    missingKeywords: ['React', 'REST APIs', 'Agile', 'Git'],
    suggestions: [
      'Add a Skills section near the top listing your core technical tools',
      'Quantify achievements with numbers where possible (e.g. "improved load time by 30%")',
      'Include keywords from the target job description naturally within bullet points',
    ],
  };

  // Prepend to history (metadata only — no file reference stored)
  _resumeHistory = [result, ..._resumeHistory];

  return result;
}
