import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  vincularProfessorUsuario,
  confirmarPresenca,
  finalizarPrimeiraChamada,
  finalizarSegundaChamada,
  adicionarAlunoUltimaHora,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GraduationCap,
  LogOut,
  Users,
  UserPlus,
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
  CheckCheck,
  X,
} from 'lucide-react';

const STATUS_BADGE = {
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  agendada: { label: 'Agendada', cls: 'bg-indigo-100 text-indigo-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  realizada: { label: 'Realizada', cls: 'bg-slate-800 text-white' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
};

const emptyAddForm = {
  tipo: 'academico',
  nome: '',
  email: '',
  codigo_academico: '',
  curso: 'Psicologia',
  semestre: '',
  parentesco: '',
  cpf: '',
};

export default function ProfessorDashboard() {
  const { user, logout } = useAuth();
  const [professor, setProfessor] = useState(null);
  const [bancas, setBancas] = useState([]);
  const [inscricoes, setInscricoes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bancaExpandida, setBancaExpandida] = useState(null);

  // Controle de horários das chamadas por banca
  const [horariosChamada, setHorariosChamada] = useState({});
  const [processandoChamada, setProcessandoChamada] = useState(null);

  // Modal de inclusão de espectador de última hora (sem opção de apresentador)
  const [bancaAddModal, setBancaAddModal] = useState(null);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [salvandoAdd, setSalvandoAdd] = useState(false);

  const { toast } = useToast();

  async function carregarDados() {
    if (!user?.id) return;
    try {
      const res = await vincularProfessorUsuario();
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }

      const prof = res.data.professor;
      setProfessor(prof);

      const filtros = [`orientador_user_id.eq.${user.id}`];
      if (prof?.id) {
        filtros.push(`orientador_id.eq.${prof.id}`);
        filtros.push(`avaliador1_id.eq.${prof.id}`);
        filtros.push(`avaliador2_id.eq.${prof.id}`);
      }

      const { data: bancasData, error: bErr } = await supabase
        .from('bancas')
        .select('*')
        .or(filtros.join(','))
        .neq('status', 'cancelada')
        .order('horario_data', { ascending: true });

      if (bErr) throw bErr;

      const bancasList = bancasData || [];
      setBancas(bancasList);

      const agora = new Date().toTimeString().slice(0, 5);
      const horariosIniciais = {};
      bancasList.forEach((b) => {
        horariosIniciais[b.id] = b.chamada1_concluida
          ? b.chamada2_horario || agora
          : b.chamada1_horario || agora;
      });
      setHorariosChamada((prev) => ({ ...horariosIniciais, ...prev }));

      if (bancasList.length > 0) {
        const ids = bancasList.map((b) => b.id);
        const { data: todasInscs } = await supabase
          .from('inscricoes')
          .select('*')
          .in('banca_id', ids)
          .order('created_at', { ascending: true });

        const inscMap = {};
        bancasList.forEach((b) => {
          inscMap[b.id] = (todasInscs || []).filter((i) => i.banca_id === b.id);
        });
        setInscricoes(inscMap);
      } else {
        setInscricoes({});
      }
    } catch (e) {
      setError(e.message || 'Erro ao carregar dados do professor');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [user?.id]);

  // Resposta instantânea ao marcar/desmarcar presença
  async function togglePresenca(banca, inscricao) {
    if (banca.status === 'realizada' || banca.chamada2_concluida) return;

    const etapaAtual = banca.chamada1_concluida ? 2 : 1;
    const novoValor = !inscricao.presente;

    // Atualiza na tela imediatamente (sem esperar rede)
    setInscricoes((prev) => ({
      ...prev,
      [banca.id]: (prev[banca.id] || []).map((item) =>
        item.id === inscricao.id
          ? {
              ...item,
              presente: novoValor,
              presente_chamada1: etapaAtual === 1 ? novoValor : item.presente_chamada1,
              presente_chamada2: etapaAtual === 2 ? novoValor : item.presente_chamada2,
            }
          : item
      ),
    }));

    try {
      const res = await confirmarPresenca({
        inscricao_id: inscricao.id,
        presente: novoValor,
        etapa: etapaAtual,
      });

      if (res.data?.error) {
        throw new Error(res.data.error);
      }
    } catch (e) {
      // Reverte somente se falhar no banco
      setInscricoes((prev) => ({
        ...prev,
        [banca.id]: (prev[banca.id] || []).map((item) =>
          item.id === inscricao.id ? inscricao : item
        ),
      }));
      toast({
        title: 'Erro ao salvar presença',
        description: e.message,
        variant: 'destructive',
      });
    }
  }

  async function handleConcluirChamada1(banca) {
    const hora = horariosChamada[banca.id] || new Date().toTimeString().slice(0, 5);
    if (
      !confirm(
        `Concluir a 1ª chamada às ${hora}? Os espectadores não marcados serão movidos para o histórico de ausentes para liberar vagas na 2ª hora.`
      )
    ) {
      return;
    }

    setProcessandoChamada(banca.id);
    try {
      const res = await finalizarPrimeiraChamada({
        banca_id: banca.id,
        horario_chamada: hora,
      });

      if (res.data?.error) throw new Error(res.data.error);

      toast({
        title: '1ª Chamada concluída!',
        description: `${res.data?.vagas_liberadas || 0} vaga(s) liberada(s) para a 2ª hora.`,
      });
      await carregarDados();
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setProcessandoChamada(null);
    }
  }

  async function handleConcluirChamada2(banca) {
    const hora = horariosChamada[banca.id] || new Date().toTimeString().slice(0, 5);
    if (
      !confirm(
        `Encerrar a 2ª chamada às ${hora} e finalizar esta apresentação?`
      )
    ) {
      return;
    }

    setProcessandoChamada(banca.id);
    try {
      const res = await finalizarSegundaChamada({
        banca_id: banca.id,
        horario_chamada: hora,
      });

      if (res.data?.error) throw new Error(res.data.error);

      toast({
        title: '2ª Chamada concluída!',
        description: 'Apresentação encerrada e lista final registrada.',
      });
      await carregarDados();
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setProcessandoChamada(null);
    }
  }

  async function handleSalvarUltimaHora(e) {
    e.preventDefault();
    if (!bancaAddModal) return;

    if (!addForm.nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome completo do espectador.',
        variant: 'destructive',
      });
      return;
    }

    if (addForm.tipo === 'academico' && !addForm.codigo_academico.trim()) {
      toast({
        title: 'Código obrigatório',
        description: 'Informe o código acadêmico do estudante.',
        variant: 'destructive',
      });
      return;
    }

    if (addForm.tipo === 'familiar' && !addForm.parentesco.trim()) {
      toast({
        title: 'Vínculo obrigatório',
        description: 'Informe o grau de parentesco ou vínculo.',
        variant: 'destructive',
      });
      return;
    }

    setSalvandoAdd(true);
    try {
      const res = await adicionarAlunoUltimaHora({
        banca_id: bancaAddModal.id,
        ...addForm,
      });

      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: 'Espectador adicionado e marcado como presente!' });
      setBancaAddModal(null);
      setAddForm(emptyAddForm);
      await carregarDados();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSalvandoAdd(false);
    }
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
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso não autorizado</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Button onClick={() => logout()} className="w-full">
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const tipoLabels = {
    apresentador: 'Apresentador',
    academico: 'Acadêmico',
    familiar: 'Familiar / Amigo',
  };

  const totalInscritos = Object.values(inscricoes).flat().length;
  const totalPresentes = Object.values(inscricoes)
    .flat()
    .filter((i) => i.presente).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cabeçalho */}
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight">
                Painel do Professor
              </h1>
              <p className="text-xs text-slate-300">
                {professor?.nome || user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Minhas Bancas</p>
            <p className="text-2xl font-bold text-slate-900">{bancas.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total de Participantes</p>
            <p className="text-2xl font-bold text-indigo-600">{totalInscritos}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Presenças Confirmadas</p>
            <p className="text-2xl font-bold text-emerald-600">{totalPresentes}</p>
          </div>
        </div>

        {/* Lista de Bancas */}
        {bancas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
            Nenhuma banca vinculada ao seu cadastro até o momento.
          </div>
        ) : (
          <div className="space-y-4">
            {bancas.map((banca) => {
              const inscs = inscricoes[banca.id] || [];
              const presentes = inscs.filter((i) => i.presente).length;
              const expandida = bancaExpandida === banca.id;
              const encerrada =
                banca.status === 'realizada' || Boolean(banca.chamada2_concluida);
              const badge =
                STATUS_BADGE[banca.status] || {
                  label: banca.status || 'Agendada',
                  cls: 'bg-slate-100 text-slate-700',
                };

              return (
                <div
                  key={banca.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setBancaExpandida(expandida ? null : banca.id)}
                    className="w-full text-left p-5 hover:bg-slate-50/80 transition flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>

                        {banca.chamada1_concluida && !encerrada && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            2ª Hora Aberta (1ª chamada às {banca.chamada1_horario})
                          </span>
                        )}

                        {banca.horario_descricao && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3.5 h-3.5" /> {banca.horario_descricao}
                          </span>
                        )}

                        {banca.sala_nome && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5" /> {banca.sala_nome}
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-slate-900 text-base">
                        {banca.titulo_tcc}
                      </h3>

                      <p className="text-xs text-slate-600">
                        Apresentador: <strong>{banca.apresentador_nome || 'Não informado'}</strong>
                        {banca.orientador_nome ? ` • Orientador: ${banca.orientador_nome}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        {presentes}/{inscs.length} presentes
                      </span>
                      {expandida ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {expandida && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-5 space-y-4">
                      {/* Barra de ações da chamada */}
                      {!encerrada ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-indigo-600" />
                              <Label className="text-xs font-semibold text-slate-700">
                                {banca.chamada1_concluida
                                  ? 'Horário 2ª Chamada:'
                                  : 'Horário 1ª Chamada:'}
                              </Label>
                              <Input
                                type="time"
                                value={horariosChamada[banca.id] || ''}
                                onChange={(e) =>
                                  setHorariosChamada((prev) => ({
                                    ...prev,
                                    [banca.id]: e.target.value,
                                  }))
                                }
                                className="w-28 h-8 text-xs"
                              />
                            </div>

                            {!banca.chamada1_concluida ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={processandoChamada === banca.id}
                                onClick={() => handleConcluirChamada1(banca)}
                                className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                              >
                                <CheckCheck className="w-4 h-4" />
                                {processandoChamada === banca.id
                                  ? 'Processando...'
                                  : 'Concluir 1ª Chamada e Liberar Vagas'}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                disabled={processandoChamada === banca.id}
                                onClick={() => handleConcluirChamada2(banca)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                              >
                                <CheckCheck className="w-4 h-4" />
                                {processandoChamada === banca.id
                                  ? 'Encerrando...'
                                  : 'Concluir 2ª Chamada e Encerrar'}
                              </Button>
                            )}
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setAddForm(emptyAddForm);
                              setBancaAddModal(banca);
                            }}
                            className="gap-1.5"
                          >
                            <UserPlus className="w-4 h-4" /> Adicionar Espectador
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium">
                          Chamada encerrada (1ª chamada: {banca.chamada1_horario || '-'} • 2ª
                          chamada: {banca.chamada2_horario || '-'}).
                        </div>
                      )}

                      {/* Lista de Chamada */}
                      {inscs.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6 bg-white rounded-xl border border-slate-200">
                          Nenhum inscrito nesta apresentação.
                        </p>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                          {inscs.map((insc) => (
                            <div
                              key={insc.id}
                              onClick={() => togglePresenca(banca, insc)}
                              className={`p-3.5 flex items-center justify-between gap-3 transition ${
                                encerrada
                                  ? 'cursor-default'
                                  : 'cursor-pointer hover:bg-slate-50 active:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  type="button"
                                  disabled={encerrada}
                                  className="flex-shrink-0 focus:outline-none"
                                >
                                  {insc.presente ? (
                                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                                  ) : (
                                    <Circle className="w-6 h-6 text-slate-300" />
                                  )}
                                </button>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-sm text-slate-900 truncate">
                                      {insc.nome}
                                    </p>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                        insc.tipo === 'apresentador'
                                          ? 'bg-indigo-100 text-indigo-700'
                                          : insc.tipo === 'academico'
                                          ? 'bg-violet-100 text-violet-700'
                                          : 'bg-purple-100 text-purple-700'
                                      }`}
                                    >
                                      {tipoLabels[insc.tipo] || insc.tipo}
                                    </span>
                                    {insc.inclusao_ultima_hora && (
                                      <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-[11px] font-medium">
                                        Última hora
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 truncate">
                                    {insc.codigo_academico ? `Cód: ${insc.codigo_academico} • ` : ''}
                                    {insc.parentesco ? `${insc.parentesco} • ` : ''}
                                    {insc.email || 'Sem e-mail'}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`text-xs font-semibold shrink-0 ${
                                  insc.presente ? 'text-emerald-600' : 'text-slate-400'
                                }`}
                              >
                                {insc.presente ? 'Presente' : 'Ausente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Adicionar Espectador de Última Hora (Apenas Acadêmico ou Familiar/Amigo) */}
      {bancaAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">
                Adicionar Espectador
              </h3>
              <button
                type="button"
                onClick={() => setBancaAddModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Banca: <strong>{bancaAddModal.titulo_tcc}</strong>
            </p>

            {/* Apenas 2 opções: Acadêmico e Familiar / Amigo */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAddForm((f) => ({ ...f, tipo: 'academico' }))}
                className={`p-3 rounded-xl border-2 text-left text-xs transition ${
                  addForm.tipo === 'academico'
                    ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Acadêmico
                <span className="block text-[11px] font-normal text-slate-500">
                  Com certificado
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAddForm((f) => ({ ...f, tipo: 'familiar' }))}
                className={`p-3 rounded-xl border-2 text-left text-xs transition ${
                  addForm.tipo === 'familiar'
                    ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Familiar / Amigo
                <span className="block text-[11px] font-normal text-slate-500">
                  E-mail opcional
                </span>
              </button>
            </div>

            <form onSubmit={handleSalvarUltimaHora} className="space-y-3">
              <div>
                <Label className="text-xs">Nome completo *</Label>
                <Input
                  value={addForm.nome}
                  onChange={(e) => setAddForm((f) => ({ ...f, nome: e.target.value }))}
                  required
                />
              </div>

              {addForm.tipo === 'academico' ? (
                <>
                  <div>
                    <Label className="text-xs">Código do Aluno *</Label>
                    <Input
                      value={addForm.codigo_academico}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, codigo_academico: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Semestre</Label>
                      <Input
                        value={addForm.semestre}
                        onChange={(e) =>
                          setAddForm((f) => ({ ...f, semestre: e.target.value }))
                        }
                        placeholder="Ex: 5º"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail (opcional)</Label>
                      <Input
                        type="email"
                        value={addForm.email}
                        onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Grau de Parentesco / Vínculo *</Label>
                    <Input
                      value={addForm.parentesco}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, parentesco: e.target.value }))
                      }
                      placeholder="Ex: Mãe, Pai, Amigo(a)..."
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">E-mail (opcional)</Label>
                    <Input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBancaAddModal(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvandoAdd}>
                  {salvandoAdd ? 'Salvando...' : 'Adicionar e Confirmar Presença'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}