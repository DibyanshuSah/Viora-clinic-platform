import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('viora_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('viora_auth_token') || null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('viora_auth_token');
      if (storedToken) {
        try {
          api.setToken(storedToken);
          const res = await api.getMe();
          if (res.success && res.data) {
            setUser(res.data);
            localStorage.setItem('viora_auth_user', JSON.stringify(res.data));
          }
        } catch (err) {
          console.warn('Session verification failed, logging out:', err);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await api.login(username, password);
      if (res.success && res.data) {
        setUser(res.data.user);
        setToken(res.data.token);
        showToast(`Welcome to VIORA, ${res.data.user.name}`, 'success');
        return res.data.user;
      }
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
      throw err;
    }
  };

  const switchDemoRole = async (targetRole) => {
    try {
      const res = await api.switchDemoRole(targetRole);
      if (res.success && res.data) {
        setUser(res.data.user);
        setToken(res.data.token);
        showToast(`Switched workspace to ${targetRole}`, 'info');
        return res.data.user;
      }
    } catch (err) {
      showToast(err.message || 'Demo role switch failed', 'error');
      throw err;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
    showToast('Logged out of VIORA Clinic System', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        role: user ? user.role : null,
        loading,
        login,
        logout,
        switchDemoRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
