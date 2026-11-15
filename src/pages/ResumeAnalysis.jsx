import React, { useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, FileText, Info, RefreshCcw,
  Trash2, UploadCloud, X,
} from 'lucide-react';
import SEO from '../components/SEO';
import { analyzeResume, deleteResumeAnalysis, getResumeAnalysis } from '../services/resumeService';
import { useUserDataStore } from '../store/userDataStore';
import { useAuth } from '../hooks/useAuth';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['pdf', 'docx'];

function ScoreRing({ value, size = 120, stroke = 12 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const colorClass = value >= 80 ? 'stroke-success' : value >= 60 ? 'stroke-warning' : 'stroke-danger';
  return <div className="relative inline-flex items-center justify-center">
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className={colorClass} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
    <span className="absolute text-3xl font-black leading-none text-text-primary">{value}</span>
  </div>;
}

function ProgressBar({ label, value }) {
  const colorClass = value >= 80 ? 'bg-success' : value >= 60 ? 'bg-warning' : 'bg-danger';
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs font-semibold">
      <span className="uppercase tracking-wide text-text-primary">{label}</span><span className="text-text-secondary">{value}/100</span>
    </div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-border"><div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${value}%` }} /></div>
  </div>;
}

const formatDate = (value) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export default function ResumeAnalysis() {
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const history = useUserDataStore((state) => state.resumeHistory) || [];
  const historyLoading = useUserDataStore((state) => state.resumeHistoryLoading);
  const historyError = useUserDataStore((state) => state.resumeHistoryError);
  const retrySlice = useUserDataStore((state) => state.retrySlice);
  const addResumeAnalysis = useUserDataStore((state) => state.addResumeAnalysis);
  const removeResumeAnalysis = useUserDataStore((state) => state.removeResumeAnalysis);
  const useOnlyMyKeys = useUserDataStore((state) => state.settings?.useOnlyMyKeys === true);

  const [status, setStatus] = useState('idle');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [openingId, setOpeningId] = useState('');
  const [busyDeleteId, setBusyDeleteId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  const validateFile = (candidate) => {
    const extension = candidate.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError('Please choose a PDF or DOCX file.');
      return false;
    }
    if (!candidate.size || candidate.size > MAX_SIZE) {
      setError('Your resume must be no larger than 5 MB.');
      return false;
    }
    setError('');
    return true;
  };

  const selectFile = (candidate) => {
    if (candidate && validateFile(candidate)) {
      setFile(candidate);
      setReport(null);
      setStatus('uploading');
    }
  };

  const handleFileChange = (event) => {
    selectFile(event.target.files?.[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startAnalysis = async () => {
    if (!file || !user?.id) return;
    setStatus('analyzing');
    setError('');
    try {
      const data = await analyzeResume(file, user.id, useOnlyMyKeys);
      const record = { id: data.id, fileName: data.fileName, analyzedAt: data.analyzedAt, atsScore: data.atsScore };
      addResumeAnalysis(record);
      setReport({ ...data.result, id: data.id, fileName: data.fileName, analyzedAt: data.analyzedAt });
      setFile(null);
      setStatus('results');
    } catch (err) {
      setError(err.message || 'Resume analysis could not be completed. Please try again.');
      setStatus('uploading');
    }
  };

  const openAnalysis = async (analysisId) => {
    if (!user?.id) return;
    setOpeningId(analysisId);
    setError('');
    try {
      const data = await getResumeAnalysis(analysisId, user.id);
      setReport({ ...data.result, id: data.id, fileName: data.fileName, analyzedAt: data.analyzedAt });
      setFile(null);
      setStatus('results');
    } catch (err) { setError(err.message || 'Could not open this analysis.'); }
    finally { setOpeningId(''); }
  };

  const removeAnalysis = async (analysisId) => {
    const previous = history;
    removeResumeAnalysis(analysisId);
    setBusyDeleteId(analysisId);
    setError('');
    try {
      await deleteResumeAnalysis(analysisId);
      if (report?.id === analysisId) { setReport(null); setStatus('idle'); }
      setConfirmDeleteId('');
    } catch (err) {
      useUserDataStore.setState({ resumeHistory: previous });
      setError(err.message || 'Could not delete this analysis.');
    } finally { setBusyDeleteId(''); }
  };

  const resetFlow = () => { setFile(null); setReport(null); setStatus('idle'); setError(''); };
  const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  const scoreSections = [
    ['Summary', report?.section_scores?.summary],
    ['Experience', report?.section_scores?.experience],
    ['Education', report?.section_scores?.education],
    ['Skills', report?.section_scores?.skills],
    ['Formatting & ATS', report?.section_scores?.formatting_ats],
  ];
  const sortedHistory = [...history].sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-4">
      <SEO title="Resume Analysis" noIndex />
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">Resume Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">Upload your resume for an evidence-based ATS score and actionable feedback.</p>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-text-primary"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />{error}</div>}

      {(status === 'idle' || status === 'uploading') && <Card className="mx-auto mt-8 max-w-2xl">
        {status === 'idle' && <div onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files?.[0]); }} onDragOver={(event) => event.preventDefault()} className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-bg-page/50 p-12 text-center transition-colors hover:bg-bg-page">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10"><UploadCloud className="h-8 w-8 text-secondary" /></div>
          <h2 className="mb-2 text-lg font-bold text-text-primary">Drag and drop your resume here</h2>
          <p className="mb-6 text-sm text-text-secondary">Supports PDF and DOCX (max 5 MB)</p>
          <Input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" />
          <Button variant="primary" onClick={() => fileInputRef.current?.click()}>Browse files</Button>
        </div>}
        {status === 'uploading' && file && <div className="space-y-6 p-8">
          <h2 className="border-b border-border pb-4 text-lg font-bold text-text-primary">Ready to analyze</h2>
          <div className="flex items-center justify-between rounded-xl border border-border bg-bg-page p-4">
            <div className="flex min-w-0 items-center gap-4"><div className="shrink-0 rounded-lg bg-secondary/10 p-3"><FileText className="h-6 w-6 text-secondary" /></div><div className="truncate"><p className="truncate font-semibold text-text-primary">{file.name}</p><p className="text-xs text-text-secondary">{formatBytes(file.size)}</p></div></div>
            <Button variant="ghost" size="sm" aria-label="Remove file" onClick={() => { setFile(null); setStatus('idle'); setError(''); }} className="h-auto shrink-0 rounded-lg p-2 text-text-secondary hover:bg-danger/10 hover:text-danger"><X className="h-5 w-5" /></Button>
          </div>
          <div className="flex justify-end border-t border-border pt-4"><Button variant="primary" onClick={startAnalysis}>Analyze Resume</Button></div>
        </div>}
      </Card>}

      {status === 'analyzing' && <Card className="mx-auto mt-16 max-w-xl space-y-6 border-t-4 border-t-secondary p-12 text-center">
        <div className="relative mx-auto h-20 w-20"><div className="absolute inset-0 animate-spin rounded-full border-4 border-secondary border-t-transparent" /><FileText className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-secondary" /></div>
        <div><h2 className="mb-2 text-xl font-bold text-text-primary">Analyzing your resume…</h2><p className="text-sm text-text-secondary">Extracting text and evaluating your experience, skills, and ATS readiness.</p></div>
      </Card>}

      {status === 'results' && report && <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="col-span-1 flex flex-col items-center justify-center p-6 text-center">
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-text-secondary">Overall resume score</h2>
            <ScoreRing value={report.overall_score} />
            <p className="mt-4 text-sm font-medium text-text-secondary">{report.fileName} · {formatDate(report.analyzedAt)}</p>
          </Card>
          <Card className="col-span-1 p-6 md:col-span-2">
            <h2 className="mb-6 text-sm font-bold uppercase tracking-wide text-text-secondary">Section scores</h2>
            <div className="grid grid-cols-1 gap-x-12 gap-y-5 sm:grid-cols-2">{scoreSections.map(([label, value]) => <ProgressBar key={label} label={label} value={value} />)}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="p-6"><h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-text-primary"><CheckCircle2 className="h-5 w-5 text-success" />Strengths</h2>
            {report.strengths.length ? <ul className="space-y-3">{report.strengths.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm text-text-primary"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span className="leading-relaxed">{item}</span></li>)}</ul> : <p className="text-sm text-text-secondary">No clear strengths were detected.</p>}
          </Card>
          <Card className="p-6"><h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-text-primary"><AlertTriangle className="h-5 w-5 text-warning" />Areas to improve</h2>
            {report.weaknesses.length ? <ul className="space-y-3">{report.weaknesses.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm text-text-primary"><Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span>{item}</span></li>)}</ul> : <p className="text-sm text-text-secondary">No significant weaknesses were detected.</p>}
          </Card>
          <Card className="p-6"><h2 className="mb-4 text-lg font-bold text-text-primary">Detected skills</h2>
            {report.detected_skills.length ? <div className="flex flex-wrap gap-2">{report.detected_skills.map((skill) => <Badge key={skill} variant="success" className="px-2.5 py-1.5 text-xs">{skill}</Badge>)}</div> : <p className="text-sm text-text-secondary">No skills could be identified from the resume text.</p>}
          </Card>
          <Card className="p-6"><h2 className="mb-4 text-lg font-bold text-text-primary">Missing skills</h2>
            {report.missing_skills.length ? <div className="flex flex-wrap gap-2">{report.missing_skills.map((skill) => <Badge key={skill} variant="warning" className="px-2.5 py-1.5 text-xs">{skill}</Badge>)}</div> : <p className="text-sm text-text-secondary">No additional skills were identified as missing for the selected career target.</p>}
          </Card>
          <Card className="p-6 md:col-span-2"><h2 className="mb-5 text-lg font-bold text-text-primary">Improvement suggestions</h2>
            {report.suggestions.length ? <div className="space-y-3">{report.suggestions.map((suggestion, index) => <div key={`${suggestion.section}-${index}`} className="rounded-lg border border-border bg-bg-page p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant={suggestion.priority === 'high' ? 'danger' : suggestion.priority === 'medium' ? 'warning' : 'info'} className="text-[10px]">{suggestion.priority} priority</Badge><span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{suggestion.section}</span></div>
              <p className="text-sm font-semibold text-text-primary">{suggestion.issue}</p><p className="mt-1 text-sm leading-relaxed text-text-secondary">{suggestion.suggestion}</p>
            </div>)}</div> : <p className="text-sm text-text-secondary">No suggestions were returned for this resume.</p>}
          </Card>
        </div>
        <div className="flex justify-center pb-4 pt-2"><Button variant="outline" onClick={resetFlow} className="gap-2"><RefreshCcw className="h-4 w-4" />Analyze another resume</Button></div>
      </div>}

      <Card className="p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-text-primary">Past analyses</h2><p className="text-sm text-text-secondary">Reopen a report, compare scores, or remove a saved analysis.</p></div>{historyLoading && <span className="text-sm text-text-secondary">Loading history…</span>}</div>
        {historyError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm"><span>Could not load past analyses.</span><Button variant="outline" size="sm" onClick={() => retrySlice('resumeHistory', user?.id)}>Retry</Button></div>}
        {!historyLoading && !historyError && !sortedHistory.length && <p className="rounded-xl border border-dashed border-border bg-bg-page/50 p-5 text-sm text-text-secondary">Your saved resume analyses will appear here.</p>}
        {!!sortedHistory.length && <ol className="divide-y divide-border">
          {sortedHistory.map((item, index) => {
            const previous = sortedHistory[index + 1];
            const change = previous ? item.atsScore - previous.atsScore : null;
            return <li key={item.id} className="flex flex-col gap-3 py-4 first:pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="truncate font-semibold text-text-primary">{item.fileName}</p><p className="mt-1 text-sm text-text-secondary">{formatDate(item.analyzedAt)} · Score {item.atsScore}/100{change !== null && <span className={change >= 0 ? 'text-success' : 'text-danger'}> · {change > 0 ? '+' : ''}{change} vs previous</span>}</p></div>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={openingId === item.id} isLoading={openingId === item.id} onClick={() => openAnalysis(item.id)}>Open report</Button>
                {confirmDeleteId === item.id ? <><Button type="button" variant="outline" size="sm" disabled={busyDeleteId === item.id} onClick={() => setConfirmDeleteId('')}>Cancel</Button><Button type="button" variant="outline" size="sm" className="text-danger" isLoading={busyDeleteId === item.id} onClick={() => removeAnalysis(item.id)}>Confirm delete</Button></> : <Button type="button" variant="ghost" size="sm" aria-label={`Delete ${item.fileName}`} onClick={() => setConfirmDeleteId(item.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>}
              </div>
            </li>;
          })}
        </ol>}
      </Card>
    </div>
  );
}
