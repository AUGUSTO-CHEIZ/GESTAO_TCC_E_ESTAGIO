import { useState } from 'react';
import { GraduationCap } from 'lucide-react';

export default function PublicFooter() {
  const [logoErro, setLogoErro] = useState(false);

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
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

          <div className="flex md:justify-end items-center">
            {!logoErro && (
              <a
                href="https://github.com/augusto-cheiz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img
                  src="/minha-logo.png"
                  alt="Cheiz.dev"
                  onError={() => setLogoErro(true)}
                  className="h-24 w-auto object-contain opacity-95 hover:opacity-100 transition cursor-pointer"
                />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}