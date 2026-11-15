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

export function UserDataErrorNotice({ userId, retrySlice }) {
  const store = useUserDataStore();

  const failedSlices = Object.keys(SLICE_LABELS).filter(
    (key) => store[`${key}Error`]
  );

  if (failedSlices.length === 0) return null;

  return (
    <aside className="mb-6 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm text-text-primary" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-warning" aria-hidden="true">⚠</span>
          <span className="font-semibold">Some workspace data needs attention</span>
          <span className="text-text-secondary">({failedSlices.length})</span>
        </div>
        <details className="group">
          <summary className="cursor-pointer font-semibold text-warning hover:underline">Review and retry</summary>
          <ul className="mt-3 space-y-2">
            {failedSlices.map((key) => {
              const message = String(store[`${key}Error`] || 'Please retry this section.');
              const missingTable = /schema cache|does not exist|could not find the table/i.test(message);
              const friendlyMessage = missingTable && key === 'profile'
                ? 'Profile storage is not set up yet. Run the profile migration in Supabase, then retry.'
                : missingTable && key === 'resumeHistory'
                  ? 'Resume history is not set up yet. Run the resume analysis migration in Supabase, then retry.'
                  : message;
              return (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg-surface/70 px-3 py-2">
                  <span><strong>{SLICE_LABELS[key] || key}:</strong> <span className="text-text-secondary">{friendlyMessage}</span></span>
                  <button
                    onClick={() => retrySlice(key, userId)}
                    disabled={store[`${key}Loading`]}
                    className="shrink-0 font-bold text-warning hover:underline disabled:opacity-50"
                  >
                    {store[`${key}Loading`] ? 'Retrying…' : 'Retry'}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    </aside>
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
