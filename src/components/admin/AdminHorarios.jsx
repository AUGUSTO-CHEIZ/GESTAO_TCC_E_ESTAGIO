import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { criarHorariosAutomaticos, buscarAgendaCompleta } from '@/lib/horariosHelper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight, MapPin, User, Users } from 'lucide-react';

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export default function AdminHorarios() {
  const [horarios, setHorarios] = useState([]);
  const [bancas, setBancas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pularFds, setPularFds] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [mesRef, setMesRef] = useState(() => new Date());
  const [diaFoco, setDiaFoco] = useState(null);
  const { toast } = useToast();

  async function carregar() {
    try {
      const res = await buscarAgendaCompleta();
      setHorarios(res.horarios);
      setBancas(res.bancas);
    } catch (e) {
      toast({ title: 'Erro ao carregar agenda', description: e.message, variant: 'destructive' });
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleGerar(e) {
    e.preventDefault();
    if (!dataInicio) return;
    setGerando(true);
    try {
      const { criados } = await criarHorariosAutomaticos({ dataInicio, dataFim, pularFimDeSemana: pularFds });
      toast({ title: 'Horários gerados', description: `${criados} faixa(s) de 2h criada(s).` });
      await carregar();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  }

  async function removerHorario(id) {
    const { error } = await supabase.from('horarios').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }
    carregar();
  }

  const ano = mesRef.getFullYear();
  const mes = mesRef.getMonth();
  const inicioSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const grade = [...Array(inicioSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)];

  const horariosDoDia = (iso) => horarios.filter((h) => h.data === iso);
  const bancasDoHorario = (hid) => bancas.filter((b) => b.horario_id === hid);

  return (
    <div className="space-y-6">
      <form onSubmit={handleGerar} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-wrap items-end gap-4">
        <div>
          <Label>Data inicial *</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
        </div>
        <div>
          <Label>Data final (opcional)</Label>
          <Input type="date" value={dataFim} min={dataInicio} onChange={(e) => setDataFim(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-2 cursor-pointer">
          <input type="checkbox" checked={pularFds} onChange={(e) => setPularFds(e.target.checked)} />
          Pular sábados e domingos
        </label>
        <Button type="submit" disabled={gerando} className="gap-2">
          <Plus className="w-4 h-4" /> {gerando ? 'Gerando...' : 'Gerar 6 faixas (08h–22h)'}
        </Button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 capitalize flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              {mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setMesRef(new Date(ano, mes - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => setMesRef(new Date(ano, mes + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 pb-2">
            {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grade.map((dia, idx) => {
              if (!dia) return <div key={`v-${idx}`} className="h-20 bg-slate-50/50 rounded-lg" />;
              const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              const slots = horariosDoDia(iso);
              const totalBancas = slots.reduce((acc, s) => acc + bancasDoHorario(s.id).length, 0);
              const selecionado = diaFoco === iso;

              return (
                <div
                  key={iso}
                  onClick={() => setDiaFoco(iso)}
                  className={`h-20 p-1.5 rounded-lg border text-left cursor-pointer transition ${
                    selecionado ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-100 hover:border-indigo-300'
                  }`}
                >
                  <span className="text-xs font-medium text-slate-700">{dia}</span>
                  {slots.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      <span className="block text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 truncate">
                        {slots.length} faixas
                      </span>
                      {totalBancas > 0 && (
                        <span className="block text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white truncate">
                          {totalBancas} banca(s)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h4 className="font-semibold text-slate-800 border-b pb-2">
            {diaFoco ? `Agenda de ${diaFoco.split('-').reverse().join('/')}` : 'Clique em um dia no calendário'}          </h4>
          {!diaFoco || horariosDoDia(diaFoco).length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum horário cadastrado neste dia.</p>
          ) : (
            horariosDoDia(diaFoco).map((h) => {
              const lista = bancasDoHorario(h.id);
              return (
                <div key={h.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700">{h.hora_inicio} – {h.hora_fim} ({lista.length}/2 vagas)</span>
                    {lista.length === 0 && (
                      <button onClick={() => removerHorario(h.id)} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {lista.map((b) => (
                    <div key={b.id} className="bg-white p-2.5 rounded border border-slate-200 text-xs space-y-1">
                      <p className="font-semibold text-slate-900 flex items-center gap-1"><User className="w-3 h-3" /> {b.apresentador_nome}</p>
                      <p className="text-slate-500 italic line-clamp-1">{b.titulo_tcc}</p>
                      <p className="text-slate-600 flex items-center gap-1"><MapPin className="w-3 h-3" /> {b.sala_nome || 'Sala a definir'}</p>
                      <p className="text-slate-600">Orientador: {b.orientador_nome}</p>
                      <p className="text-slate-600 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Avaliadores: {b.avaliador1_nome} e {b.avaliador2_tipo === 'externo' ? b.avaliador2_externo_nome : b.avaliador2_nome}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}