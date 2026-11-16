import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Footer from '../components/layout/Footer';
import ThemeToggle from '../components/ui/ThemeToggle';
import logoSrc from '../assets/logo.png';
// Import new sections
import HeroSection from '../components/home/HeroSection';
import AboutSection from '../components/home/AboutSection';
import StatsStrip from '../components/home/StatsStrip';
import FeaturesGrid from '../components/home/FeaturesGrid';
import HowItWorks from '../components/home/HowItWorks';
import Testimonials from '../components/home/Testimonials';
import CTABanner from '../components/home/CTABanner';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-page transition-colors duration-300 overflow-x-hidden">
      <div className="flex min-h-8 items-center justify-center bg-[#1d695f] px-4 py-1.5 text-center text-[10px] font-semibold tracking-wide text-white sm:justify-between sm:px-10 sm:text-xs">
        <span>Personalized guidance for your next chapter</span>
        <span className="hidden items-center gap-2 text-white/85 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Learn with direction. Grow with confidence.</span>
      </div>
      {/* ─── Top Navigation ────────────────────────────────────────────────── */}
      <nav className="relative z-40 flex h-16 items-center justify-between border-b border-border/80 bg-bg-surface px-4 shadow-[0_3px_16px_rgba(38,59,128,0.035)] sm:h-[72px] sm:px-10">
        {/* Logo Left */}
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => navigate('/')}
        >
          <img src={logoSrc} alt="ElevateU Logo" className="h-8 sm:h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle className="p-2 sm:p-2.5" />
          <div className="flex items-center gap-1 sm:gap-2 pl-2 sm:pl-4 border-l border-border">
            {isAuthenticated ? (
              <Button variant="primary" onClick={() => navigate('/dashboard')} className="whitespace-nowrap px-2.5 sm:px-4 text-xs sm:text-sm">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/login')} className="whitespace-nowrap px-2 sm:px-4 text-xs sm:text-sm">
                  Log in
                </Button>
                <Button variant="primary" onClick={() => navigate('/signup')} className="whitespace-nowrap px-2.5 sm:px-4 text-xs sm:text-sm">
                  Sign up
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col w-full">
        <HeroSection />
        <AboutSection />
        <StatsStrip />
        <FeaturesGrid />
        <HowItWorks />
        <Testimonials />
        <CTABanner />
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <Footer />
      
    </div>
  );
}
