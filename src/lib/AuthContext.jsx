import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({});
  const loadedUserIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        setIsLoadingAuth(true);
        setAuthError(null);
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!mounted) return;
        if (session?.user) {
          await loadUserProfile(session.user, { silent: false });
        } else {
          loadedUserIdRef.current = null;
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Erro ao verificar sessão Supabase:', error);
        if (!mounted) return;
        loadedUserIdRef.current = null;
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return;

      if (session?.user) {
        const isSameUser = loadedUserIdRef.current === session.user.id;
        if (event === 'TOKEN_REFRESHED' && isSameUser) return;
        await loadUserProfile(session.user, { silent: isSameUser });
      } else {
        loadedUserIdRef.current = null;
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser, { silent = false } = {}) => {
    try {
      if (!silent) {
        setIsLoadingAuth(true);
      }

      const { data: profile, error: profileErr } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('Aviso ao consultar public.perfis:', profileErr.message);
      }

      let role = profile?.role || authUser.user_metadata?.role || 'user';
      if (role === 'organizadora') {
        role = 'admin';
      }

      const mergedUser = {
        ...authUser,
        role,
        full_name:
          profile?.nome ||
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split('@')[0] ||
          'Usuário',
      };

      loadedUserIdRef.current = authUser.id;
      setUser(mergedUser);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Erro ao processar perfil do usuário:', err);
      let fallbackRole = authUser.user_metadata?.role || 'user';
      if (fallbackRole === 'organizadora') fallbackRole = 'admin';

      loadedUserIdRef.current = authUser.id;
      setUser({
        ...authUser,
        role: fallbackRole,
        full_name:
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split('@')[0] ||
          'Usuário',
      });
      setIsAuthenticated(true);
    } finally {
      if (!silent) {
        setIsLoadingAuth(false);
      }
      setAuthChecked(true);
    }
  };

  const checkAppState = async () => {
    try {
      const isInitial = !loadedUserIdRef.current;
      if (isInitial) setIsLoadingAuth(true);
      setAuthError(null);

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        await loadUserProfile(session.user, { silent: !isInitial });
      } else {
        loadedUserIdRef.current = null;
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Erro ao verificar sessão Supabase:', error);
      loadedUserIdRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    await checkAppState();
  };

  const logout = async (shouldRedirect = true) => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Erro ao sair:', e);
    } finally {
      loadedUserIdRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
      if (shouldRedirect && window.location.pathname !== '/login') {
        window.history.pushState({}, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  };

  const navigateToLogin = () => {
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};