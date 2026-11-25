import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Home from '@/pages/Home';
import InscricaoApresentador from '@/pages/InscricaoApresentador';
import InscricaoEspectador from '@/pages/InscricaoEspectador';
import MinhaInscricao from '@/pages/MinhaInscricao';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ProfessorDashboard from '@/pages/professor/ProfessorDashboard';
import AreaProfessorLogin from '@/pages/professor/AreaProfessorLogin';
import RoleGuard from '@/components/RoleGuard';

queryClientInstance.setDefaultOptions({
  queries: {
    refetchOnWindowFocus: false,
  },
});

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/inscricao/apresentador" element={<InscricaoApresentador />} />
      <Route path="/inscricao/espectador" element={<InscricaoEspectador />} />
      <Route path="/minha-inscricao" element={<MinhaInscricao />} />
      <Route path="/area-professor" element={<AreaProfessorLogin />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin" element={<RoleGuard allowedRoles={['admin']}><AdminDashboard /></RoleGuard>} />
      <Route path="/professor" element={<RoleGuard allowedRoles={['professor']}><ProfessorDashboard /></RoleGuard>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App