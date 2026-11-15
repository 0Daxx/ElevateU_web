import { create } from 'zustand';
import { saveUserSession, loadUserSession, clearUserSession } from '../utils/authStorage';
import { logoutSupabase } from '../services/authService';
import { memoryManager } from '../services/ai/memoryManager';

/**
 * Module-level synchronous store initialization:
 * Runs once when the module is imported, restoring session state
 * BEFORE the first React render to prevent login/logout state flash.
 */
const initialUser = loadUserSession();

export const useAuthStore = create((set) => ({
  user: initialUser || null,
  isAuthenticated: !!initialUser,
  sessionReady: false,

  /**
   * Login action: parses user details (including Supabase OAuth metadata),
   * computes user initials, updates state, and persists to authStorage.
   * @param {Object} userData - User object from auth service or Supabase
   */
  login: (userData) => {
    const name =
      userData?.name ||
      userData?.user_metadata?.full_name ||
      userData?.user_metadata?.name ||
      (userData?.email ? userData.email.split('@')[0] : 'User');

    const avatar =
      userData?.avatar ||
      userData?.user_metadata?.avatar_url ||
      userData?.user_metadata?.picture ||
      '';

    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

    const enrichedUser = {
      id: userData?.id,
      name,
      email: userData?.email || '',
      avatar,
      initials,
    };

    saveUserSession(enrichedUser);
    set({ user: enrichedUser, isAuthenticated: true });
  },

  /** Reconcile persisted auth state with the session Supabase reports. */
  syncSupabaseSession: (session) => {
    if (session?.user) {
      useAuthStore.getState().login(session.user);
      set({ sessionReady: true });
      return;
    }
    clearUserSession();
    memoryManager.clearAll();
    import('./userDataStore').then(({ useUserDataStore }) => useUserDataStore.getState().clear());
    set({ user: null, isAuthenticated: false, sessionReady: true });
  },

  /**
   * Logout action: clears state, removes session from authStorage,
   * terminates Supabase auth session, and wipes all user data from
   * the data store so no stale data leaks to the next user.
   */
  logout: () => {
    // Import lazily to avoid circular dep at module evaluation time
    import('./userDataStore').then(({ useUserDataStore }) => {
      useUserDataStore.getState().clear();
    });
    memoryManager.clearAll();
    logoutSupabase();
    clearUserSession();
    set({ user: null, isAuthenticated: false, sessionReady: true });
  },

  /**
   * Update active user details (e.g. name, email) and sync to storage.
   * @param {Object} updatedFields - Fields to update on the user object
   */
  updateUser: (updatedFields) => {
    set((state) => {
      if (!state.user) return {};
      const updatedUser = {
        ...state.user,
        ...updatedFields,
      };

      if (updatedFields.name) {
        const initials = updatedFields.name
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'U';
        updatedUser.initials = initials;
      }

      saveUserSession(updatedUser);
      return { user: updatedUser };
    });
  },
}));
