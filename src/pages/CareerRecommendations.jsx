import React from 'react';
import SEO from '../components/SEO';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, BriefcaseBusiness, ChartNoAxesCombined, Compass, GraduationCap,
  IndianRupee, Layers3, Lightbulb, Palette, TrendingDown, TrendingUp, Minus,
} from 'lucide-react';
import { useUserDataStore } from '../store/userDataStore';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';

function MatchRing({ value }) {
  const size = 60;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (value / 100) * circumference;

  let colorClass = 'stroke-secondary';
  if (value >= 80) colorClass = 'stroke-success';
  else if (value < 50) colorClass = 'stroke-border';

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" aria-label={`${value}% profile match`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className={colorClass} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-text-primary">
        <span className="text-sm font-extrabold leading-none">{value}%</span>
      </div>
    </div>
  );
}

function GrowthIcon({ growth }) {
  if (growth === 'High') return <TrendingUp className="h-4 w-4 text-success" title="High growth" />;
  if (growth === 'Low') return <TrendingDown className="h-4 w-4 text-danger" title="Low growth" />;
  return <Minus className="h-4 w-4 text-warning" title="Medium growth" />;
}

function CareerArtwork({ career, index }) {
  const title = `${career.title} ${career.category || ''}`.toLowerCase();
  const Icon = /design|creative|art/.test(title) ? Palette
    : /data|analyst|finance/.test(title) ? ChartNoAxesCombined
      : /engineer|developer|software|technology/.test(title) ? Layers3
        : /teacher|education|counsel/.test(title) ? GraduationCap
          : /research|science/.test(title) ? Lightbulb : BriefcaseBusiness;
  const backgrounds = [
    'from-primary/10 via-accent-soft to-secondary/15',
    'from-secondary/15 via-bg-page to-primary/10',
    'from-accent-soft via-bg-page to-warning/10',
    'from-warning/10 via-bg-page to-secondary/15',
  ];

  return (
    <div className={`relative flex h-36 items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${backgrounds[index % backgrounds.length]} px-5`}>
      <div aria-hidden="true" className="absolute -right-5 -top-14 h-44 w-44 rounded-full border border-primary/10" />
      <div aria-hidden="true" className="absolute -right-1 -top-10 h-36 w-36 rounded-full border border-primary/10" />
      <div className="relative z-10 max-w-[70%]">
        <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-text-secondary">Career pathway</span>
        <p className="mt-2 line-clamp-2 text-xl font-black leading-tight text-text-primary">{career.title}</p>
      </div>
      <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-bg-surface/75 text-primary shadow-sm backdrop-blur-sm">
        <Icon className="h-8 w-8" strokeWidth={1.7} aria-hidden="true" />
      </div>
      <span className="absolute bottom-3 right-4 font-serif text-5xl font-bold text-primary/[0.08]">0{(index % 9) + 1}</span>
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value, tone = 'primary' }) {
  const iconTone = tone === 'success' ? 'bg-success/10 text-success' : tone === 'accent' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary';
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone}`}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0"><p className="text-lg font-extrabold leading-none text-white">{value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">{label}</p></div>
    </div>
  );
}

export default function CareerRecommendations() {
  const navigate = useNavigate();
  const careers = useUserDataStore((s) => s.careerRecommendations) ?? [];
  const loading = useUserDataStore((s) => s.careerRecommendationsLoading);
  const error = useUserDataStore((s) => s.careerRecommendationsError);
  const retrySlice = useUserDataStore((s) => s.retrySlice);
  const handleRetry = () => retrySlice('careerRecommendations');
  const bestMatch = careers.length ? Math.max(...careers.map((career) => Number(career.matchPercent) || 0)) : 0;
  const categoryCount = new Set(careers.map((career) => career.category).filter(Boolean)).size;

  return (
    <div className="space-y-8 pt-2 sm:space-y-10">
      <SEO title="Career Recommendations" noIndex={true} />

      <section className="relative isolate overflow-hidden rounded-[26px] bg-primary px-5 py-7 shadow-[0_16px_40px_rgba(38,59,128,0.16)] sm:px-8 sm:py-9 lg:px-10">
        <div aria-hidden="true" className="absolute -right-10 -top-24 -z-10 h-80 w-80 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-2 -top-16 -z-10 h-64 w-64 rounded-full border border-white/10" />
        <div className="absolute bottom-0 right-0 -z-10 h-36 w-1/2 bg-gradient-to-l from-secondary/20 to-transparent" />
        <div className="grid items-end gap-7 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/85">
              <Compass className="h-3.5 w-3.5 text-amber-300" /> Made around your strengths
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Career possibilities</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70 sm:text-base">Explore roles aligned with your profile and assessments. Compare your fit, growth outlook, and salary range to decide where you’d like to go next.</p>
          </div>
          {!loading && !error && careers.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[390px]">
              <SummaryStat icon={BriefcaseBusiness} label="Matches" value={careers.length} />
              <SummaryStat icon={ChartNoAxesCombined} label="Best fit" value={`${bestMatch}%`} tone="success" />
              <SummaryStat icon={Layers3} label="Fields" value={categoryCount} tone="accent" />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="matches-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Your next chapter</p>
            <h2 id="matches-heading" className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">Best matches</h2>
          </div>
          {!loading && !error && careers.length > 0 && <span className="rounded-full border border-border bg-bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary">{careers.length} career{careers.length === 1 ? '' : 's'} to explore</span>}
        </div>

        {error ? (
          <ErrorState onRetry={handleRetry} />
        ) : loading || careers.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-80" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            {careers.map((career, index) => (
              <Card
                key={career.id}
                role="link"
                tabIndex={0}
                aria-label={`View ${career.title} career details`}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/career-recommendations/${career.id}`); } }}
                className="group flex cursor-pointer flex-col rounded-[22px] border-border/80 p-3.5 transition-all duration-200 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-[0_18px_40px_rgba(38,59,128,0.12)] focus:outline-none focus:ring-4 focus:ring-primary/20 sm:p-4"
                onClick={() => navigate(`/career-recommendations/${career.id}`)}
              >
                <div className="relative">
                  <CareerArtwork career={career} index={index} />
                  <div className="absolute right-3 top-3 flex max-w-[55%] items-center gap-1.5 rounded-full border border-white/70 bg-bg-surface/90 px-2.5 py-1 text-[10px] font-bold text-text-primary shadow-sm backdrop-blur-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${career.matchPercent >= 80 ? 'bg-success' : 'bg-secondary'}`} />
                    {career.category || 'Career match'}
                  </div>
                </div>

                <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-text-secondary">Career match</p>
                      <h3 className="text-lg font-extrabold leading-snug text-text-primary transition-colors group-hover:text-secondary">{career.title}</h3>
                    </div>
                    <MatchRing value={career.matchPercent} />
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[42px] text-sm leading-[21px] text-text-secondary">{career.description}</p>

                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border/70" aria-hidden="true">
                    <div className={`h-full rounded-full ${career.matchPercent >= 80 ? 'bg-success' : 'bg-secondary'}`} style={{ width: `${Math.min(100, Math.max(0, Number(career.matchPercent) || 0))}%` }} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/80 pt-3">
                    <div className="min-w-0"><p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-text-secondary">Salary range</p><div className="flex items-center gap-1 text-xs font-bold text-text-primary"><IndianRupee className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{career.avgSalaryRange}</span></div></div>
                    <div className="min-w-0"><p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-text-secondary">Growth outlook</p><div className="flex items-center gap-1 text-xs font-bold text-text-primary"><GrowthIcon growth={career.growthOutlook} /><span className="truncate">{career.growthOutlook}</span></div></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-bg-page px-3 py-2 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <span>Explore career</span><ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
