import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  authenticateWithBiometrics,
  isBiometricEnabled,
  loginWithPassword,
  setBiometricEnabled,
} from '../lib/auth';

interface AuthContextValue {
  authed: boolean;
  loading: boolean;
  loginPassword: (u: string, p: string) => Promise<boolean>;
  loginBiometric: () => Promise<boolean>;
  logout: () => void;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  biometricEnabled: boolean;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBioFlag] = useState(false);

  useEffect(() => {
    (async () => {
      setBioFlag(await isBiometricEnabled());
      setLoading(false);
    })();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    authed,
    loading,
    biometricEnabled,
    loginPassword: async (u, p) => {
      const ok = await loginWithPassword(u, p);
      if (ok) setAuthed(true);
      return ok;
    },
    loginBiometric: async () => {
      const ok = await authenticateWithBiometrics('Sign in to Prinstax');
      if (ok) setAuthed(true);
      return ok;
    },
    logout: () => setAuthed(false),
    enableBiometric: async () => {
      const ok = await authenticateWithBiometrics('Enable biometric sign-in');
      if (ok) {
        await setBiometricEnabled(true);
        setBioFlag(true);
      }
    },
    disableBiometric: async () => {
      await setBiometricEnabled(false);
      setBioFlag(false);
    },
  }), [authed, loading, biometricEnabled]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
};
