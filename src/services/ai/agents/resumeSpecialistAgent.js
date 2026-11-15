import { executeTool } from '../toolRegistry';

export const RESUME_SPECIALIST_SYSTEM_PROMPT = `
You are the ElevateU Resume & ATS Specialist Agent.
Summarize only the signed-in user's latest saved resume analysis. Do not invent scores, skills, experience, or recommendations.
`;

export async function handleResumeSpecialistTask() {
  const result = await executeTool('analyze_resume_ats');
  if (!result.success || !result.data) {
    return {
      agent: 'Resume & ATS Specialist Agent',
      reply: result.error || 'Upload and analyze a resume first to get a resume report.',
      toolsExecuted: ['analyze_resume_ats'],
      dataCard: null,
    };
  }

  const report = result.data;
  const topSuggestion = report.suggestions?.[0];
  const summary = [
    `Your latest resume score is **${report.atsScore}/100**.`,
    report.strengths?.length ? `A strength: ${report.strengths[0]}` : '',
    topSuggestion ? `Suggested next step: ${topSuggestion.suggestion}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    agent: 'Resume & ATS Specialist Agent',
    reply: summary,
    toolsExecuted: ['analyze_resume_ats'],
    dataCard: {
      type: 'RESUME_SCORE',
      title: 'Latest ATS Resume Report',
      score: report.atsScore,
      missingKeywords: report.missingKeywords,
      topIssue: report.issues?.[0]?.message || topSuggestion?.issue || 'No priority issue was detected.',
    },
  };
}
