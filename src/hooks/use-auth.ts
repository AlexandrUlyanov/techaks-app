import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: number;
  phone: string | null;
  fullName: string | null;
  email: string;
  role: string;
  status: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    set => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: user => set({ user, isAuthenticated: !!user }),
      setToken: token => set({ token }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: "techaks-auth",
    }
  )
);
