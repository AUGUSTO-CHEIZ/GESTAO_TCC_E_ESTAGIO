import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white text-base">Psicologia Unesc</span>
            </div>
            <p className="text-sm text-slate-400">
              Plataforma de gestão e acompanhamento de bancas de TCC e Estágio do curso de Psicologia da Unesc.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Contato</h3>
            <div className="space-y-1.5 text-sm text-slate-400">
              <p>
                <a
                  href="https://wa.me/554834312650"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition underline-offset-4 hover:underline"
                >
                  48 3431-2650
                </a>
              </p>
              <p>
                <a
                  href="mailto:psicologia@unesc.net"
                  className="hover:text-white transition"
                >
                  psicologia@unesc.net
                </a>
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Links</h3>
            <ul className="space-y-1.5 text-sm text-slate-400">
              <li><Link to="/" className="hover:text-white transition">Início</Link></li>
              <li><Link to="/inscricao/apresentador" className="hover:text-white transition">Inscrição Apresentador</Link></li>
              <li><Link to="/inscricao/espectador" className="hover:text-white transition">Inscrição Espectador</Link></li>
              <li><Link to="/minha-inscricao" className="hover:text-white transition">Minha Inscrição</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/80 mt-8 pt-6 text-center text-xs text-slate-500">
          © 2026 Bancas TCC - Psicologia. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}