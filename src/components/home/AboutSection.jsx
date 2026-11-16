import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const POINTS = ['Understand your strengths and interests', 'Explore careers that match your profile', 'Build a learning plan with clear next steps'];

export default function AboutSection() {
  const navigate = useNavigate();
  return (
    <section className="overflow-hidden bg-bg-surface px-5 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div className="relative mx-auto grid w-full max-w-[560px] grid-cols-2 items-center gap-3 sm:gap-5">
          <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80" alt="Students working together" className="mt-12 h-56 w-full rounded-[2rem] object-cover shadow-lg sm:h-72" />
          <div className="space-y-3 sm:space-y-5">
            <img src="https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80" alt="Student studying in a library" className="h-44 w-full rounded-full object-cover shadow-lg sm:h-56" />
            <img src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=900&q=80" alt="Students sharing ideas" className="h-40 w-full rounded-[2rem] object-cover shadow-lg sm:h-52" />
          </div>
          <div className="absolute bottom-5 left-0 max-w-[220px] rounded-2xl bg-amber-400 p-4 text-primary shadow-xl sm:bottom-8 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider">Your next step</p><p className="mt-1 text-lg font-black">Starts with you.</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-secondary">A clearer way forward</p>
          <h2 className="text-3xl font-black leading-tight tracking-tight text-text-primary sm:text-5xl">Make your ambition a plan you can follow.</h2>
          <p className="mt-5 text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">Choosing what comes next can feel like a big decision. ElevateU brings your skills, career possibilities, and learning goals together in one place.</p>
          <ul className="mt-7 space-y-4">
            {POINTS.map(point => <li key={point} className="flex items-start gap-3 text-sm font-semibold text-text-primary sm:text-base"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />{point}</li>)}
          </ul>
          <button type="button" onClick={() => navigate('/signup')} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20">Discover your path <ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
}
