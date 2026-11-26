import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyForm = { data: '', hora_inicio: '', hora_fim: '', descricao: '' };

export default function AdminHorarios() {
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const { toast } = useToast();

  async function load() {
    try {
      const { data, error } = await supabase.from('horarios').select('*').order('data', { ascending: true }).order('hora_inicio', { ascending: true });
      if (error) throw error;
      setHorarios(data || []);
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
        const { error } = await supabase.from('horarios').update(form).eq('id', editId);
        if (error) throw error;
        toast({ title: 'Horário atualizado' });
      } else {
        const { error } = await supabase.from('horarios').insert(form);
        if (error) throw error;
        toast({ title: 'Horário criado' });
      }
      setForm(emptyForm); setEditId(null); setShowForm(false); load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remover horário?')) return;
    try {
      const { error } = await supabase.from('horarios').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Horário removido' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Horários</h1>
        <Button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Horário
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editId ? 'Editar Horário' : 'Novo Horário'}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><Label>Data *</Label><Input type="date" value={form.data} onChange={(e) => update('data', e.target.value)} required /></div>
            <div><Label>Hora Início *</Label><Input type="time" value={form.hora_inicio} onChange={(e) => update('hora_inicio', e.target.value)} required /></div>
            <div><Label>Hora Fim *</Label><Input type="time" value={form.hora_fim} onChange={(e) => update('hora_fim', e.target.value)} required /></div>
            <div className="sm:col-span-3"><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => update('descricao', e.target.value)} placeholder="Ex: Manhã - Turma A" /></div>
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
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Data</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Horário</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">Descrição</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {horarios.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{h.data}</td>
                  <td className="px-4 py-3 text-slate-600">{h.hora_inicio} às {h.hora_fim}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{h.descricao}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setForm({ data: h.data, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, descricao: h.descricao || '' }); setEditId(h.id); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(h.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
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
