import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyForm = { nome: '', email: '', titulacao: '', ativo: true };

export default function AdminProfessores() {
  const [professores, setProfessores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const { toast } = useToast();

  async function load() {
    try {
      const { data, error } = await supabase.from('professores').select('*').order('nome', { ascending: true });
      if (error) throw error;
      setProfessores(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSave(e) {
    e.preventDefault();
    try {
      if (editId) {
        const { error } = await supabase.from('professores').update(form).eq('id', editId);
        if (error) throw error;
        toast({ title: 'Professor atualizado com sucesso' });
      } else {
        const { error } = await supabase.from('professores').insert(form);
        if (error) throw error;
        toast({ title: 'Professor criado com sucesso' });
      }
      setForm(emptyForm); setEditId(null); setShowForm(false); load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  async function handleToggle(prof) {
    try {
      const { error } = await supabase.from('professores').update({ ativo: !prof.ativo }).eq('id', prof.id);
      if (error) throw error;
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remover professor?')) return;
    try {
      const { error } = await supabase.from('professores').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Professor removido' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Professores</h1>
        <Button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Professor
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editId ? 'Editar Professor' : 'Novo Professor'}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => update('nome', e.target.value)} required /></div>
            <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></div>
            <div><Label>Titulação</Label><Input value={form.titulacao} onChange={(e) => update('titulacao', e.target.value)} /></div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">E-mail</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">Titulação</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {professores.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.nome}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{p.email}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{p.titulacao}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(p)} className={`flex items-center gap-1 text-xs font-medium ${p.ativo ? 'text-green-600' : 'text-slate-400'}`}>
                      {p.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setForm({ nome: p.nome, email: p.email || '', titulacao: p.titulacao || '', ativo: p.ativo }); setEditId(p.id); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
