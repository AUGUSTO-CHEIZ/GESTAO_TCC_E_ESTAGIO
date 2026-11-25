import { Link } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 hidden sm:block">Psicologia Unesc</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-slate-600 hover:text-indigo-600 font-medium">Início</Link>
            <Link to="/area-professor" className="text-slate-600 hover:text-indigo-600 font-medium">Área do Professor</Link>
            <Link to="/login" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Administrador</Link>
          </nav>

          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 space-y-1">
            <Link to="/" className="block px-3 py-2 text-slate-600 hover:text-indigo-600 font-medium" onClick={() => setMenuOpen(false)}>Início</Link>
            <Link to="/area-professor" className="block px-3 py-2 text-slate-600 hover:text-indigo-600 font-medium" onClick={() => setMenuOpen(false)}>Área do Professor</Link>
            <Link to="/login" className="block px-3 py-2 text-indigo-600 font-medium" onClick={() => setMenuOpen(false)}>Administrador</Link>
          </div>
        )}
      </div>
    </header>
  );
}