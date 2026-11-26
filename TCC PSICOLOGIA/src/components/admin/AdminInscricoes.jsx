import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AdminInscricoes() {
  const [inscricoes, setInscricoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const { toast } = useToast();

  async function load() {
    try {
      const { data, error } = await supabase.from('inscricoes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setInscricoes(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Remover inscrição?')) return;
    try {
      const { error } = await supabase.from('inscricoes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Inscrição removida' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  const tipos = ['todos', 'apresentador', 'academico', 'familiar'];
  const tipoLabel = { apresentador: 'Apresentador', academico: 'Acadêmico', familiar: 'Familiar' };

  const filtered = inscricoes.filter((i) => {
    const matchTipo = filtroTipo === 'todos' || i.tipo === filtroTipo;
    const matchSearch = !search || i.nome?.toLowerCase().includes(search.toLowerCase()) || i.email?.toLowerCase().includes(search.toLowerCase());
    return matchTipo && matchSearch;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inscrições</h1>
        <span className="text-sm text-slate-500">{filtered.length} resultado(s)</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          {tipos.map((t) => (
            <button key={t} onClick={() => setFiltroTipo(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filtroTipo === t ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t === 'todos' ? 'Todos' : tipoLabel[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">E-mail</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Tipo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{i.nome}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{i.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${i.tipo === 'apresentador' ? 'bg-indigo-100 text-indigo-700' : i.tipo === 'academico' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                      {tipoLabel[i.tipo] || i.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(i.id)} className="p-1.5 text-slate-400 hover:text-red-600 ml-auto block">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
