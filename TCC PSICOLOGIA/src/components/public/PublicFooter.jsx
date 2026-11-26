import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold">Bancas TCC - Psicologia</span>
            </div>
            <p className="text-sm text-slate-400">Plataforma de gestão e acompanhamento de bancas de TCC do curso de Psicologia.</p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">Contato</h3>
            <p className="text-sm text-slate-400">psicologia@unesc.net</p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">Links</h3>
            <div className="space-y-1 text-sm">
              <Link to="/" className="block text-slate-400 hover:text-white">Início</Link>
              <Link to="/inscricao/apresentador" className="block text-slate-400 hover:text-white">Inscrição Apresentador</Link>
              <Link to="/inscricao/espectador" className="block text-slate-400 hover:text-white">Inscrição Espectador</Link>
              <Link to="/minha-inscricao" className="block text-slate-400 hover:text-white">Minha Inscrição</Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Bancas TCC - Psicologia. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
