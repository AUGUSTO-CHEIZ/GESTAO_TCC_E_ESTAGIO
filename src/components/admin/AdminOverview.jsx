import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, Users, FileText, ClipboardList } from 'lucide-react';

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [bancasRes, professoresRes, inscricoesRes] = await Promise.all([
          supabase.from('bancas').select('*'),
          supabase.from('professores').select('*'),
          supabase.from('inscricoes').select('*'),
        ]);

        const bancas = bancasRes.data || [];
        const professores = professoresRes.data || [];
        const inscricoes = inscricoesRes.data || [];

        setStats({
          bancas: bancas.length,
          bancasAtivas: bancas.filter((b) => b.status === 'agendada').length,
          professores: professores.length,
          inscricoes: inscricoes.length,
          espectadores: inscricoes.filter((i) => i.tipo !== 'apresentador').length,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards = [
    { label: 'Total de Bancas', value: stats?.bancas, icon: FileText, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Bancas Agendadas', value: stats?.bancasAtivas, icon: LayoutDashboard, color: 'bg-blue-100 text-blue-600' },
    { label: 'Professores', value: stats?.professores, icon: Users, color: 'bg-violet-100 text-violet-600' },
    { label: 'Inscrições', value: stats?.inscricoes, icon: ClipboardList, color: 'bg-green-100 text-green-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Painel Geral</h1>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <card.icon className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{card.value ?? '-'}</p>
              <p className="text-sm text-slate-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
