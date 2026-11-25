import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  vincularProfessorUsuario,
  confirmarPresenca,
  finalizarPrimeiraChamada,
  finalizarSegundaChamada,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import StatusBadge from '@/components/public/StatusBadge';
import ProfessorAddAluno from '@/components/professor/ProfessorAddAluno';
import {
  GraduationCap, LogOut, Users, UserPlus, CheckCircle, Circle,
  ChevronDown, ChevronUp, AlertCircle, Calendar, MapPin, Clock, CheckCheck,
} from 'lucide-react';

function sugerirHorario15Min(desc) {
  const match = String(desc || '').match(/(\d{2}):(\d{2})/);
  if (!match) return '08:15';
  const total = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + 15;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function sugerirHorarioFim(desc) {
  const matches = String(desc || '').match(/(\d{2}:\d{2})/g);
  return matches && matches.length >= 2 ? matches[1] : new Date().toTimeString().slice(0, 5);
}

const tipoLabels = { apresentador: 'Apresentador', academico: 'Acadêmico', familiar: 'Familiar' };

export default function ProfessorDashboard() {
  const { user, logout } = useAuth();
  const [professor, setProfessor] = useState(null);
  const [bancas, setBancas] = useState([]);
  const [inscricoes, setInscricoes] = useState({});
  const [horariosChamada, setHorariosChamada] = useState({});
  const [loading, setLoading] = useState(true);
  const [salvandoEtapa, setSalvandoEtapa] = useState(null);
  const [error, setError] = useState(null);
  const [bancaExpandida, setBancaExpandida] = useState(null);
  const [showAddForm, setShowAddForm] = useState(null);
  const { toast } = useToast();

  async function carregarBancas(profId) {
    const { data: bancasData, error: bErr } = await supabase
      .from('bancas')
      .select('*')
      .or(`orientador_user_id.eq.${user.id},orientador_id.eq.${profId},avaliador1_id.eq.${profId},avaliador2_id.eq.${profId}`)
      .order('horario_data', { ascending: true });

    if (bErr) throw bErr;
    const lista = bancasData || [];
    setBancas(lista);

    const inscMap = {};
    const hInit = {};
    for (const b of lista) {
      const { data: inscs } = await supabase.from('inscricoes').select('*').eq('banca_id', b.id);
      inscMap[b.id] = inscs || [];
      hInit[b.id] = !b.chamada1_concluida
        ? sugerirHorario15Min(b.horario_descricao)
        : sugerirHorarioFim(b.horario_descricao);
    }
    setInscricoes(inscMap);
    setHorariosChamada((prev) => ({ ...hInit, ...prev }));
  }

  useEffect(() => {
    async function init() {
      try {
        const res = await vincularProfessorUsuario();
        if (res.data?.error) {
          setError(res.data.error);
          return;
        }
        setProfessor(res.data.professor);
        await carregarBancas(res.data.professor?.id || '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        setError(e.message || 'Erro ao carregar dados do professor');
      } finally {
        setLoading(false);
      }
    }
    if (user?.id) init();
  }, [user?.id]);

  async function togglePresenca(banca, insc) {
    const etapa = banca.chamada1_concluida ? 2 : 1;
    const estavaPresente = etapa === 2
      ? Boolean(insc.presente_chamada2)
      : Boolean(insc.presente_chamada1 || insc.presente);
    const novoValor = !estavaPresente;

    const res = await confirmarPresenca({ inscricao_id: insc.id, presente: novoValor, etapa });
    if (res.data?.error) {
      toast({ title: 'Erro', description: res.data.error, variant: 'destructive' });
      return;
    }

    setInscricoes((prev) => ({
      ...prev,
      [banca.id]: (prev[banca.id] || []).map((i) =>
        i.id === insc.id
          ? {
              ...i,
              presente: novoValor,
              ...(etapa === 1 ? { presente_chamada1: novoValor } : { presente_chamada2: novoValor }),
            }
          : i
      ),
    }));
  }

  async function handleConcluirChamada(banca) {
    const isSegunda = Boolean(banca.chamada1_concluida);
    const msg = isSegunda
      ? 'Concluir a 2ª chamada e encerrar esta apresentação?'
      : 'Concluir a 1ª chamada? Os espectadores não marcados serão movidos para o histórico de ausentes e suas vagas serão liberadas para a 2ª hora.';
    if (!confirm(msg)) return;

    setSalvandoEtapa(banca.id);
    try {
      const horario = horariosChamada[banca.id];
      const res = isSegunda
        ? await finalizarSegundaChamada({ banca_id: banca.id, horario_chamada: horario })
        : await finalizarPrimeiraChamada({ banca_id: banca.id, horario_chamada: horario });

      if (res.data?.error) throw new Error(res.data.error);

      toast({
        title: isSegunda ? '2ª chamada concluída!' : '1ª chamada concluída!',
        description: isSegunda
          ? 'Banca encerrada com sucesso.'
          : `${res.data.vagas_liberadas} vaga(s) liberada(s) para inscrições da 2ª hora.`,
      });
      await carregarBancas(professor.id);
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSalvandoEtapa(null);
    }
  }

  async function refreshInscricoes(bancaId) {
    const { data: inscs } = await supabase.from('inscricoes').select('*').eq('banca_id', bancaId);
    setInscricoes((prev) => ({ ...prev, [bancaId]: inscs || [] }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso não autorizado</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={() => logout()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-indigo-400" />
            <div>
              <h1 className="font-bold">Painel do Professor</h1>
              <p className="text-xs text-slate-400">{professor?.nome}</p>
            </div>
          </div>
          <button onClick={() => logout()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-4">
        {bancas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
            Nenhuma banca vinculada ao seu cadastro no momento.
          </div>
        ) : (
          bancas.map((banca) => {
            const inscs = inscricoes[banca.id] || [];
            const expandida = bancaExpandida === banca.id;
            const isSegunda = Boolean(banca.chamada1_concluida);
            const encerrada = Boolean(banca.chamada2_concluida);
            const papeis = [];
            if (banca.orientador_id === professor?.id || banca.orientador_user_id === user?.id) papeis.push('Orientador(a)');
            if (banca.avaliador1_id === professor?.id) papeis.push('Avaliador(a) 1');
            if (banca.avaliador2_id === professor?.id) papeis.push('Avaliador(a) 2');
            const presentes = inscs.filter((i) => (isSegunda ? i.presente_chamada2 : i.presente_chamada1 || i.presente)).length;

            return (
              <div key={banca.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setBancaExpandida(expandida ? null : banca.id)} className="w-full text-left p-5 hover:bg-slate-50 flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{banca.titulo_tcc}</h3>
                      <StatusBadge status={banca.status} />
                      {papeis.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">
                          {papeis.join(' • ')}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${encerrada ? 'bg-green-100 text-green-700' : isSegunda ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {encerrada ? 'Chamadas concluídas' : isSegunda ? '2ª Chamada (2ª hora)' : '1ª Chamada (1ª hora)'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {banca.horario_descricao && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {banca.horario_descricao}</span>}
                      {banca.sala_nome && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {banca.sala_nome}</span>}
                      {banca.apresentador_nome && <span>Apresentador: <strong>{banca.apresentador_nome}</strong></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600 flex items-center gap-1"><Users className="w-4 h-4" /> {presentes}/{inscs.length}</span>
                    {expandida ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {expandida && (
                  <div className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <p className="font-semibold text-slate-900 text-sm">
                          {encerrada ? 'Registro Finalizado' : isSegunda ? '2ª Chamada — Encerramento da Banca' : '1ª Chamada — Liberação de Vagas'}
                        </p>
                        {banca.chamada1_concluida && <p>1ª chamada registrada às <strong>{banca.chamada1_horario}</strong></p>}
                        {banca.chamada2_concluida && <p>2ª chamada registrada às <strong>{banca.chamada2_horario}</strong></p>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!encerrada && (
                          <>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border rounded-lg px-2.5 py-1.5">
                              <Clock className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Horário:</span>
                              <input
                                type="time"
                                value={horariosChamada[banca.id] || ''}
                                onChange={(e) => setHorariosChamada((p) => ({ ...p, [banca.id]: e.target.value }))}
                                className="bg-transparent font-semibold text-slate-900 focus:outline-none"
                              />
                            </label>
                            <button
                              onClick={() => handleConcluirChamada(banca)}
                              disabled={salvandoEtapa === banca.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                            >
                              <CheckCheck className="w-4 h-4" />
                              {salvandoEtapa === banca.id ? 'Salvando...' : isSegunda ? 'Concluir 2ª Chamada' : 'Concluir 1ª Chamada'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setShowAddForm(banca)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                        >
                          <UserPlus className="w-4 h-4" /> Adicionar Aluno
                        </button>
                      </div>
                    </div>

                    {inscs.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-4">Nenhum participante inscrito nesta banca.</p>
                    ) : (
                      <div className="space-y-2">
                        {inscs.map((insc) => {
                          const marcado = isSegunda ? Boolean(insc.presente_chamada2) : Boolean(insc.presente_chamada1 || insc.presente);
                          return (
                            <div key={insc.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                              <button onClick={() => togglePresenca(banca, insc)} className="flex items-center gap-3 text-left flex-1">
                                {marcado ? <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" /> : <Circle className="w-6 h-6 text-slate-300 flex-shrink-0" />}
                                <div>
                                  <p className="font-medium text-slate-900 text-sm">{insc.nome}</p>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">{tipoLabels[insc.tipo] || insc.tipo}</span>
                                    {insc.etapa_chamada === 2 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">2ª hora</span>}
                                    {insc.inclusao_ultima_hora && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Última hora</span>}
                                    <span>{[insc.codigo_academico && `Cód: ${insc.codigo_academico}`, insc.email].filter(Boolean).join(' • ')}</span>
                                  </div>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {showAddForm && (
        <ProfessorAddAluno
          banca={showAddForm}
          onClose={() => setShowAddForm(null)}
          onAdded={() => {
            refreshInscricoes(showAddForm.id);
            setShowAddForm(null);
          }}
        />
      )}
    </div>
  );
}