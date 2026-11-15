import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Download, KeyRound, LockKeyhole, Moon, Sun, UserRound, ShieldCheck, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useUserDataStore } from '../store/userDataStore';
import { useThemeStore } from '../store/themeStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SEO from '../components/SEO';
import { getUserActivities } from '../utils/activityLogger';
import { deleteUserApiKey, listUserApiKeys, saveUserApiKey } from '../services/apiKeyService';

const inputClass = 'w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:ring-2 focus:ring-accent/40';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const profile = useUserDataStore((state) => state.profile);
  const settings = useUserDataStore((state) => state.settings) || {};
  const updateProfileOpt = useUserDataStore((state) => state.updateProfileOpt);
  const updateSettings = useUserDataStore((state) => state.updateSettings);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [name, setName] = useState(profile?.personal?.name || user?.name || '');
  const [password, setPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeyInputs, setApiKeyInputs] = useState({ groq: '', cerebras: '' });
  const [apiKeyBusy, setApiKeyBusy] = useState('');
  const [apiKeyMessage, setApiKeyMessage] = useState({});

  const email = useMemo(() => user?.email || profile?.personal?.email || '', [user?.email, profile?.personal?.email]);

  useEffect(() => {
    if ((settings.theme === 'light' || settings.theme === 'dark') && settings.theme !== theme) toggleTheme();
  }, [settings.theme, theme, toggleTheme]);

  useEffect(() => {
    let active = true;
    listUserApiKeys().then((keys) => { if (active) setApiKeys(keys); })
      .catch((err) => { if (active) setApiKeyMessage({ error: err.message || 'Could not load saved API keys.' }); });
    return () => { active = false; };
  }, []);

  const refreshApiKeys = async () => setApiKeys(await listUserApiKeys());
  const saveApiKey = async (provider) => {
    const key = apiKeyInputs[provider];
    if (!key) return;
    setApiKeyBusy(provider); setApiKeyMessage({});
    try {
      const result = await saveUserApiKey(provider, key, apiKeys.some((item) => item.provider === provider) ? 'replace' : 'save');
      setApiKeyInputs((current) => ({ ...current, [provider]: '' }));
      await refreshApiKeys();
      setApiKeyMessage({ success: result.message });
    } catch (err) { setApiKeyMessage({ error: err.message || 'Could not save this API key.' }); }
    finally { setApiKeyBusy(''); }
  };
  const removeApiKey = async (provider) => {
    setApiKeyBusy(provider); setApiKeyMessage({});
    try {
      const result = await deleteUserApiKey(provider);
      await refreshApiKeys();
      setApiKeyMessage({ success: result.message });
    } catch (err) { setApiKeyMessage({ error: err.message || 'Could not remove this API key.' }); }
    finally { setApiKeyBusy(''); }
  };

  const saveName = async (event) => {
    event.preventDefault();
    if (!name.trim() || !user?.id) return;
    setError(''); setFeedback(''); setSavingName(true);
    try {
      await updateProfileOpt(user.id, { personal: { ...profile?.personal, name: name.trim() } });
      setFeedback('Display name updated.');
    } catch (err) { setError(err.message || 'Could not update your display name.'); }
    finally { setSavingName(false); }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (password.length < 8) { setError('Choose a password with at least 8 characters.'); return; }
    setError(''); setFeedback(''); setSavingPassword(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setPassword(''); setFeedback('Password changed.');
    } catch (err) { setError(err.message || 'Could not change your password.'); }
    finally { setSavingPassword(false); }
  };

  const exportData = async () => {
    setError(''); setFeedback(''); setBusyAction('export');
    try {
      const { data, error: exportError } = await supabase.functions.invoke('account-data', { body: { action: 'export' } });
      if (exportError) throw exportError;
      const cached = useUserDataStore.getState();
      const exportPayload = {
        ...data,
        appData: {
          profile: cached.profile,
          completedAssessmentIds: Array.from(cached.completedAssessmentIds || []),
          assessmentScores: cached.assessmentScores || {},
          selectedRoadmapIds: Array.from(cached.selectedRoadmapIds || []),
          roadmapSelections: cached.userRoadmaps || [],
          subtopicProgress: cached.userSubtopicProgress || {},
          resumeAnalysisHistory: cached.resumeHistory || [],
          preferences: cached.settings || {},
          careerRecommendations: cached.careerRecommendations || [],
          courseRecommendations: cached.courseRecommendations || [],
          opportunityRecommendations: cached.opportunityRecommendations || [],
          activity: getUserActivities(user.id),
        },
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `elevateu-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setFeedback('Your data export is ready.');
    } catch (err) { setError(err.message || 'Could not export your data. Make sure the account-data function is deployed.'); }
    finally { setBusyAction(''); }
  };

  const deleteAccount = async () => {
    if (deleteText !== 'DELETE') return;
    setError(''); setDeleting(true);
    try {
      const { error: deleteError } = await supabase.functions.invoke('account-data', { body: { action: 'delete' } });
      if (deleteError) throw deleteError;
      [
        'profile', 'completed_assessments', 'assessment_scores', 'roadmap_selections',
        'active_roadmap', 'subtopic_progress', 'resume_history', 'settings', 'activity',
      ].forEach((key) => localStorage.removeItem(`elevateu_${key}_${user.id}`));
      logout();
      navigate('/login', { replace: true });
    } catch (err) { setError(err.message || 'Could not delete your account.'); setDeleting(false); }
  };

  const setTheme = (nextTheme) => {
    if (theme !== nextTheme) toggleTheme();
    updateSettings(user.id, { theme: nextTheme });
  };

  const deviceSignOut = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SEO title="Settings" noIndex />
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Your account</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-text-secondary">Manage your account and privacy preferences.</p>
      </header>

      {feedback && <div role="status" className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-text-primary"><Check className="h-4 w-4 text-success" />{feedback}</div>}
      {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-text-primary">{error}</div>}

      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><UserRound className="h-5 w-5" /></span><div><h2 className="text-lg font-bold">Account</h2><p className="text-sm text-text-secondary">Your personal account details.</p></div></div>
        <form onSubmit={saveName} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block space-y-2 text-sm font-semibold">Display name<input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
          <Button type="submit" isLoading={savingName} disabled={!name.trim() || name.trim() === profile?.personal?.name}>Save name</Button>
        </form>
        <label className="mt-4 block space-y-2 text-sm font-semibold">Email address<input className={`${inputClass} opacity-70`} value={email} readOnly aria-readonly="true" /></label>
        <form onSubmit={changePassword} className="mt-6 border-t border-border pt-5">
          <label className="block space-y-2 text-sm font-semibold">Change password<input className={inputClass} type="password" minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <Button type="submit" variant="outline" className="mt-3 gap-2" isLoading={savingPassword} disabled={!password}><LockKeyhole className="h-4 w-4" />Update password</Button>
        </form>
        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Sign out of this device</h3><p className="text-sm text-text-secondary">End your current session on this browser.</p></div><Button variant="outline" onClick={deviceSignOut}>Sign out</Button></div>
      </Card>

      <Card className="p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-secondary/15 p-2.5 text-secondary"><Sun className="h-5 w-5" /></span><div><h2 className="text-lg font-bold">Preferences</h2><p className="text-sm text-text-secondary">Choose the appearance used in ElevateU.</p></div></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([value, label, Icon]) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)} className={`flex flex-1 items-center gap-3 rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 ${theme === value ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg-page'}`}><Icon className="h-5 w-5 text-accent" /><span className="font-semibold">{label}</span>{theme === value && <Check className="ml-auto h-4 w-4 text-success" />}</button>)}
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <div className="mb-3 flex items-center gap-3"><span className="rounded-xl bg-secondary/15 p-2.5 text-secondary"><KeyRound className="h-5 w-5" /></span><h2 className="text-lg font-bold">API Keys</h2></div>
        <p className="text-sm text-text-secondary">Keys are encrypted at rest and only used to make requests on your behalf.</p>
        {apiKeyMessage.success && <p role="status" className="mt-3 text-sm text-success">{apiKeyMessage.success}</p>}
        {apiKeyMessage.error && <p role="alert" className="mt-3 text-sm text-danger">{apiKeyMessage.error}</p>}
        <div className="mt-5 space-y-4">
          {[["groq", "Groq"], ["cerebras", "Cerebras"]].map(([provider, label]) => {
            const saved = apiKeys.find((item) => item.provider === provider);
            return <div key={provider} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-semibold">{label}</h3>{saved && <p className="mt-1 text-sm text-text-secondary">••••{saved.key_last4} · <span className={saved.status === 'active' ? 'text-success' : 'text-danger'}>{saved.status === 'active' ? 'Active' : 'Invalid — replace this key'}</span> · Added {new Date(saved.created_at).toLocaleDateString()}</p>}</div>
                {saved && <Button type="button" variant="outline" className="gap-2 text-danger" disabled={apiKeyBusy === provider} onClick={() => removeApiKey(provider)}><Trash2 className="h-4 w-4" />Remove</Button>}
              </div>
              <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); saveApiKey(provider); }}>
                <label className="sr-only" htmlFor={`${provider}-api-key`}>{label} API key</label>
                <input id={`${provider}-api-key`} className={inputClass} type="password" autoComplete="new-password" autoCapitalize="none" spellCheck="false" value={apiKeyInputs[provider]} onChange={(event) => setApiKeyInputs((current) => ({ ...current, [provider]: event.target.value }))} placeholder={saved ? 'Enter a replacement key' : `Paste your ${label} API key`} />
                <Button type="submit" className="shrink-0 gap-2" disabled={!apiKeyInputs[provider]} isLoading={apiKeyBusy === provider}>{saved && <RefreshCw className="h-4 w-4" />}{saved ? 'Replace key' : 'Verify & save'}</Button>
              </form>
            </div>;
          })}
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-border pt-5">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={settings.useOnlyMyKeys === true} onChange={(event) => updateSettings(user.id, { useOnlyMyKeys: event.target.checked })} />
          <span><span className="block font-semibold">Use only my keys</span><span className="text-sm text-text-secondary">When enabled, AI requests use your verified provider keys and never fall back to ElevateU keys.</span></span>
        </label>
      </Card>

      <Card className="p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-lg font-bold">Data &amp; Privacy</h2><p className="text-sm text-text-secondary">Access your information or permanently close your account.</p></div></div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Export my data</h3><p className="text-sm text-text-secondary">Download a JSON copy of your account data.</p></div><Button variant="outline" className="gap-2" onClick={exportData} isLoading={busyAction === 'export'}><Download className="h-4 w-4" />Export JSON</Button></div>
        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-danger">Delete my account</h3><p className="text-sm text-text-secondary">Permanently delete your account and its saved rows.</p></div><Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10" onClick={() => { setDeleteOpen(true); setDeleteText(''); }}><AlertTriangle className="mr-2 h-4 w-4" />Delete account</Button></div>
      </Card>

      {deleteOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteOpen(false); }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description" className="w-full max-w-md rounded-2xl border border-border bg-bg-surface p-6 shadow-2xl"><h2 id="delete-title" className="text-xl font-extrabold text-danger">Delete your account?</h2><p id="delete-description" className="mt-2 text-sm leading-relaxed text-text-secondary">This permanently deletes your profile, saved roadmap selections, progress, and sign-in account. This action cannot be undone.</p><label className="mt-5 block space-y-2 text-sm font-semibold">Type DELETE to confirm<input className={inputClass} value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" /></label><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button className="bg-danger hover:bg-danger/90 focus:ring-danger" disabled={deleteText !== 'DELETE'} isLoading={deleting} onClick={deleteAccount}>Delete account</Button></div></section></div>}
    </div>
  );
}

