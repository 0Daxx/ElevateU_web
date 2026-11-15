import { create } from 'zustand';
import { getProfile, updateProfile } from '../services/profileService';
import { getDashboardData } from '../services/dashboardService';
import {
  fetchAllRoadmaps,
  fetchUserSelectedIds,
  fetchActiveRoadmapDetail,
  fetchUserRoadmaps,
  computeRoadmapProgress,
  getOverallProgress,
  toggleSubtopicProgress,
  addRoadmapSelection,
} from '../services/roadmapService';
import { getRecommendations, getSkillGapAnalysis } from '../services/careerService';
import {
  getAssessments,
  getCompletedAssessments,
  getAssessmentScores,
} from '../services/assessmentService';
import { getResumeHistory } from '../services/resumeService';

/**
 * Slice keys that map 1-to-1 with the parallel bootstrap fetches.
 * Each slice has: data, loading, error.
 */
const SLICE_KEYS = [
  'profile',
  'dashboardData',
  'roadmaps',
  'selectedRoadmapIds',
  'userRoadmaps',
  'overallProgress',
  'careerRecommendations',
  'assessments',
  'completedAssessmentIds',
  'assessmentScores',
  'resumeHistory',
];

/** Build the initial (empty) state for every data slice. */
function emptySlices() {
  const slices = {};
  SLICE_KEYS.forEach((key) => {
    slices[key] = null;
    slices[`${key}Loading`] = false;
    slices[`${key}Error`] = null;
  });
  return slices;
}

/**
 * Central user-data store (Zustand) — populated once after login,
 * consumed by every dashboard page so they render instantly.
 */
