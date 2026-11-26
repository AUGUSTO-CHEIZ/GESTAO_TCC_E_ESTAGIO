import React, { createContext, useState, useContext, useEffect } from 'react';
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

  useEffect(() => {
    // 1. Carrega sessão inicial
    checkAppState();

    // 2. Ouve mudanças de estado de autenticação no Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser) => {
    try {
      setIsLoadingAuth(true);

      // Busca perfil diretamente em public.perfis
      const { data: profile, error: profileErr } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('Aviso ao consultar public.perfis:', profileErr.message);
      }

      // Normaliza papéis: 'admin' ou 'organizadora' -> 'admin'
      let role = profile?.role || authUser.user_metadata?.role || 'user';
      if (role === 'organizadora') {
        role = 'admin';
      }

      const mergedUser = {
        ...authUser,
        role,
        full_name: profile?.nome || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
      };

      setUser(mergedUser);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Erro ao processar perfil do usuário:', err);
      let fallbackRole = authUser.user_metadata?.role || 'user';
      if (fallbackRole === 'organizadora') fallbackRole = 'admin';

      setUser({
        ...authUser,
        role: fallbackRole,
        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
      });
      setIsAuthenticated(true);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Erro ao verificar sessão Supabase:', error);
      setUser(null);
      setIsAuthenticated(false);
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
      setUser(null);
      setIsAuthenticated(false);
      if (shouldRedirect) {
        window.location.href = '/login';
      }
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
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
