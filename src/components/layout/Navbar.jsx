import React, { useEffect, useRef, useState } from 'react';
import { Menu, ChevronDown, UserRound, Settings, MessageSquare, Shield, FileText, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUserDataStore } from '../../store/userDataStore';
import ThemeToggle from '../ui/ThemeToggle';
import { useNavigate } from 'react-router-dom';
// Vite requires static assets inside src/ to be imported as ES modules.
// If logo.png doesn't exist yet, the onError fallback below renders the "EU" badge instead.
import logoSrc from '../../assets/logo.png';

/**
 * Navbar layout component.
 * Features fixed top positioning, visual transitions, logo with error state fallback,
 * responsive toggles, and contextual actions based on auth state.
 *
 * @param {Object} props
 * @param {Function} props.onMenuToggle - Triggers mobile sidebar drawer visibility
 */
export default function Navbar({ onMenuToggle }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [logoFailed, setLogoFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const menuItemsRef = useRef([]);
  const profile = useUserDataStore((state) => state.profile);
  const navigate = useNavigate();

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const displayName = profile?.personal?.name || user?.name || 'Student';
  const displayEmail = user?.email || profile?.personal?.email || '';

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    menuItemsRef.current[0]?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleMenuKeyDown = (event) => {
    const items = menuItemsRef.current.filter(Boolean);
    const index = items.indexOf(document.activeElement);
    let next = null;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  };

  const menuLinks = [
    { label: 'Profile', to: '/profile', icon: UserRound },
    { label: 'Settings', to: '/settings', icon: Settings },
    { label: 'Send Feedback', to: '/feedback', icon: MessageSquare },
    { label: 'Privacy Policy', to: '/privacy', icon: Shield },
    { label: 'Terms of Service', to: '/terms', icon: FileText },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-header-bg/95 backdrop-blur-xl border-b border-border/80 shadow-[0_3px_16px_rgba(38,59,128,0.035)] flex items-center justify-between px-4 sm:px-6 z-40 transition-colors duration-300">
      
      {/* Brand logo & mobile menu triggers */}
      <div className="flex items-center gap-3">
        {isAuthenticated && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-xl text-text-secondary hover:bg-bg-page hover:text-text-primary focus:outline-none transition-colors duration-200"
            aria-label="Open navigation sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        <div className="flex items-center gap-3 group cursor-pointer select-none" onClick={() => navigate('/')}>
          {!logoFailed ? (
            <img
              src={logoSrc}
              alt="ElevateU Logo"
              className="h-8 w-auto object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-secondary text-white font-extrabold text-xs shadow-sm shrink-0">
              EU
            </div>
          )}
          <span className="hidden sm:inline-block text-xs text-text-secondary font-medium tracking-normal border-l border-border pl-3 mt-0.5">
            Elevate Your Skills. Define Your Future.
          </span>
        </div>
      </div>

      {/* Theme Toggling & User Profiles */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        
        {isAuthenticated && (
          <div className="relative pl-3 border-l border-border transition-colors duration-300" ref={menuRef}>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Account menu for ${displayName}`}
              className="flex max-w-[min(58vw,15rem)] items-center gap-2 rounded-2xl p-1.5 text-left hover:bg-accent-soft/70 focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <span className="h-9 w-9 rounded-full bg-secondary/15 text-secondary border border-secondary/20 flex items-center justify-center font-bold text-xs select-none shadow-inner shrink-0">
                {user?.initials || displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U'}
              </span>
              <span className="hidden sm:block min-w-0 truncate text-sm font-semibold text-text-primary">{displayName}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-xl z-[60]">
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-bold text-text-primary">{displayName}</p>
                  <p className="truncate text-xs text-text-secondary">{displayEmail}</p>
                </div>
                <div role="menu" aria-label="Account options" onKeyDown={handleMenuKeyDown} className="p-2">
                  {menuLinks.map(({ label, to, icon: Icon }, index) => (
                    <button
                      key={to}
                      type="button"
                      role="menuitem"
                      ref={(node) => { menuItemsRef.current[index] = node; }}
                      onClick={() => { setMenuOpen(false); navigate(to); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-secondary hover:bg-bg-page hover:text-text-primary focus:bg-bg-page focus:outline-none"
                    >
                      <Icon className="h-4 w-4 shrink-0" />{label}
                    </button>
                  ))}
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    ref={(node) => { menuItemsRef.current[menuLinks.length] = node; }}
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-danger hover:bg-danger/10 focus:bg-danger/10 focus:outline-none"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </nav>
  );
}