export const useUserDataStore = create((set, get) => ({
  ...emptySlices(),

  /** True while the initial parallel bootstrap is in-flight. */
  bootstrapping: false,
  /** True once fetchAll has completed at least once. */
  bootstrapped: false,

  // ─── Active-roadmap detail (loaded lazily when user picks a roadmap) ──
  activeRoadmapId: null,
  activeRoadmap: null,
  activeRoadmapProgress: null,
  activeRoadmapLoading: false,
  activeRoadmapError: null,

  // ────────────────────────────────────────────────────────────────────────
  //  Bootstrap: parallel fetch of all lightweight per-user data
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Kick off all fetches in parallel. Uses Promise.allSettled so partial
   * failures don't block the rest of the UI.
   * @param {string} userId
   */
  fetchAll: async (userId) => {
    if (!userId) return;
    set({ bootstrapping: true });

    /** Helper: wrap a fetch, set per-slice loading/error/data. */
    const fetchSlice = async (key, fetcher) => {
      set({ [`${key}Loading`]: true, [`${key}Error`]: null });
      try {
        const data = await fetcher();
        set({ [key]: data, [`${key}Loading`]: false });
        return data;
      } catch (err) {
        console.error(`[UserDataStore] Failed to fetch "${key}":`, err);
        set({ [`${key}Error`]: err?.message || String(err), [`${key}Loading`]: false });
        return null;
      }
    };

    await Promise.allSettled([
      fetchSlice('profile',               () => getProfile(userId)),
      fetchSlice('dashboardData',          () => getDashboardData(userId)),
      fetchSlice('roadmaps',               () => fetchAllRoadmaps()),
      fetchSlice('selectedRoadmapIds',     () => fetchUserSelectedIds(userId)),
      fetchSlice('userRoadmaps',           () => fetchUserRoadmaps(userId)),
      fetchSlice('overallProgress',        () => getOverallProgress()),
      fetchSlice('careerRecommendations',  () => getRecommendations()),
      fetchSlice('assessments',            () => getAssessments()),
      fetchSlice('completedAssessmentIds', () => Promise.resolve(getCompletedAssessments())),
      fetchSlice('assessmentScores',       () => Promise.resolve(getAssessmentScores())),
      fetchSlice('resumeHistory',          () => getResumeHistory()),
    ]);

    set({ bootstrapping: false, bootstrapped: true });
  },

  /**
   * Retry a single failed slice.
   * @param {string} key   Slice name (must be one of SLICE_KEYS)
   * @param {string} userId
   */
  retrySlice: async (key, userId) => {
    const fetcherMap = {
      profile:               () => getProfile(userId),
      dashboardData:         () => getDashboardData(userId),
      roadmaps:              () => fetchAllRoadmaps(),
      selectedRoadmapIds:    () => fetchUserSelectedIds(userId),
      userRoadmaps:          () => fetchUserRoadmaps(userId),
      overallProgress:       () => getOverallProgress(),
      careerRecommendations: () => getRecommendations(),
      assessments:           () => getAssessments(),
      completedAssessmentIds: () => Promise.resolve(getCompletedAssessments()),
      assessmentScores:      () => Promise.resolve(getAssessmentScores()),
      resumeHistory:         () => getResumeHistory(),
    };

    const fetcher = fetcherMap[key];
    if (!fetcher) return;

    set({ [`${key}Loading`]: true, [`${key}Error`]: null });
    try {
      const data = await fetcher();
      set({ [key]: data, [`${key}Loading`]: false });
    } catch (err) {
      console.error(`[UserDataStore] Retry "${key}" failed:`, err);
      set({ [`${key}Error`]: err?.message || String(err), [`${key}Loading`]: false });
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  //  Active roadmap detail (loaded on demand when user selects a roadmap)
  // ────────────────────────────────────────────────────────────────────────

  loadActiveRoadmap: async (roadmapId, userId) => {
    if (!roadmapId) {
      set({ activeRoadmapId: null, activeRoadmap: null, activeRoadmapProgress: null });
      return;
    }
    set({ activeRoadmapId: roadmapId, activeRoadmapLoading: true, activeRoadmapError: null });
    try {
      const [detail, progress] = await Promise.all([
        fetchActiveRoadmapDetail(userId),
        computeRoadmapProgress(userId, roadmapId),
      ]);
      set({
        activeRoadmap: detail,
        activeRoadmapProgress: progress,
        activeRoadmapLoading: false,
      });
    } catch (err) {
      console.error('[UserDataStore] loadActiveRoadmap failed:', err);
      set({ activeRoadmapError: err?.message || String(err), activeRoadmapLoading: false });
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  //  Optimistic mutations
  // ────────────────────────────────────────────────────────────────────────

  /** Update profile optimistically, then persist. */
  updateProfileOpt: async (userId, updates) => {
    const prev = get().profile;
    // Optimistic
    set({ profile: { ...prev, ...updates } });
    try {
      const result = await updateProfile(updates);
      const persisted = result?.profile ?? result;
      set({ profile: persisted });
      return persisted;
    } catch (err) {
      // Rollback
      set({ profile: prev });
      throw err;
    }
  },

  /** Add a roadmap selection optimistically. */
  addRoadmapSelection: async (userId, roadmapId) => {
    const prevIds = get().selectedRoadmapIds || new Set();
    const prevRoadmaps = get().userRoadmaps || [];
    // Optimistic
    const newIds = new Set([...prevIds, roadmapId]);
    set({ selectedRoadmapIds: newIds });
    try {
      await addRoadmapSelection(userId, roadmapId);
      // Refresh userRoadmaps list
      const freshRoadmaps = await fetchUserRoadmaps(userId);
      set({ userRoadmaps: freshRoadmaps });
    } catch (err) {
      set({ selectedRoadmapIds: prevIds, userRoadmaps: prevRoadmaps });
      throw err;
    }
  },

  /** Toggle subtopic completion optimistically. */
  toggleSubtopic: async (userId, subtopicId, currentStatus) => {
    const activeRoadmap = get().activeRoadmap;
    if (activeRoadmap) {
      // Optimistically toggle in the activeRoadmap detail tree
      const updated = JSON.parse(JSON.stringify(activeRoadmap));
      for (const topic of updated.topics || []) {
        for (const sub of topic.subtopics || []) {
          if (sub.id === subtopicId) {
            sub.status = currentStatus === 'completed' ? 'not_started' : 'completed';
          }
        }
      }
      set({ activeRoadmap: updated });
    }

    try {
      await toggleSubtopicProgress(userId, subtopicId, currentStatus);
      // Recompute progress
      const roadmapId = get().activeRoadmap?.roadmap?.id;
      if (roadmapId) {
        const progress = await computeRoadmapProgress(userId, roadmapId);
        const overall = await getOverallProgress();
        set({ activeRoadmapProgress: progress, overallProgress: overall });
      }
    } catch (err) {
      // Rollback
      set({ activeRoadmap });
      throw err;
    }
  },

  /** After a resume is analyzed, prepend to history. */
  addResumeAnalysis: (analysis) => {
    const prev = get().resumeHistory || [];
    set({ resumeHistory: [analysis, ...prev] });
  },

  /** After an assessment is submitted, update completed lists and scores. */
  markAssessmentCompleted: (assessmentId, score) => {
    const prevIds = get().completedAssessmentIds || new Set();
    const updatedIds = new Set([...prevIds, assessmentId]);
    set({ completedAssessmentIds: updatedIds });
    const prevScores = get().assessmentScores || {};
    set({ assessmentScores: { ...prevScores, [assessmentId]: score } });
  },

  // ────────────────────────────────────────────────────────────────────────
  //  Logout / clear
  // ────────────────────────────────────────────────────────────────────────

  /** Nuke all user data from the store — called on logout. */
  clear: () => {
    set({
      ...emptySlices(),
      bootstrapping: false,
      bootstrapped: false,
      activeRoadmapId: null,
      activeRoadmap: null,
      activeRoadmapProgress: null,
      activeRoadmapLoading: false,
      activeRoadmapError: null,
    });
  },
}));
