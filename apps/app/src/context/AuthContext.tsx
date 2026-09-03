import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setSessionExpiredHandler } from '../utils/apiClient';

interface AuthProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  type: string;
  status: string;
  avatarUrl?: string;
  tenantId?: string;
  practiceName?: string;
  tenantSlug?: string;
  platformRole?: string;
}

interface AuthContextValue {
  profile: AuthProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthProfile>;
  loginAdmin: (email: string, password: string) => Promise<AuthProfile>;
  claimInvite: (data: {
    token: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<AuthProfile>;
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    practiceName: string;
    persona: 'therapist' | 'practice';
    alsoTherapist?: boolean;
  }) => Promise<RegisterResult>;
  logout: () => Promise<void>;
}

export interface RegisterResult {
  message: string;
  verification_required: boolean;
  email_sent: boolean;
  profile_id?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_KEY = 'unclutter_profile';
const PROFILE_VERSION = 2;

function readCachedProfile(): AuthProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.__v !== PROFILE_VERSION) return null;
    return parsed.profile as AuthProfile;
  } catch {
    return null;
  }
}

function cacheProfile(profile: AuthProfile | null): void {
  if (!profile) {
    localStorage.removeItem(PROFILE_KEY);
    return;
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ __v: PROFILE_VERSION, profile }));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<AuthProfile | null>(readCachedProfile);
  const [isLoading, setIsLoading] = useState(true);

  // The access token is an httpOnly cookie, so on a cold load we verify the
  // session by hitting /v1/auth/status (which also rotates nothing — the
  // refresh cookie silently restores the access cookie when needed).
  useEffect(() => {
    let active = true;
    api
      .get<AuthProfile>('/v1/auth/status')
      .then((p) => {
        if (!active) return;
        setProfile(p);
        cacheProfile(p);
      })
      .catch(() => {
        if (!active) return;
        setProfile(null);
        cacheProfile(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Global session-expired hook: called by apiClient when a refresh fails.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setProfile(null);
      cacheProfile(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ profile: AuthProfile }>('/v1/auth/login', { email, password });
    setProfile(res.profile);
    cacheProfile(res.profile);
    return res.profile;
  }, []);

  const loginAdmin = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ profile: AuthProfile }>('/v1/admin/auth/login', { email, password });
    setProfile(res.profile);
    cacheProfile(res.profile);
    return res.profile;
  }, []);

  // An invited colleague setting their password. The API creates the profile
  // inside the practice that invited them and signs them in, so this ends with
  // a session exactly like login — no separate verification step, because the
  // invitation reaching their inbox is what proved the address.
  const claimInvite = useCallback(
    async (data: { token: string; password: string; firstName?: string; lastName?: string }) => {
      const res = await api.post<{ profile: AuthProfile }>('/v1/auth/invite/claim', data);
      setProfile(res.profile);
      cacheProfile(res.profile);
      return res.profile;
    },
    [],
  );

  // Registers a brand-new practice + owner therapist. The X-Tenant-Slug header
  // is explicitly emptied so the API creates a fresh tenant instead of
  // resolving into the current practice context.
  const register = useCallback(
    async (data: { firstName: string; lastName: string; email: string; password: string; practiceName: string; persona: 'therapist' | 'practice'; alsoTherapist?: boolean }) => {
      const handle = data.practiceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'practice';
      // Registration creates an unverified profile. The user must verify their
      // email (6-digit code) before logging in — so no session is established here.
      const res = await api.post<RegisterResult>(
        '/v1/auth/register',
        {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
          practiceName: data.practiceName,
          username: handle,
          type: data.persona === 'practice' ? 'admin' : 'therapist',
          alsoTherapist: data.alsoTherapist,
        },
        { 'X-Tenant-Slug': '' },
      );
      return res;
    },
    [],
  );

  const logout = useCallback(async () => {
    setProfile(null);
    cacheProfile(null);
    // Clear the httpOnly cookies server-side.
    await api.post<{ success: boolean }>('/v1/auth/logout', {});
  }, []);

  return (
    <AuthContext.Provider
      value={{
        profile,
        isLoading,
        isAuthenticated: !!profile,
        login,
        loginAdmin,
        claimInvite,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
