import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { criarHorariosAutomaticos, buscarAgendaCompleta } from '@/lib/horariosHelper';
import { registrarLog } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Calendar,
  Plus,
  Minus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  Users,
  SlidersHorizontal,
  Save,
} from 'lucide-react';

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function formatarDataBR(iso) {
  if (!iso) return '';
  return iso.split('-').reverse().join('/');
}

export default function AdminHorarios() {
  const [horarios, setHorarios] = useState([]);
  const [bancas, setBancas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pularFds, setPularFds] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [excluindoDia, setExcluindoDia] = useState(false);

  const [configId, setConfigId] = useState(null);
  const [maxBancasPadrao, setMaxBancasPadrao] = useState(2);
  const [salvandoLimite, setSalvandoLimite] = useState(false);

  const [mesRef, setMesRef] = useState(() => new Date());
  const [diaFoco, setDiaFoco] = useState(null);
  const { toast } = useToast();

  async function carregar() {
    try {
      const [res, cfgRes] = await Promise.all([
        buscarAgendaCompleta(),
        supabase.from('configuracao_evento').select('*').limit(1),
      ]);

      setHorarios(res.horarios || []);
      setBancas(res.bancas || []);

      const cfg = cfgRes.data?.[0];
      if (cfg) {
        setConfigId(cfg.id);
        if (cfg.max_bancas_por_horario && Number(cfg.max_bancas_por_horario) >= 1) {
          setMaxBancasPadrao(Number(cfg.max_bancas_por_horario));
        } else {
          setMaxBancasPadrao(2);
        }
      }
    } catch (e) {
      toast({
        title: 'Erro ao carregar agenda',
        description: e.message,
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Retorna o limite efetivo de uma faixa (individual se ajustada, senão o padrão de 2)
  function obterLimiteHorario(horario) {
    if (horario?.max_bancas !== null && horario?.max_bancas !== undefined && Number(horario.max_bancas) >= 1) {
      return Number(horario.max_bancas);
    }
    return maxBancasPadrao;
  }

  async function handleSalvarLimitePadrao(e) {
    e.preventDefault();
    const valor = Math.max(1, Math.min(20, parseInt(maxBancasPadrao, 10) || 2));
    setMaxBancasPadrao(valor);
    setSalvandoLimite(true);

    try {
      if (configId) {
        const { error } = await supabase
          .from('configuracao_evento')
          .update({ max_bancas_por_horario: valor })
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('configuracao_evento')
          .insert({
            nome_evento: 'Bancas de TCC - Psicologia Unesc',
            max_bancas_por_horario: valor,
          })
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }

      await registrarLog({
        acao: 'EDITOU',
        entidade: 'HORÁRIOS',
        detalhes: `Alterou o padrão de vagas simultâneas por horário para ${valor}.`,
      });

      toast({
        title: 'Padrão atualizado!',
        description: `As faixas sem ajuste individual agora usam ${valor} vaga(s) por horário.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar padrão',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSalvandoLimite(false);
    }
  }

  // Ajusta +1 ou -1 vaga em um horário específico
  async function alterarVagasHorario(horario, delta) {
    const limiteAtual = obterLimiteHorario(horario);
    const ocupadas = bancasDoHorario(horario.id).length;
    const minimoPermitido = Math.max(1, ocupadas);
    const novoLimite = Math.max(minimoPermitido, Math.min(20, limiteAtual + delta));

    if (novoLimite === limiteAtual) {
      if (delta < 0 && ocupadas >= limiteAtual) {
        toast({
          title: 'Não é possível reduzir',
          description: `Já existem ${ocupadas} banca(s) agendada(s) neste horário.`,
          variant: 'destructive',
        });
      }
      return;
    }

    // Se voltar ao valor padrão (ex.: 2), salva null para acompanhar o padrão global
    const valorBanco = novoLimite === maxBancasPadrao ? null : novoLimite;
    const backup = [...horarios];

    setHorarios((prev) =>
      prev.map((item) =>
        item.id === horario.id ? { ...item, max_bancas: valorBanco } : item
      )
    );

    const { error } = await supabase
      .from('horarios')
      .update({ max_bancas: valorBanco })
      .eq('id', horario.id);

    if (error) {
      setHorarios(backup);
      toast({
        title: 'Erro ao atualizar vagas do horário',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    registrarLog({
      acao: 'EDITOU',
      entidade: 'HORÁRIOS',
      detalhes: `Ajustou vagas da faixa ${horario.hora_inicio?.slice(0, 5)}–${horario.hora_fim?.slice(
        0,
        5
      )} (${formatarDataBR(horario.data)}) para ${novoLimite} vaga(s).`,
    });

    toast({
      title: 'Vagas do horário atualizadas',
      description: `${horario.hora_inicio?.slice(0, 5)} – ${horario.hora_fim?.slice(
        0,
        5
      )} agora aceita ${novoLimite} apresentação(ões).`,
    });
  }

  async function handleGerar(e) {
    e.preventDefault();
    if (!dataInicio) return;
    setGerando(true);
    try {
      const { criados } = await criarHorariosAutomaticos({
        dataInicio,
        dataFim,
        pularFimDeSemana: pularFds,
        maxBancas: maxBancasPadrao,
      });

      await registrarLog({
        acao: 'CRIOU',
        entidade: 'HORÁRIOS',
        detalhes: `Gerou ${criados} faixa(s) de horário (${formatarDataBR(dataInicio)}${
          dataFim ? ` até ${formatarDataBR(dataFim)}` : ''
        }).`,
      });

      toast({
        title: 'Horários gerados',
        description: `${criados} faixa(s) de 2h criada(s) com ${maxBancasPadrao} vagas cada.`,
      });
      if (!diaFoco) {
        setDiaFoco(dataInicio);
      }
      await carregar();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  }

  async function removerHorario(horario) {
    const backup = [...horarios];
    setHorarios((prev) => prev.filter((h) => h.id !== horario.id));

    const { error } = await supabase.from('horarios').delete().eq('id', horario.id);
    if (error) {
      setHorarios(backup);
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    registrarLog({
      acao: 'EXCLUIU',
      entidade: 'HORÁRIOS',
      detalhes: `Removeu faixa ${horario.hora_inicio?.slice(0, 5)}–${horario.hora_fim?.slice(
        0,
        5
      )} do dia ${formatarDataBR(horario.data)}.`,
    });
  }

  async function removerTodosDoDia(iso) {
    const slotsDia = horarios.filter((h) => h.data === iso);
    if (slotsDia.length === 0) return;

    const slotsLivres = slotsDia.filter(
      (h) => !bancas.some((b) => b.horario_id === h.id)
    );
    const slotsOcupados = slotsDia.length - slotsLivres.length;

    if (slotsLivres.length === 0) {
      toast({
        title: 'Nenhuma faixa livre para excluir',
        description:
          'Todos os horários deste dia já possuem apresentações vinculadas.',
        variant: 'destructive',
      });
      return;
    }

    const msgConfirm =
      slotsOcupados > 0
        ? `Excluir ${slotsLivres.length} faixa(s) livre(s) do dia ${formatarDataBR(
            iso
          )}?\n\n(${slotsOcupados} faixa(s) com banca agendada serão mantidas.)`
        : `Excluir todas as ${slotsLivres.length} faixa(s) do dia ${formatarDataBR(iso)}?`;

    if (!confirm(msgConfirm)) return;

    const idsParaExcluir = slotsLivres.map((h) => h.id);
    const backup = [...horarios];

    setExcluindoDia(true);
    setHorarios((prev) => prev.filter((h) => !idsParaExcluir.includes(h.id)));

    try {
      const { error } = await supabase
        .from('horarios')
        .delete()
        .in('id', idsParaExcluir);

      if (error) throw error;

      await registrarLog({
        acao: 'EXCLUIU',
        entidade: 'HORÁRIOS',
        detalhes: `Excluiu ${idsParaExcluir.length} faixa(s) livre(s) do dia ${formatarDataBR(
          iso
        )}.`,
      });

      toast({
        title: 'Horários do dia excluídos',
        description: `${idsParaExcluir.length} faixa(s) removida(s) de ${formatarDataBR(
          iso
        )}.`,
      });
    } catch (err) {
      setHorarios(backup);
      toast({
        title: 'Erro ao excluir horários do dia',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setExcluindoDia(false);
    }
  }

  const ano = mesRef.getFullYear();
  const mes = mesRef.getMonth();
  const inicioSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const grade = [
    ...Array(inicioSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  const horariosDoDia = (iso) => horarios.filter((h) => h.data === iso);
  const bancasDoHorario = (hid) => bancas.filter((b) => b.horario_id === hid);

  const slotsDiaSelecionado = diaFoco ? horariosDoDia(diaFoco) : [];
  const temLivresNoDia = slotsDiaSelecionado.some(
    (h) => bancasDoHorario(h.id).length === 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Horários</h1>
          <p className="text-sm text-slate-500">
            Padrão de {maxBancasPadrao} vaga(s) por horário, com ajuste individual em cada faixa da agenda.
          </p>
        </div>

        {/* Padrão Global de Apresentações Simultâneas */}
        <form
          onSubmit={handleSalvarLimitePadrao}
          className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>Padrão de vagas por horário:</span>
          </div>
          <Input
            type="number"
            min={1}
            max={20}
            value={maxBancasPadrao}
            onChange={(e) => setMaxBancasPadrao(e.target.value)}
            className="w-20 h-8 text-center font-semibold"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={salvandoLimite}
            className="h-8 gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {salvandoLimite ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </div>

      {/* Gerador de Faixas */}
      <form
        onSubmit={handleGerar}
        className="bg-white p-5 rounded-xl border border-slate-200 flex flex-wrap items-end gap-4"
      >
        <div>
          <Label>Data inicial *</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Data final (opcional)</Label>
          <Input
            type="date"
            value={dataFim}
            min={dataInicio}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={pularFds}
            onChange={(e) => setPularFds(e.target.checked)}
          />
          Pular sábados e domingos
        </label>
        <Button type="submit" disabled={gerando} className="gap-2">
          <Plus className="w-4 h-4" />
          {gerando ? 'Gerando...' : 'Gerar 6 faixas (08h–22h)'}
        </Button>
      </form>

      {/* Calendário + Painel do Dia */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 capitalize flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              {mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMesRef(new Date())}
                className="text-xs"
              >
                Hoje
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMesRef(new Date(ano, mes - 1, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMesRef(new Date(ano, mes + 1, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 pb-2">
            {DIAS_SEMANA.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grade.map((dia, idx) => {
              if (!dia) {
                return <div key={`v-${idx}`} className="h-20 bg-slate-50/50 rounded-lg" />;
              }
              const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(
                2,
                '0'
              )}`;
              const slots = horariosDoDia(iso);
              const totalBancas = slots.reduce(
                (acc, s) => acc + bancasDoHorario(s.id).length,
                0
              );
              const selecionado = diaFoco === iso;

              return (
                <div
                  key={iso}
                  onClick={() => setDiaFoco(iso)}
                  className={`h-20 p-1.5 rounded-lg border text-left cursor-pointer transition ${
                    selecionado
                      ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500'
                      : 'border-slate-100 hover:border-indigo-300'
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

        {/* Detalhes do Dia Clicado */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <h4 className="font-semibold text-slate-800 text-sm">
              {diaFoco
                ? `Agenda de ${formatarDataBR(diaFoco)}`
                : 'Clique em um dia no calendário'}
            </h4>

            {diaFoco && temLivresNoDia && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={excluindoDia}
                onClick={() => removerTodosDoDia(diaFoco)}
                className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {excluindoDia ? 'Excluindo...' : 'Excluir todos do dia'}
              </Button>
            )}
          </div>

          {!diaFoco || slotsDiaSelecionado.length === 0 ? (
            <p className="text-sm text-slate-400">
              {diaFoco
                ? 'Nenhum horário cadastrado neste dia.'
                : 'Selecione uma data ao lado para gerenciar as faixas de horário.'}
            </p>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {slotsDiaSelecionado.map((h) => {
                const lista = bancasDoHorario(h.id);
                const limiteSlot = obterLimiteHorario(h);
                const lotado = lista.length >= limiteSlot;
                const personalizado = limiteSlot !== maxBancasPadrao;

                return (
                  <div
                    key={h.id}
                    className={`p-3 rounded-lg border space-y-2 transition ${
                      personalizado
                        ? 'border-indigo-300 bg-indigo-50/40'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-xs font-bold ${
                            lotado ? 'text-rose-600' : 'text-indigo-700'
                          }`}
                        >
                          {h.hora_inicio?.slice(0, 5)} – {h.hora_fim?.slice(0, 5)} ({lista.length}/
                          {limiteSlot} vagas)
                        </span>
                        {personalizado && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            {limiteSlot > maxBancasPadrao
                              ? `+${limiteSlot - maxBancasPadrao} extra`
                              : 'Ajustado'}
                          </span>
                        )}
                      </div>

                      {/* Controle individual de vagas + exclusão */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => alterarVagasHorario(h, -1)}
                          disabled={limiteSlot <= Math.max(1, lista.length)}
                          title="Diminuir 1 vaga neste horário"
                          className="w-6 h-6 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => alterarVagasHorario(h, 1)}
                          title="Liberar +1 vaga neste horário"
                          className="w-6 h-6 rounded border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        {lista.length === 0 && (
                          <button
                            type="button"
                            onClick={() => removerHorario(h)}
                            title="Excluir esta faixa"
                            className="p-1 ml-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {lista.map((b) => (
                      <div
                        key={b.id}
                        className="bg-white p-2.5 rounded border border-slate-200 text-xs space-y-1"
                      >
                        <p className="font-semibold text-slate-900 flex items-center gap-1">
                          <User className="w-3 h-3 text-indigo-600" /> {b.apresentador_nome}
                        </p>
                        <p className="text-slate-500 italic line-clamp-1">{b.titulo_tcc}</p>
                        <p className="text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {b.sala_nome || 'Sala a definir'}
                        </p>
                        <p className="text-slate-600">Orientador: {b.orientador_nome || '—'}</p>
                        <p className="text-slate-600 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Avaliadores: {b.avaliador1_nome || '—'} e{' '}
                          {b.avaliador2_tipo === 'externo'
                            ? b.avaliador2_externo_nome
                            : b.avaliador2_nome || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}