import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore, setUnauthorizedHandler } from './api.js';
import { setCurrency } from './format.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const apply = useCallback((u) => {
    if (u) setCurrency(u.currency);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    qc.clear();
    apply(null);
  }, [qc, apply]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api.get('/auth/me')
      .then((r) => apply(r.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout, apply]);

  const finish = useCallback(({ token, user: u }) => {
    qc.clear();
    tokenStore.set(token);
    apply(u);
    return u;
  }, [qc, apply]);

  const value = useMemo(() => ({
    user,
    loading,
    login: (email, password) => api.post('/auth/login', { email, password }).then(finish),
    register: (data) => api.post('/auth/register', data).then(finish),
    updateProfile: (data) => api.patch('/auth/me', data).then((r) => { apply(r.user); qc.invalidateQueries(); return r.user; }),
    logout,
  }), [user, loading, finish, logout, apply, qc]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
