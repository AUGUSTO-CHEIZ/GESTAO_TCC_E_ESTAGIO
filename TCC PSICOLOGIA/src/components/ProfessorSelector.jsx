import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronDown, X } from 'lucide-react';

export default function ProfessorSelector({ value, onChange, excludeIds = [], placeholder = "Pesquisar professor..." }) {
  const [professores, setProfessores] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('professores')
          .select('*')
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (error) throw error;
        setProfessores(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProf = professores.find((p) => p.id === value);
  const filtered = professores.filter(
    (p) => !excludeIds.includes(p.id) && p.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      {selectedProf ? (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="text-slate-900">{selectedProf.nome}</span>
          <button
            type="button"
            onClick={() => { onChange(''); setSearch(''); }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
          />
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          {open && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
              {loading ? (
                <div className="px-3 py-2 text-sm text-slate-400">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-400">Nenhum professor encontrado</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onChange(p.id); setOpen(false); setSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 text-slate-700"
                  >
                    {p.nome}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
