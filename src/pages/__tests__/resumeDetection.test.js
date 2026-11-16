import { describe, expect, it } from 'vitest';
import { looksLikeResume } from '../../../../supabase/functions/resume-analysis/heuristics.js';

const resume = `Jordan Smith
jordan.smith@example.com | +1 555 012 3456 | linkedin.com/in/jordansmith

PROFESSIONAL SUMMARY
Frontend engineer with 4 years of experience building accessible web apps.

WORK EXPERIENCE
Senior Frontend Developer - Acme Corp (Jan 2022 - Present)
- Led migration to React and TypeScript, cutting bundle size by 35%.
Software Engineer - Beta Ltd (Jun 2019 - Dec 2021)
- Shipped customer dashboard used by 40k monthly active users.

EDUCATION
B.Tech Computer Science, State University, 2019

TECHNICAL SKILLS
JavaScript, TypeScript, React, Node.js, SQL, Git, CI/CD

PROJECTS
Open-source charting library with 2k GitHub stars.

CERTIFICATIONS
AWS Certified Developer - Associate (2023)`;

describe('resume detection heuristic', () => {
  it('accepts a typical resume document', () => {
    expect(looksLikeResume(resume)).toBe(true);
  });

  it('rejects documents that are too short', () => {
    expect(looksLikeResume('Education and skills. email me at a@b.co')).toBe(false);
  });

  it('rejects long non-resume text without resume sections', () => {
    const essay = 'The history of ancient trade routes across the continent '.repeat(20);
    expect(looksLikeResume(essay)).toBe(false);
  });

  it('rejects long text with only one resume-like keyword', () => {
    const filler = `${'Chapter one describes the journey of the hero through vast lands. '.repeat(10)}Education plays a role in the story.`;
    expect(looksLikeResume(filler)).toBe(false);
  });
});
