import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <span className="font-bold text-sm sm:text-lg text-slate-900">
              Psicologia Unesc
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/area-professor"
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm text-slate-700 hover:text-indigo-600 hover:bg-slate-100 font-medium transition"
            >
              Orientador
            </Link>
            <Link
              to="/login"
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-indigo-600 text-white text-xs sm:text-sm font-medium hover:bg-indigo-700 transition"
            >
              Administrador
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}