import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setCacheScope } from '../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest('/auth/me');
      setUser(data.user);
      setCacheScope(data.user.id);
      return data.user;
    } catch {
      setUser(null);
      setCacheScope(null);
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  const signIn = async (credentials) => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    setUser(data.user);
    setCacheScope(data.user.id);
    return data.user;
  };
  const signUp = async (details) => {
    const data = await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(details) });
    setUser(data.user);
    setCacheScope(data.user.id);
    return data.user;
  };
  const signOut = async () => {
    try { await apiRequest('/auth/logout', { method: 'POST' }); }
    catch { /* Clear local session state even if the API cannot be reached. */ }
    finally { setUser(null); setCacheScope(null); }
  };

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshSession }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
