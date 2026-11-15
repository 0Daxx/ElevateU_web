import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { onAuthStateChange } from './services/authService';
import { useAuthStore } from './store/authStore';

/**
 * App root component.
 * Dynamic basename matches Vite's base URL environment parameter for seamless multi-platform deployment.
 * Listens for Supabase OAuth callback redirects & session events to synchronize global auth state.
 */
export default function App() {
  const syncSupabaseSession = useAuthStore((state) => state.syncSupabaseSession);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        syncSupabaseSession(session);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [syncSupabaseSession]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  );
}
