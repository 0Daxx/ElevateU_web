import { create } from 'zustand';
import { getProfile, updateProfile } from '../services/profileService';
import { getDashboardData } from '../services/dashboardService';
import {
  fetchAllRoadmaps,
  fetchUserSelectedIds,
  fetchActiveRoadmapDetail,
  fetchUserRoadmaps,
  fetchUserRoadmapDetails,
  fetchUserSubtopicProgress,
  toggleSubtopicProgress,
  addRoadmapSelection as persistRoadmapSelection,
  setActiveRoadmap as persistActiveRoadmap,
} from '../services/roadmapService';
import { getRecommendations } from '../services/careerService';
import { getCourseRecommendations, getOpportunityRecommendations } from '../services/opportunityService';
import { getAssessments, getCompletedAssessments, getAssessmentScores } from '../services/assessmentService';
import { getResumeHistory } from '../services/resumeService';

const SLICE_FETCHERS = {
  profile: (userId) => getProfile(userId),
  roadmaps: () => fetchAllRoadmaps(),
  selectedRoadmapIds: (userId) => fetchUserSelectedIds(userId),
  userRoadmaps: (userId) => fetchUserRoadmaps(userId),
  roadmapDetails: (userId) => fetchUserRoadmapDetails(userId),
  userSubtopicProgress: (userId) => fetchUserSubtopicProgress(userId),
  assessments: () => getAssessments(),
  completedAssessmentIds: () => Promise.resolve(getCompletedAssessments()),
  assessmentScores: () => Promise.resolve(getAssessmentScores()),
  resumeHistory: (userId) => getResumeHistory(userId),
  settings: (userId) => Promise.resolve(readSettings(userId)),
};

const SLICE_KEYS = [
  ...Object.keys(SLICE_FETCHERS),
  'activeRoadmap',
  'overallProgress',
  'careerRecommendations',
  'courseRecommendations',
  'opportunityRecommendations',
  'dashboardData',
];

function readSettings(userId) {
  try {
    return JSON.parse(localStorage.getItem(`elevateu_settings_${userId}`) || '{}');
  } catch (error) {
    console.warn('[UserDataStore] Could not read user settings:', error);
    return {};
  }
}

function emptySlices() {
  return Object.fromEntries(SLICE_KEYS.flatMap((key) => [
    [key, null], [`${key}Loading`, false], [`${key}Error`, null],
  ]));
}

function buildCareers(profile) {
  if (!profile) throw new Error('Profile data is unavailable. Retry the profile load first.');
  const levels = { Beginner: 1, Intermediate: 2, Advanced: 3 };
  const skills = profile.skills || [];
  const interests = profile.interests || [];
  return getRecommendations(profile).then((careers) => careers.map((career) => ({
    ...career,
    matchedSkills: career.requiredSkills.filter((required) => {
      const skill = skills.find((item) => item.name?.toLowerCase() === required.name.toLowerCase());
      return skill && (levels[skill.level] || 0) >= (levels[required.level] || 0);
    }),
    missingSkills: career.requiredSkills.filter((required) => {
      const skill = skills.find((item) => item.name?.toLowerCase() === required.name.toLowerCase());
      return !skill || (levels[skill.level] || 0) < (levels[required.level] || 0);
    }),
    interests,
  })));
}

