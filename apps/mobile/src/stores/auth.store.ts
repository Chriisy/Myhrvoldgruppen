import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (user, token) => {
    await setItem('auth_token', token);
    await setItem('user', JSON.stringify(user));
    set({ user, token, isLoading: false, isAuthenticated: true });
  },

  logout: async () => {
    await removeItem('auth_token');
    await removeItem('user');
    set({ user: null, token: null, isLoading: false, isAuthenticated: false });
  },

  loadAuth: async () => {
    try {
      const token = await getItem('auth_token');
      const userStr = await getItem('user');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, token, isLoading: false, isAuthenticated: true });
      } else {
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },
}));
