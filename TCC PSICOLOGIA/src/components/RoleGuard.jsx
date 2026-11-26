import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';

export default function RoleGuard({ allowedRoles, children }) {
  const { user, isAuthenticated, authChecked, isLoadingAuth, authError } = useAuth();

  if (isLoadingAuth || (!authChecked && !authError)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Normaliza o papel do usuário: aceita 'admin' e 'organizadora'
  const userRole = (user.role === 'organizadora') ? 'admin' : user.role;

  if (!allowedRoles.includes(userRole)) {
    if (userRole === 'admin') return <Navigate to="/admin" replace />;
    if (userRole === 'professor') return <Navigate to="/professor" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}
