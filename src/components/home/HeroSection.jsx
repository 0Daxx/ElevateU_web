import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Compass, GraduationCap, Sparkles } from 'lucide-react';
import Button from '../ui/Button';

const BENEFITS = [
  { number: '01', title: 'Know your strengths', detail: 'Skill assessments built around you', icon: Sparkles },
  { number: '02', title: 'Find your direction', detail: 'Career paths that fit your goals', icon: Compass },
  { number: '03', title: 'Learn with purpose', detail: 'A roadmap for your next steps', icon: BookOpenCheck },
  { number: '04', title: 'Grow with confidence', detail: 'Support whenever you need it', icon: GraduationCap },
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <>
      <section className="relative isolate flex min-h-[570px] items-center overflow-hidden bg-primary sm:min-h-[620px]">
        <img
          src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=2200&q=85"
          alt="University students learning together on campus"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#172543]/90 via-[#172543]/75 to-[#172543]/25" />
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-10 lg:py-28">
          <div className="max-w-3xl text-white">
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-amber-300 sm:text-sm">
              <span className="h-px w-8 bg-amber-300" /> Your future starts here
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Find your path.<br />Build a future <span className="text-amber-300">you love.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
              Discover what you’re good at, explore careers that fit, and turn your next steps into a plan you can follow.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" size="lg" className="group w-full justify-center bg-amber-400 px-7 text-primary hover:bg-amber-300 sm:w-auto" onClick={() => navigate('/signup')}>
                Start your journey <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="lg" className="w-full justify-center border-white/60 bg-white/10 px-7 text-white hover:bg-white/20 sm:w-auto" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore ElevateU
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-white/80">
              <span>Personalized career guidance</span><span className="hidden h-1 w-1 rounded-full bg-amber-300 sm:block" />
              <span>Practical learning roadmaps</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-5 right-6 hidden items-center gap-2 text-xs font-semibold text-white/70 md:flex">
          <span className="h-px w-10 bg-white/50" /> Learning, with direction
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-8 grid w-full max-w-7xl grid-cols-1 gap-3 px-5 sm:grid-cols-2 sm:px-10 lg:-mt-12 lg:grid-cols-4 lg:gap-4">
        {BENEFITS.map(({ number, title, detail, icon: Icon }) => (
          <article key={number} className="group flex min-h-[132px] items-start gap-4 rounded-2xl border border-border bg-bg-surface p-5 shadow-[0_12px_35px_rgba(26,46,83,0.10)] transition-transform duration-200 hover:-translate-y-1 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-sm font-extrabold text-text-primary sm:text-base">{title}</h2><span className="font-serif text-lg text-secondary/70">{number}</span></div><p className="text-sm leading-5 text-text-secondary">{detail}</p></div>
          </article>
        ))}
      </div>
    </>
  );
}
