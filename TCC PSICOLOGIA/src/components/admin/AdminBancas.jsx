import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ProfessorSelector from '@/components/ProfessorSelector';
import StatusBadge from '@/components/public/StatusBadge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyForm = {
  titulo_tcc: '', apresentador_nome: '', horario_id: '', sala_id: '',
  orientador_id: '', avaliador1_id: '', avaliador2_id: '', status: 'pendente', vagas_espectadores: 30
};

export default function AdminBancas() {
  const [bancas, setBancas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const { toast } = useToast();

  async function load() {
    try {
      const [bRes, hRes, sRes] = await Promise.all([
        supabase.from('bancas').select('*').order('created_at', { ascending: false }),
        supabase.from('horarios').select('*').eq('ativo', true).order('data', { ascending: true }),
        supabase.from('salas').select('*').eq('ativa', true).order('nome', { ascending: true }),
      ]);
      setBancas(bRes.data || []);
      setHorarios(hRes.data || []);
      setSalas(sRes.data || []);
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
      const horarioObj = horarios.find((h) => h.id === form.horario_id);
      const salaObj = salas.find((s) => s.id === form.sala_id);

      const payload = {
        ...form,
        horario_id: form.horario_id || null,
        sala_id: form.sala_id || null,
        orientador_id: form.orientador_id || null,
        avaliador1_id: form.avaliador1_id || null,
        avaliador2_id: form.avaliador2_id || null,
        horario_descricao: horarioObj ? (horarioObj.descricao || `${horarioObj.data} ${horarioObj.hora_inicio}`) : '',
        horario_data: horarioObj ? horarioObj.data : '',
        sala_nome: salaObj ? salaObj.nome : '',
      };

      if (editId) {
        const { error } = await supabase.from('bancas').update(payload).eq('id', editId);
        if (error) throw error;
        toast({ title: 'Banca atualizada' });
      } else {
        const { error } = await supabase.from('bancas').insert(payload);
        if (error) throw error;
        toast({ title: 'Banca criada' });
      }
      setForm(emptyForm); setEditId(null); setShowForm(false); load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remover banca?')) return;
    try {
      const { error } = await supabase.from('bancas').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Banca removida' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  const statusOptions = ['pendente', 'agendada', 'realizada', 'cancelada'];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bancas</h1>
        <Button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Banca
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editId ? 'Editar Banca' : 'Nova Banca'}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label>Título do TCC *</Label><Textarea value={form.titulo_tcc} onChange={(e) => update('titulo_tcc', e.target.value)} required rows={2} /></div>
            <div><Label>Nome do Apresentador</Label><Input value={form.apresentador_nome} onChange={(e) => update('apresentador_nome', e.target.value)} /></div>
            <div>
              <Label>Horário</Label>
              <select value={form.horario_id} onChange={(e) => update('horario_id', e.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Selecionar...</option>
                {horarios.map((h) => <option key={h.id} value={h.id}>{h.descricao || `${h.data} ${h.hora_inicio}`}</option>)}
              </select>
            </div>
            <div>
              <Label>Sala</Label>
              <select value={form.sala_id} onChange={(e) => update('sala_id', e.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Selecionar...</option>
                {salas.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div><Label>Orientador</Label><ProfessorSelector value={form.orientador_id} onChange={(id) => update('orientador_id', id)} excludeIds={[form.avaliador1_id, form.avaliador2_id].filter(Boolean)} /></div>
            <div><Label>Avaliador 1</Label><ProfessorSelector value={form.avaliador1_id} onChange={(id) => update('avaliador1_id', id)} excludeIds={[form.orientador_id, form.avaliador2_id].filter(Boolean)} /></div>
            <div><Label>Avaliador 2</Label><ProfessorSelector value={form.avaliador2_id} onChange={(id) => update('avaliador2_id', id)} excludeIds={[form.orientador_id, form.avaliador1_id].filter(Boolean)} /></div>
            <div>
              <Label>Status</Label>
              <select value={form.status} onChange={(e) => update('status', e.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Vagas Espectadores</Label><Input type="number" value={form.vagas_espectadores} onChange={(e) => update('vagas_espectadores', parseInt(e.target.value))} min={0} /></div>
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
        <div className="space-y-3">
          {bancas.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900">{b.titulo_tcc}</h3>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-slate-500">{b.apresentador_nome}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setForm({
                      titulo_tcc: b.titulo_tcc,
                      apresentador_nome: b.apresentador_nome || '',
                      horario_id: b.horario_id || '',
                      sala_id: b.sala_id || '',
                      orientador_id: b.orientador_id || '',
                      avaliador1_id: b.avaliador1_id || '',
                      avaliador2_id: b.avaliador2_id || '',
                      status: b.status,
                      vagas_espectadores: b.vagas_espectadores || 30
                    });
                    setEditId(b.id);
                    setShowForm(true);
                  }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(b.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
