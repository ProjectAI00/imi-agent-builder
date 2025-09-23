"use client";

import { useState, useEffect } from 'react';

interface PinterestUser {
  id: string;
  name: string;
  username: string;
  access_token: string;
  token: string;
}

export function usePinterestAuth() {
  const [user, setUser] = useState<PinterestUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for Pinterest auth cookie
    const checkAuth = () => {
      try {
        const authCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('pinterest_auth='));
        
        if (authCookie) {
          const userData = JSON.parse(decodeURIComponent(authCookie.split('=')[1]));
          setUser(userData);
        }
      } catch (error) {
        console.error('Pinterest auth check error:', error);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signOut = () => {
    document.cookie = 'pinterest_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setUser(null);
    window.location.href = '/chat';
  };

  const signIn = () => {
    window.location.href = '/api/auth/pinterest';
  };

  return {
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
}