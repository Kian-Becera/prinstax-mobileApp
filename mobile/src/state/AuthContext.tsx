import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, signOut, type User } from '../lib/auth';

interface AuthContextValue {
  user: User | null;
  authenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  authenticated: false,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, firebaseUser => {
    setUser(firebaseUser);
    setLoading(false);
  }), []);

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authenticated: !!user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
