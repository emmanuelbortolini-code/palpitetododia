import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  initializing: boolean;
  setSession: (session: Session | null) => void;
  setInitializing: (initializing: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initializing: true,
  setSession: (session) => set({ session }),
  setInitializing: (initializing) => set({ initializing }),
}));
