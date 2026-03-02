'use client';
import { api } from './api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const authLib = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    const res = await api.post<any>('/auth/login', { email, password });
    // API returns {user, tokens:{accessToken,refreshToken}} OR flat {accessToken,refreshToken,user}
    if (res.tokens) return { ...res.tokens, user: res.user };
    return res;
  },

  register: async (data: { email: string; password: string; firstName: string; lastName: string }): Promise<AuthTokens> => {
    const res = await api.post<any>('/auth/register', data);
    if (res.tokens) return { ...res.tokens, user: res.user };
    return res;
  },

  logout: () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    return api.post('/auth/logout', { refreshToken });
  },

  refresh: () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    return api.post<{ accessToken: string }>('/auth/refresh', { refreshToken });
  },

  me: () => api.get<User>('/auth/me'),

  saveTokens: (tokens: AuthTokens) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', tokens.accessToken);
      localStorage.setItem('refresh_token', tokens.refreshToken);
    }
  },

  getAccessToken: () =>
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,

  isLoggedIn: () => !!authLib.getAccessToken(),
};
