/**
 * profileService.js — Mock Profile API layer.
 *
 * Mirrors the shape of a real REST API:
 *   GET  /api/profile       → getProfile()
 *   PUT  /api/profile       → updateProfile(data)
 *
 * The in-memory `profileStore` persists updates within the browser session
 * (survives HMR). To switch to a real backend, replace only the internals
 * of each exported function — all callers remain unchanged.
 */

// dummyProfile is no longer used as a runtime fallback; an empty profile is returned instead.
// It is retained as the canonical data shape reference for TypeScript-style documentation.
import dummyProfile from '../data/dummyProfile.js'; // eslint-disable-line no-unused-vars
import { useAuthStore } from '../store/authStore';
import { supabase } from '../config/supabaseClient';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id) => typeof id === 'string' && UUID_REGEX.test(id);

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Simulate network latency */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Deep-clone via JSON round-trip (sufficient for plain-data objects) */
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));


// ─── In-memory / LocalStorage store ───────────────────────────────────────────

/**
 * Load initial profile store from localStorage, falling back to dummyProfile.
 */
const loadProfileStore = () => {
  try {
    const user = useAuthStore.getState().user;
    const key = user ? `elevateu_profile_${user.id}` : 'elevateu_profile';
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed) return parsed;
    }

    // If there is a logged-in user but no profile is stored, create a user-specific blank/initial profile
    if (user) {
      const initials = user.initials || '';
      const newProfile = {
        personal: {
          name: user.name || '',
          email: user.email || '',
          phone: '',
          location: '',
          avatarInitials: initials,
        },
        education: [],
        skills: [],
        interests: [],
        careerGoals: [],
        experience: [],
        isCompleted: false, // flag for triggering onboarding modal
      };
      localStorage.setItem(key, JSON.stringify(newProfile));
      return newProfile;
    }
  } catch (err) {
    console.warn('Failed to load profile store from localStorage:', err);
  }
  // For signed-out/guest state, return an empty profile rather than Aditi Sharma's dummy data.
  // Route protection means this branch should rarely be hit, but it's safer to return nothing.
  return {
    personal: { name: '', email: '', phone: '', location: '', avatarInitials: '' },
    education: [],
    skills: [],
    interests: [],
    careerGoals: [],
    experience: [],
    isCompleted: false,
  };
};

let profileStore = loadProfileStore();


// ─── Exported API functions ───────────────────────────────────────────────────

/**
 * Fetch the current user profile.
 * Returns a deep copy so callers cannot accidentally mutate the store.
 *
 * @returns {Promise<Object>} Profile data shaped like the profile schema
 */
export async function getProfile(userId) {
  await delay(500);

  // Simulate a 5% random failure rate for QA testing Error States
  if (Math.random() < 0.05) {
    throw new Error('Failed to fetch profile data. Network error.');
  }

  // Refresh profileStore from the current user's local cache.
  profileStore = loadProfileStore();

  const currentUserId = userId || useAuthStore.getState().user?.id;
  if (isUuid(currentUserId)) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, college, degree, year, bio, avatar_url, skills, interests, social_links')
      .eq('id', currentUserId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      profileStore = {
        ...profileStore,
        personal: {
          ...profileStore.personal,
          name: data.full_name || profileStore.personal?.name || '',
          email: data.email || profileStore.personal?.email || '',
          phone: data.phone || profileStore.personal?.phone || '',
          location: data.college || profileStore.personal?.location || '',
          avatarInitials: profileStore.personal?.avatarInitials || '',
        },
        education: data.degree || data.year || data.college
          ? [{ institution: data.college || '', degree: data.degree || '', year: data.year || '' }]
          : profileStore.education || [],
        skills: (data.skills || []).map((name) => ({
          name,
          level: profileStore.skills?.find((skill) => skill.name === name)?.level || 'Beginner',
        })),
        interests: data.interests || [],
        bio: data.bio || '',
        avatarUrl: data.avatar_url || '',
        socialLinks: data.social_links || {},
      };
    }
  }

  return deepClone(profileStore);
}


/**
 * Persist updated profile data.
 * Performs a shallow merge at the top level (personal, education, skills, …).
 * Each top-level section from updatedData fully replaces the matching section
 * in the store (arrays are replaced wholesale, not item-patched).
 *
 * @param {Object} updatedData - Sections to overwrite
 * @returns {Promise<{ success: boolean, profile: Object }>}
 */
export async function updateProfile(updatedData, userId) {
  await delay(500);

  // Load the current store first
  profileStore = loadProfileStore();

  // Merge: keep existing sections not present in updatedData
  profileStore = {
    ...profileStore,
    ...updatedData,
    personal: {
      ...profileStore.personal,
      ...(updatedData.personal ?? {}),
    },
    isCompleted: true, // mark profile as completed on update/save
  };

  const currentUserId = userId || useAuthStore.getState().user?.id;
  if (isUuid(currentUserId)) {
    const firstEducation = profileStore.education?.[0] || {};
    const { error } = await supabase.from('profiles').upsert({
      id: currentUserId,
      full_name: profileStore.personal?.name || '',
      email: profileStore.personal?.email || '',
      phone: profileStore.personal?.phone || '',
      college: firstEducation.institution || firstEducation.college || profileStore.personal?.location || '',
      degree: firstEducation.degree || '',
      year: firstEducation.year || '',
      bio: profileStore.bio || '',
      avatar_url: profileStore.avatarUrl || null,
      skills: (profileStore.skills || []).map((skill) => typeof skill === 'string' ? skill : skill.name),
      interests: (profileStore.interests || []).map((interest) => typeof interest === 'string' ? interest : interest.name),
      social_links: profileStore.socialLinks || {},
    }, { onConflict: 'id' });
    if (error) throw error;
  }

  try {
    const user = useAuthStore.getState().user;
    const key = user ? `elevateu_profile_${user.id}` : 'elevateu_profile';
    localStorage.setItem(key, JSON.stringify(profileStore));

    // Synchronize changes to useAuthStore
    if (updatedData.personal) {
      const { name, email } = updatedData.personal;
      const updateUser = useAuthStore.getState().updateUser;
      if (updateUser) {
        updateUser({
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
        });
      }
    }
  } catch (err) {
    console.warn('Failed to save profile store to localStorage:', err);
  }

  return { success: true, profile: deepClone(profileStore) };
}
