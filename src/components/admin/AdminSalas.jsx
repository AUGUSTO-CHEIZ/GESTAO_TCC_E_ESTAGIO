import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyForm = { nome: '', capacidade: '', localizacao: '' };

export default function AdminSalas() {
  const [salas, setSalas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const { toast } = useToast();

  async function load() {
    try {
      const { data, error } = await supabase.from('salas').select('*').order('nome', { ascending: true });
      if (error) throw error;
      setSalas(data || []);
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
        const { error } = await supabase.from('salas').update(form).eq('id', editId);
        if (error) throw error;
        toast({ title: 'Sala atualizada' });
      } else {
        const { error } = await supabase.from('salas').insert(form);
        if (error) throw error;
        toast({ title: 'Sala criada' });
      }
      setForm(emptyForm); setEditId(null); setShowForm(false); load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remover sala?')) return;
    try {
      const { error } = await supabase.from('salas').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Sala removida' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Salas</h1>
        <Button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Sala
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editId ? 'Editar Sala' : 'Nova Sala'}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => update('nome', e.target.value)} required /></div>
            <div><Label>Capacidade</Label><Input type="number" value={form.capacidade} onChange={(e) => update('capacidade', e.target.value)} min={1} /></div>
            <div><Label>Localização</Label><Input value={form.localizacao} onChange={(e) => update('localizacao', e.target.value)} placeholder="Ex: Bloco A, 2º andar" /></div>
            <div className="sm:col-span-3 flex gap-2 justify-end">
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
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">Capacidade</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">Localização</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salas.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.nome}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{s.capacidade}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{s.localizacao}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setForm({ nome: s.nome, capacidade: s.capacidade || '', localizacao: s.localizacao || '' }); setEditId(s.id); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
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