export const useUserDataStore = create((set, get) => ({
  ...emptySlices(),
  dataUserId: null,
  bootstrapping: false,
  bootstrapped: false,
  activeRoadmapProgress: 0,

  fetchAll: async (userId) => {
    if (!userId) return;
    const requestUserId = userId;
    set({ ...emptySlices(), dataUserId: userId, bootstrapping: true, bootstrapped: false });

    const fetchSlice = async (key, fetcher) => {
      set({ [`${key}Loading`]: true, [`${key}Error`]: null });
      try {
        const data = await fetcher();
        if (get().dataUserId === requestUserId) {
          set({ [key]: data, [`${key}Loading`]: false });
        }
        return data;
      } catch (error) {
        console.error(`[UserDataStore] Failed to fetch "${key}":`, error);
        if (get().dataUserId === requestUserId) {
          set({ [`${key}Error`]: error?.message || String(error), [`${key}Loading`]: false });
        }
        return null;
      }
    };

    const entries = Object.entries(SLICE_FETCHERS);
    const values = await Promise.all(entries.map(([key, fetcher]) => fetchSlice(key, () => fetcher(userId))));
    if (get().dataUserId !== requestUserId) return;
    const base = Object.fromEntries(entries.map(([key], index) => [key, values[index]]));

    const profile = base.profile;
    let careerRecommendations = [];
    let courseRecommendations = [];
    let opportunityRecommendations = [];
    if (profile) {
      careerRecommendations = await fetchSlice('careerRecommendations', () => buildCareers(profile)) || [];
      [courseRecommendations, opportunityRecommendations] = await Promise.all([
        fetchSlice('courseRecommendations', () => getCourseRecommendations(profile, careerRecommendations)),
        fetchSlice('opportunityRecommendations', () => getOpportunityRecommendations(profile)),
      ]);
    } else {
      set({ careerRecommendationsLoading: false, careerRecommendationsError: null, careerRecommendations: [] });
      set({ courseRecommendationsLoading: false, courseRecommendationsError: null, courseRecommendations: [] });
      set({ opportunityRecommendationsLoading: false, opportunityRecommendationsError: null, opportunityRecommendations: [] });
    }

    const activeSelection = (base.userRoadmaps || []).find((row) => row.is_active);
    const activeRoadmap = base.roadmapDetails?.[activeSelection?.roadmap_id] || null;
    const activeSubtopics = (activeRoadmap?.topics || []).flatMap((topic) => topic.subtopics || []);
    const overallProgress = activeSubtopics.length
      ? Math.round((activeSubtopics.filter((subtopic) => subtopic.status === 'completed').length / activeSubtopics.length) * 100)
      : 0;
    set({ activeRoadmap, overallProgress, activeRoadmapProgress: overallProgress });
    const [dashboardData] = await Promise.all([
      fetchSlice('dashboardData', () => getDashboardData(userId, {
        profile,
        completedAssessmentIds: base.completedAssessmentIds,
        assessmentScores: base.assessmentScores,
        activeRoadmap,
        overallProgress,
        userSubtopicProgress: base.userSubtopicProgress,
        resumeHistory: base.resumeHistory,
      })),
    ]);

    if (get().dataUserId !== requestUserId) return;
    set({
      careerRecommendations,
      courseRecommendations,
      opportunityRecommendations,
      dashboardData,
      overallProgress,
      activeRoadmapProgress: overallProgress,
      bootstrapping: false,
      bootstrapped: true,
    });
  },

  retrySlice: async (key, userId) => {
    if (SLICE_FETCHERS[key]) {
      const fetcher = SLICE_FETCHERS[key];
      set({ [`${key}Loading`]: true, [`${key}Error`]: null });
      try {
        const data = await fetcher(userId);
        if (get().dataUserId === userId) {
          const update = { [key]: data, [`${key}Loading`]: false };
          if (key === 'roadmapDetails') {
            const active = (get().userRoadmaps || []).find((row) => row.is_active);
            const detail = active ? data?.[active.roadmap_id] || null : null;
            const subs = (detail?.topics || []).flatMap((topic) => topic.subtopics || []);
            const progress = subs.length ? Math.round((subs.filter((item) => item.status === 'completed').length / subs.length) * 100) : 0;
            update.activeRoadmap = detail;
            update.overallProgress = progress;
            update.activeRoadmapProgress = progress;
          }
          set(update);
          if (key === 'profile') {
            const careers = await buildCareers(data);
            const [courses, opportunities] = await Promise.all([
              getCourseRecommendations(data, careers),
              getOpportunityRecommendations(data),
            ]);
            const snapshot = { ...get(), profile: data, careerRecommendations: careers, courseRecommendations: courses, opportunityRecommendations: opportunities };
            set({
              careerRecommendations: careers,
              courseRecommendations: courses,
              opportunityRecommendations: opportunities,
              dashboardData: getDashboardData(userId, snapshot),
            });
          }
          if (key === 'assessmentScores' || key === 'completedAssessmentIds' || key === 'activeRoadmap') {
            set({ dashboardData: getDashboardData(userId, get()) });
          }
        }
      } catch (error) {
        console.error(`[UserDataStore] Retry "${key}" failed:`, error);
        set({ [`${key}Error`]: error?.message || String(error), [`${key}Loading`]: false });
      }
      return;
    }
    if (key === 'careerRecommendations') return get().fetchDerivedSlice(key, () => buildCareers(get().profile));
    if (key === 'courseRecommendations') return get().fetchDerivedSlice(key, () => get().profile ? getCourseRecommendations(get().profile, get().careerRecommendations || []) : Promise.reject(new Error('Profile data is unavailable. Retry the profile load first.')));
    if (key === 'opportunityRecommendations') return get().fetchDerivedSlice(key, () => get().profile ? getOpportunityRecommendations(get().profile) : Promise.reject(new Error('Profile data is unavailable. Retry the profile load first.')));
    if (key === 'dashboardData') return get().fetchDerivedSlice(key, () => getDashboardData(userId, get()));
  },

  fetchDerivedSlice: async (key, fetcher) => {
    set({ [`${key}Loading`]: true, [`${key}Error`]: null });
    try {
      const value = await fetcher();
      set({ [key]: value, [`${key}Loading`]: false });
    } catch (error) {
      console.error(`[UserDataStore] Retry "${key}" failed:`, error);
      set({ [`${key}Error`]: error?.message || String(error), [`${key}Loading`]: false });
    }
  },

  updateProfileOpt: async (userId, updates) => {
    const previous = get().profile;
    set({ profile: { ...previous, ...updates, personal: { ...previous?.personal, ...updates.personal } } });
    try {
      const result = await updateProfile(updates, userId);
      const profile = result?.profile ?? result;
      set({ profile });
      const careers = await buildCareers(profile);
      const [courses, opportunities] = await Promise.all([
        getCourseRecommendations(profile, careers),
        getOpportunityRecommendations(profile),
      ]);
      const snapshot = { ...get(), profile, careerRecommendations: careers, courseRecommendations: courses, opportunityRecommendations: opportunities };
      set({
        careerRecommendations: careers,
        courseRecommendations: courses,
        opportunityRecommendations: opportunities,
        dashboardData: getDashboardData(userId, snapshot),
      });
      return profile;
    } catch (error) {
      set({ profile: previous });
      throw error;
    }
  },

  updateSettings: (userId, updates) => {
    const previous = get().settings || {};
    const settings = { ...previous, ...updates };
    set({ settings });
    try {
      localStorage.setItem(`elevateu_settings_${userId}`, JSON.stringify(settings));
    } catch (error) {
      console.warn('[UserDataStore] Could not save user settings:', error);
    }
    return settings;
  },

  addRoadmapSelection: async (userId, roadmapId) => {
    const previousIds = get().selectedRoadmapIds || new Set();
    const previousRows = get().userRoadmaps || [];
    const roadmap = (get().roadmaps || []).find((item) => item.id === roadmapId);
    if (previousIds.has(roadmapId)) return;
    set({
      selectedRoadmapIds: new Set([...previousIds, roadmapId]),
      userRoadmaps: [...previousRows, {
        id: roadmapId,
        roadmap_id: roadmapId,
        is_active: previousRows.length === 0,
        roadmaps: { title: roadmap?.title || 'Roadmap', category: roadmap?.category || 'Engineering' },
      }],
    });
    try {
      await persistRoadmapSelection(userId, roadmapId, previousRows.length === 0);
      const rows = await fetchUserRoadmaps(userId);
      set({ userRoadmaps: rows });
      try {
        const details = await fetchUserRoadmapDetails(userId, rows);
        const activeSelection = rows.find((row) => row.is_active);
        const activeRoadmap = activeSelection ? details[activeSelection.roadmap_id] || null : get().activeRoadmap;
        const subtopics = (activeRoadmap?.topics || []).flatMap((topic) => topic.subtopics || []);
        const progress = subtopics.length
          ? Math.round((subtopics.filter((subtopic) => subtopic.status === 'completed').length / subtopics.length) * 100)
          : 0;
        const snapshot = { ...get(), roadmapDetails: details, activeRoadmap, overallProgress: progress };
        set({ roadmapDetails: details, roadmapDetailsError: null, activeRoadmap, overallProgress: progress, activeRoadmapProgress: progress, dashboardData: getDashboardData(userId, snapshot) });
      } catch (error) {
        console.error('[UserDataStore] Failed to refresh roadmap details after selection:', error);
        set({ roadmapDetailsError: error?.message || String(error) });
      }
    } catch (error) {
      set({ selectedRoadmapIds: previousIds, userRoadmaps: previousRows });
      throw error;
    }
  },

  activateRoadmap: async (userId, selectionId) => {
    const previous = get().userRoadmaps || [];
    set({ userRoadmaps: previous.map((row) => ({ ...row, is_active: row.id === selectionId })) });
    try {
      await persistActiveRoadmap(userId, selectionId);
      const selected = (get().userRoadmaps || []).find((row) => row.id === selectionId);
      const cachedDetails = get().roadmapDetails || {};
      const detail = selected
        ? cachedDetails[selected.roadmap_id] || await fetchActiveRoadmapDetail(userId)
        : null;
      const details = detail && !cachedDetails[selected.roadmap_id]
        ? { ...cachedDetails, [selected.roadmap_id]: detail }
        : cachedDetails;
      const subtopics = (detail?.topics || []).flatMap((topic) => topic.subtopics || []);
      const progress = subtopics.length
        ? Math.round((subtopics.filter((subtopic) => subtopic.status === 'completed').length / subtopics.length) * 100)
        : 0;
      const snapshot = { ...get(), activeRoadmap: detail, roadmapDetails: details, overallProgress: progress };
      set({ activeRoadmap: detail, roadmapDetails: details, overallProgress: progress, activeRoadmapProgress: progress, dashboardData: getDashboardData(userId, snapshot) });
    } catch (error) {
      set({ userRoadmaps: previous });
      throw error;
    }
  },

  toggleSubtopic: async (userId, subtopicId, currentStatus) => {
    const previousRoadmap = get().activeRoadmap;
    const previousDetails = get().roadmapDetails || {};
    const previousProgress = get().userSubtopicProgress || {};
    const nextStatus = currentStatus === 'completed' ? 'not_started' : 'completed';
    const activeRoadmap = previousRoadmap && {
      ...previousRoadmap,
      topics: (previousRoadmap.topics || []).map((topic) => ({
        ...topic,
        subtopics: (topic.subtopics || []).map((subtopic) => subtopic.id === subtopicId
          ? { ...subtopic, status: nextStatus }
          : subtopic),
      })),
    };
    set({
      activeRoadmap,
      userSubtopicProgress: { ...previousProgress, [subtopicId]: nextStatus },
      roadmapDetails: activeRoadmap?.roadmap?.id
        ? { ...previousDetails, [activeRoadmap.roadmap.id]: activeRoadmap }
        : previousDetails,
    });
    try {
      await toggleSubtopicProgress(userId, subtopicId, currentStatus);
      const subtopics = (get().activeRoadmap?.topics || []).flatMap((topic) => topic.subtopics || []);
      const progress = subtopics.length
        ? Math.round((subtopics.filter((subtopic) => subtopic.status === 'completed').length / subtopics.length) * 100)
        : 0;
      const snapshot = { ...get(), overallProgress: progress };
      set({ overallProgress: progress, activeRoadmapProgress: progress, dashboardData: getDashboardData(userId, snapshot) });
    } catch (error) {
      set({ activeRoadmap: previousRoadmap, userSubtopicProgress: previousProgress, roadmapDetails: previousDetails });
      throw error;
    }
  },

  addResumeAnalysis: (analysis) => set((state) => ({
    resumeHistoryLoading: false,
    resumeHistoryError: null,
    resumeHistory: [
      { id: analysis.id, fileName: analysis.fileName, analyzedAt: analysis.analyzedAt, atsScore: analysis.atsScore },
      ...(state.resumeHistory || []).filter((item) => item.id !== analysis.id),
    ],
  })),
  removeResumeAnalysis: (analysisId) => set((state) => ({
    resumeHistory: (state.resumeHistory || []).filter((item) => item.id !== analysisId),
  })),
  markAssessmentCompleted: (assessmentId, score) => {
    const completed = get().completedAssessmentIds || new Set();
    const scores = get().assessmentScores || {};
    const completedAssessmentIds = new Set([...completed, assessmentId]);
    const assessmentScores = { ...scores, [assessmentId]: score };
    set({
      completedAssessmentIds,
      assessmentScores,
      assessments: (get().assessments || []).map((item) => item.id === assessmentId ? { ...item, completed: true } : item),
      dashboardData: getDashboardData(get().dataUserId, { ...get(), completedAssessmentIds, assessmentScores }),
    });
  },

  clear: () => set({
    ...emptySlices(),
    dataUserId: null,
    bootstrapping: false,
    bootstrapped: false,
    activeRoadmapProgress: 0,
  }),
}));
