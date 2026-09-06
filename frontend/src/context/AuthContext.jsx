
import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      // Only fetch user on cold load / page refresh when user object is missing
      if (!user) {
        setLoading(true);
        authService.getUser()
          .then(res => {
            setUser(res.data);
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setToken(null);
            setUser(null);
            setLoading(false);
            localStorage.removeItem('token');
          });
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token]);

const register = async (username, email, password) => {
  try {
    const res = await authService.register(username, email, password);
    if (res.data.user) {
      setUser(res.data.user);
    }
    setToken(res.data.token);
    localStorage.setItem('token', res.data.token);
    setLoading(false);
    return { success: true };
  } catch (err) {
    console.error('Register error:', err.response ? err.response.data : err.message);
    return { success: false, error: err.response ? err.response.data.msg : err.message };
  }
};

  const role = user?.role || user?.primaryRole || (user ? 'ADMIN' : null);
  const isOperator = role === 'DISTRIBUTION_OPERATOR';
  const isAdmin = ['ADMIN', 'OWNER'].includes(role);
  const isOwner = role === 'OWNER';

  const login = async (email, password) => {
    try {
      const res = await authService.login(email, password);
      if (res.data.user) {
        setUser(res.data.user);
      }
      setToken(res.data.token);
      localStorage.setItem('token', res.data.token);
      setLoading(false);
      return { 
        success: true, 
        user: res.data.user, 
        primaryRole: res.data.primaryRole || res.data.user?.role || 'ADMIN' 
      };
    } catch (err) {
      console.error('Login error:', err.response ? err.response.data : err.message);
      return { success: false, error: err.response ? err.response.data.msg : err.message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const updateProfile = async (data) => {
    try {
      const res = await authService.updateProfile(data);
      setUser(prev => ({ ...prev, ...res.data }));
      return { success: true };
    } catch (err) {
      console.error('Update profile error:', err);
      return { success: false, error: err.response ? err.response.data.msg : err.message };
    }
  };

  const changePassword = async (data) => {
    try {
      await authService.changePassword(data);
      return { success: true };
    } catch (err) {
      console.error('Change password error:', err);
      return { success: false, error: err.response ? err.response.data.msg : err.message };
    }
  };

  const deleteAccount = async () => {
    try {
      await authService.deleteAccount();
      logout();
      return { success: true };
    } catch (err) {
      console.error('Delete account error:', err);
      return { success: false, error: err.response ? err.response.data.msg : err.message };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading,
      role, 
      isOperator, 
      isAdmin, 
      isOwner, 
      register, 
      login, 
      logout, 
      updateProfile, 
      changePassword, 
      deleteAccount 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
