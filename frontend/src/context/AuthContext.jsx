import { useState, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from './authContextObject';
import { sendNotificationEmail } from '../services/emailService';

const STORAGE_KEY = 'queue-user';

const parseUser = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => parseUser());

  const persistUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  };

  const login = async (email, password) => {
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
      persistUser(data);
      
      // Trigger login success email
      console.log(`Triggering login email for ${data.email}`);
      sendNotificationEmail({
        user_name: data.name,
        user_email: data.email,
        message: 'Login successful into Queue System'
      });

      return { success: true, user: data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to sign in right now.',
      };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await axios.post('/api/auth/register', payload);
      persistUser(data);

      // Trigger registration/login success email
      console.log(`Triggering registration email for ${data.email}`);
      sendNotificationEmail({
        user_name: data.name,
        user_email: data.email,
        message: 'Account created and Login successful into Queue System'
      });

      return { success: true, user: data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to create the account.',
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const authHeaders = useMemo(() => (user ? { Authorization: `Bearer ${user.token}` } : {}), [user]);

  const value = useMemo(() => ({
    user,
    login,
    register,
    logout,
    authHeaders,
  }), [user, authHeaders]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
