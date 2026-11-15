import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUserDataStore } from '../store/userDataStore';

/**
 * UserDataProvider — wraps the authenticated portion of the app.
 *
 * As soon as a signed-in user is detected it kicks off the parallel
 * bootstrap fetch (Promise.allSettled). While that is in progress a
 * branded loading screen is shown. Once all slices settle (success or
 * per-slice error) the children are rendered and every page reads from
 * the store instantly.
 *
 * Partial failures: a dismissible banner is shown for each failed slice
 * with a one-click retry; the rest of the app renders normally.
 *
 * On logout the store is cleared so no stale data leaks to the next user.
 */
export default function UserDataProvider({ children }) {
  const user            = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionReady    = useAuthStore((s) => s.sessionReady);

  const bootstrapping = useUserDataStore((s) => s.bootstrapping);
  const bootstrapped  = useUserDataStore((s) => s.bootstrapped);
  const dataUserId    = useUserDataStore((s) => s.dataUserId);
  const fetchAll      = useUserDataStore((s) => s.fetchAll);
  const retrySlice    = useUserDataStore((s) => s.retrySlice);
  const clear         = useUserDataStore((s) => s.clear);

  // Track the user id we already bootstrapped for so we don't re-fetch
  // on every render, but DO re-fetch when the user changes (account switch).
  const bootstrappedForRef = useRef(null);

  useEffect(() => {
    if (!sessionReady) return;

    if (isAuthenticated && user?.id && bootstrappedForRef.current !== user.id) {
      clear();
      bootstrappedForRef.current = user.id;
      fetchAll(user.id);
    }

    if (!isAuthenticated) {
      // User logged out — wipe everything and reset the ref
      bootstrappedForRef.current = null;
      clear();
    }
  }, [isAuthenticated, sessionReady, user?.id, fetchAll, clear]);

  // Still bootstrapping → show branded loading screen
  if (!sessionReady || (isAuthenticated && (bootstrapping || !bootstrapped || dataUserId !== user?.id))) {
    return <BootstrapLoader />;
  }

  return (
    <>
      {/* Partial-failure retry banners — rendered above page content */}
      {bootstrapped && <SliceErrorBanners userId={user?.id} retrySlice={retrySlice} />}
      {children}
    </>
  );
}

// ─── Partial-failure retry banners ───────────────────────────────────────────

const SLICE_LABELS = {
  profile:               'Profile',
  dashboardData:         'Dashboard data',
  roadmaps:              'Roadmap catalogue',
  selectedRoadmapIds:    'Your roadmap selections',
  userRoadmaps:          'Your roadmaps',
  overallProgress:       'Overall progress',
  careerRecommendations: 'Career recommendations',
  assessments:           'Assessments',
  completedAssessmentIds:'Completed assessments',
  assessmentScores:      'Assessment scores',
  resumeHistory:         'Resume history',
  roadmapDetails:        'Roadmap details',
  userSubtopicProgress:  'Roadmap progress',
  settings:              'Settings and preferences',
  courseRecommendations: 'Course recommendations',
  opportunityRecommendations: 'Job recommendations',
};

function SliceErrorBanners({ userId, retrySlice }) {
  const store = useUserDataStore();

  const failedSlices = Object.keys(SLICE_LABELS).filter(
    (key) => store[`${key}Error`]
  );

  if (failedSlices.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {failedSlices.map((key) => (
        <div
          key={key}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warning/40 bg-warning/10 text-sm"
        >
          <span className="text-warning font-semibold shrink-0">⚠</span>
          <span className="flex-1 text-text-primary">
            Failed to load <strong>{SLICE_LABELS[key]}</strong>.{' '}
            <span className="text-text-secondary text-xs">{store[`${key}Error`]}</span>
          </span>
          <button
            onClick={() => retrySlice(key, userId)}
            disabled={store[`${key}Loading`]}
            className="shrink-0 text-xs font-bold text-warning hover:underline disabled:opacity-50"
          >
            {store[`${key}Loading`] ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Loading screen (uses existing color tokens) ──────────────────────────────

function BootstrapLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-page text-text-primary transition-colors duration-300">
      {/* Animated spinner ring */}
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-sage/30" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-terracotta animate-spin" />
      </div>

      <h2 className="text-xl font-semibold text-navy mb-2">Loading your workspace…</h2>
      <p className="text-sm text-sage">Fetching your profile, roadmaps, and more</p>
    </div>
  );
}
