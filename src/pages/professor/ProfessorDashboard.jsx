import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import {
  vincularProfessorUsuario,
  confirmarPresenca,
  finalizarPrimeiraChamada,
  finalizarSegundaChamada,
  adicionarAlunoUltimaHora,
} from '@/lib/api';
import { registrarLog } from '@/lib/auditLog';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Circle,
  UserPlus,
  QrCode,
  LogOut,
  MessageCircle,
  Lock,
  Eye,
  X,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

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

function formatarDataBr(dataStr) {
  if (!dataStr) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dataStr)) {
    const [ano, mes, dia] = dataStr.slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return dataStr;
}

function getBadgeStatus(status) {
  const norm = String(status || '').toLowerCase();
  if (norm === 'agendada' || norm === 'aprovada') {
    return {
      label: 'Agendada',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  if (norm === 'realizada' || norm === 'finalizada') {
    return {
      label: 'Finalizada',
      className: 'bg-slate-200 text-slate-700 border-slate-300',
    };
  }
  return {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  };
}

export default function ProfessorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [orientador, setOrientador] = useState(null);
  const [bancas, setBancas] = useState([]);
  const [mapaProfessores, setMapaProfessores] = useState({});
  const [inscricoes, setInscricoes] = useState({});
  const [loading, setLoading] = useState(true);
  const [erroAcesso, setErroAcesso] = useState('');

  const [horariosChamada, setHorariosChamada] = useState({});
  const [processandoChamada, setProcessandoChamada] = useState(null);

  const [bancaAddModal, setBancaAddModal] = useState(null);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [salvandoAdd, setSalvandoAdd] = useState(false);

  const [qrBanca, setQrBanca] = useState(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErroAcesso('');
    try {
      const vincRes = await vincularProfessorUsuario();
      if (vincRes.data?.error) {
        setErroAcesso(vincRes.data.error);
        setLoading(false);
        return;
      }

      const prof = vincRes.data?.professor;
      setOrientador(prof);

      const { data: todosProfs } = await supabase
        .from('professores')
        .select('id, nome, titulacao');

      const mapProfs = {};
      for (const p of todosProfs || []) {
        mapProfs[p.id] = p.titulacao ? `${p.titulacao} ${p.nome}` : p.nome;
      }
      setMapaProfessores(mapProfs);

      const filtros = [];
      if (prof?.id) {
        filtros.push(`orientador_id.eq.${prof.id}`);
        filtros.push(`avaliador1_id.eq.${prof.id}`);
        filtros.push(`avaliador2_id.eq.${prof.id}`);
      }
      if (user?.id) {
        filtros.push(`orientador_user_id.eq.${user.id}`);
      }

      if (filtros.length === 0) {
        setBancas([]);
        setLoading(false);
        return;
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

      const inscMap = {};
      for (const banca of bancasList) {
        const { data: inscs } = await supabase
          .from('inscricoes')
          .select('*')
          .eq('banca_id', banca.id)
          .neq('tipo', 'apresentador')
          .order('nome', { ascending: true });
        inscMap[banca.id] = inscs || [];
      }
      setInscricoes(inscMap);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao carregar bancas',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  function isBancaEditavel(banca) {
    const statusNorm = String(banca.status || '').toLowerCase();
    const jaFinalizada =
      statusNorm === 'realizada' ||
      statusNorm === 'finalizada' ||
      Boolean(banca.chamada2_concluida);
    if (jaFinalizada) return false;
    return statusNorm === 'agendada' || statusNorm === 'aprovada';
  }

  async function togglePresenca(banca, inscricao) {
    if (!isBancaEditavel(banca)) return;

    const etapaAtual = banca.chamada1_concluida ? 2 : 1;
    const novoValor = !inscricao.presente;

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
    if (!isBancaEditavel(banca)) return;
    const hora = horariosChamada[banca.id] || new Date().toTimeString().slice(0, 5);
    if (
      !confirm(
        `Concluir a 1ª chamada às ${hora}? Os espectadores não marcados serão movidos para o histórico de ausentes e suas vagas serão liberadas para a 2ª hora.`
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

      const vagasLiberadas = res.data?.vagas_liberadas || 0;

      await registrarLog({
        acao: 'CHAMADA_1',
        entidade: 'BANCAS',
        detalhes: `Concluiu 1ª chamada às ${hora} na banca "${banca.titulo_tcc}" (${vagasLiberadas} vaga(s) liberada(s))`,
      });

      toast({
        title: '1ª Chamada concluída!',
        description: `${vagasLiberadas} vaga(s) liberada(s) para a 2ª hora.`,
      });
      await carregarDados();
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setProcessandoChamada(null);
    }
  }

  async function handleConcluirChamada2(banca) {
    if (!isBancaEditavel(banca)) return;
    const hora = horariosChamada[banca.id] || new Date().toTimeString().slice(0, 5);
    if (
      !confirm(`Encerrar a 2ª chamada às ${hora} e finalizar esta apresentação?`)
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

      await registrarLog({
        acao: 'CHAMADA_2',
        entidade: 'BANCAS',
        detalhes: `Concluiu 2ª chamada às ${hora} e finalizou a banca "${banca.titulo_tcc}"`,
      });

      toast({
        title: '2ª Chamada concluída!',
        description: 'Apresentação finalizada e lista de presença encerrada.',
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

      await registrarLog({
        acao: 'ADICIONAR_ULTIMA_HORA',
        entidade: 'INSCRICOES',
        detalhes: `Adicionou espectador de última hora "${addForm.nome.trim()}" (${addForm.tipo}) na banca "${bancaAddModal.titulo_tcc}"`,
      });

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

  async function handleSair() {
    if (logout) {
      await logout();
    } else {
      await supabase.auth.signOut();
    }
    navigate('/');
  }

  function copiarLinkQr(url) {
    navigator.clipboard.writeText(url);
    setLinkCopiado(true);
    toast({ title: 'Link da apresentação copiado!' });
    setTimeout(() => setLinkCopiado(false), 2500);
  }

  const nomeOrientadorExibicao = orientador
    ? orientador.titulacao
      ? `${orientador.titulacao} ${orientador.nome}`
      : orientador.nome
    : user?.email || 'Orientador(a)';

  const linkQrAtual = qrBanca
    ? `${window.location.origin}/inscricao/espectador?banca=${qrBanca.id}`
    : '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Cabeçalho Responsivo */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                Painel do Orientador
              </h1>
              <p className="text-xs text-slate-500 truncate">{nomeOrientadorExibicao}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://wa.me/554834312650"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Suporte Coordenação</span>
            </a>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSair}
              className="gap-1.5 text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : erroAcesso ? (
          <div className="bg-white rounded-2xl border border-red-200 p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm font-medium text-red-700">{erroAcesso}</p>
          </div>
        ) : bancas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-2">
            <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
            <h2 className="text-base font-semibold text-slate-800">
              Nenhuma banca vinculada no momento
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Assim que você for selecionado(a) como orientador(a) ou avaliador(a) em uma banca, ela aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {bancas.map((banca) => {
              const listaEspectadores = inscricoes[banca.id] || [];
              const editavel = isBancaEditavel(banca);
              const badge = getBadgeStatus(banca.status);
              const etapaChamada = banca.chamada1_concluida ? 2 : 1;

              const papeis = [];
              if (
                banca.orientador_id === orientador?.id ||
                banca.orientador_user_id === user?.id
              ) {
                papeis.push('Orientador(a)');
              }
              if (banca.avaliador1_id === orientador?.id) {
                papeis.push('Avaliador(a) 1');
              }
              if (banca.avaliador2_id === orientador?.id) {
                papeis.push('Avaliador(a) 2');
              }

              const nomeAvaliador1 =
                banca.avaliador1_nome ||
                (banca.avaliador1_id ? mapaProfessores[banca.avaliador1_id] : '') ||
                'Não definido';

              const nomeAvaliador2 =
                banca.avaliador2_tipo === 'externo'
                  ? [banca.avaliador2_externo_titulacao, banca.avaliador2_externo_nome]
                      .filter(Boolean)
                      .join(' ') || 'Avaliador Externo'
                  : banca.avaliador2_nome ||
                    (banca.avaliador2_id ? mapaProfessores[banca.avaliador2_id] : '') ||
                    'Não definido';

              const presentesCount = listaEspectadores.filter((i) => i.presente).length;
              const vagasTotais = Number(banca.vagas_espectadores || 30);
              const vagasDisponiveis = Math.max(0, vagasTotais - listaEspectadores.length);

              return (
                <div
                  key={banca.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Cabeçalho do Card da Banca */}
                  <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-100 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.className}`}
                        >
                          {badge.label}
                        </span>

                        {papeis.length > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-200">
                            {papeis.join(' • ')}
                          </span>
                        )}
                      </div>

                      {!editavel && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          <Eye className="w-3.5 h-3.5" /> Somente visualização
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-slate-900 break-words leading-snug">
                      {banca.titulo_tcc}
                    </h2>

                    {/* Informações da Apresentação e Banca */}
                    <div className="space-y-1.5 text-xs sm:text-sm text-slate-600">
                      <p className="break-words">
                        <strong className="text-slate-800">Apresentador(a):</strong>{' '}
                        {banca.apresentador_nome || '—'}
                      </p>
                      <p className="break-words">
                        <strong className="text-slate-800">Avaliador(a) 1:</strong> {nomeAvaliador1}
                      </p>
                      <p className="break-words">
                        <strong className="text-slate-800">Avaliador(a) 2:</strong> {nomeAvaliador2}
                        {banca.avaliador2_tipo === 'externo' && ' (Externo)'}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-slate-500">
                        {banca.horario_data && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            {formatarDataBr(banca.horario_data)}
                          </span>
                        )}
                        {banca.horario_descricao && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            {banca.horario_descricao}
                          </span>
                        )}
                        {banca.sala_nome && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            {banca.sala_nome}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          {listaEspectadores.length} inscrito(s) • {vagasDisponiveis} vaga(s) livre(s)
                        </span>
                      </div>
                    </div>

                    {/* Ações disponíveis apenas quando Agendada */}
                    {editavel && (
                      <div className="pt-2 flex flex-col sm:flex-row flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAddForm(emptyAddForm);
                            setBancaAddModal(banca);
                          }}
                          className="gap-1.5 w-full sm:w-auto justify-center"
                        >
                          <UserPlus className="w-4 h-4 text-indigo-600" />
                          Adicionar Espectador
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLinkCopiado(false);
                            setQrBanca(banca);
                          }}
                          className="gap-1.5 w-full sm:w-auto justify-center"
                        >
                          <QrCode className="w-4 h-4 text-indigo-600" />
                          QR Code da Banca
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Corpo do Card: Lista de Chamada */}
                  <div className="p-4 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {banca.chamada2_concluida
                            ? 'Lista Final de Espectadores'
                            : etapaChamada === 1
                            ? '1ª Chamada — 1ª Hora'
                            : '2ª Chamada — Encerramento'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {presentesCount} presente(s) de {listaEspectadores.length} espectador(es)
                          {banca.chamada1_horario && ` • 1ª chamada às ${banca.chamada1_horario}`}
                          {banca.chamada2_horario && ` • Encerrada às ${banca.chamada2_horario}`}
                        </p>
                      </div>
                    </div>

                    {listaEspectadores.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs sm:text-sm text-slate-500">
                        Nenhum espectador inscrito nesta apresentação até o momento.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {listaEspectadores.map((insc) => {
                          const marcado = Boolean(insc.presente);
                          return (
                            <div
                              key={insc.id}
                              onClick={() => editavel && togglePresenca(banca, insc)}
                              className={`p-3 sm:p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                marcado
                                  ? 'border-emerald-300 bg-emerald-50/60'
                                  : 'border-slate-200 bg-white'
                              } ${
                                editavel
                                  ? 'cursor-pointer hover:border-indigo-300'
                                  : 'cursor-default opacity-90'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="mt-0.5 shrink-0">
                                  {marcado ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-slate-300" />
                                  )}
                                </div>

                                <div className="min-w-0 space-y-0.5">
                                  <p className="text-sm font-medium text-slate-900 break-words">
                                    {insc.nome}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                                    <span className="font-medium text-slate-600">
                                      {insc.tipo === 'academico'
                                        ? 'Acadêmico'
                                        : 'Familiar / Amigo'}
                                    </span>
                                    {insc.codigo_academico && (
                                      <span>• Cód: {insc.codigo_academico}</span>
                                    )}
                                    {insc.parentesco && <span>• {insc.parentesco}</span>}
                                    {insc.inclusao_ultima_hora && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                        Última hora
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="self-end sm:self-center shrink-0">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    marcado
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {marcado ? 'Presente' : 'Ausente'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Controles de Conclusão da 1ª ou 2ª Chamada */}
                    {editavel && (
                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div className="w-full sm:w-48">
                          <Label className="text-xs text-slate-600 mb-1 block">
                            Horário da {etapaChamada}ª chamada
                          </Label>
                          <Input
                            type="time"
                            value={
                              horariosChamada[banca.id] ||
                              new Date().toTimeString().slice(0, 5)
                            }
                            onChange={(e) =>
                              setHorariosChamada((prev) => ({
                                ...prev,
                                [banca.id]: e.target.value,
                              }))
                            }
                          />
                        </div>

                        {etapaChamada === 1 ? (
                          <Button
                            type="button"
                            onClick={() => handleConcluirChamada1(banca)}
                            disabled={processandoChamada === banca.id}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700"
                          >
                            {processandoChamada === banca.id
                              ? 'Processando...'
                              : 'Concluir 1ª Chamada e Liberar Vagas'}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => handleConcluirChamada2(banca)}
                            disabled={processandoChamada === banca.id}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                          >
                            {processandoChamada === banca.id
                              ? 'Finalizando...'
                              : 'Concluir 2ª Chamada e Finalizar Banca'}
                          </Button>
                        )}
                      </div>
                    )}

                    {!editavel && (
                      <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {String(banca.status || '').toLowerCase() === 'pendente'
                            ? 'Banca aguardando aprovação da coordenação para liberar a chamada.'
                            : 'Apresentação finalizada. Alterações bloqueadas.'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Adicionar Espectador de Última Hora */}
      {bancaAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Adicionar Espectador (Última Hora)
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {bancaAddModal.titulo_tcc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBancaAddModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarUltimaHora} className="space-y-3.5">
              <div>
                <Label className="text-xs mb-1.5 block">Tipo de Espectador *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, tipo: 'academico' }))}
                    className={`p-2.5 rounded-xl border-2 text-left text-xs font-semibold transition ${
                      addForm.tipo === 'academico'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Acadêmico
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, tipo: 'familiar' }))}
                    className={`p-2.5 rounded-xl border-2 text-left text-xs font-semibold transition ${
                      addForm.tipo === 'familiar'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Familiar / Amigo
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs">Nome Completo *</Label>
                <Input
                  value={addForm.nome}
                  onChange={(e) => setAddForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo do espectador"
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
                      placeholder="Ex: 202412345"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">E-mail (para certificado)</Label>
                    <Input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="aluno@unesc.net"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Parentesco / Vínculo *</Label>
                    <Input
                      value={addForm.parentesco}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, parentesco: e.target.value }))
                      }
                      placeholder="Ex: Mãe, Pai, Amigo(a)"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs">E-mail (opcional)</Label>
                    <Input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="opcional@exemplo.com"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBancaAddModal(null)}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoAdd}
                  className="w-full sm:w-auto"
                >
                  {salvandoAdd ? 'Salvando...' : 'Adicionar e Marcar Presença'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: QR Code da Banca */}
      {qrBanca && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">QR Code para Espectadores</h3>
              <button
                type="button"
                onClick={() => setQrBanca(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 break-words">{qrBanca.titulo_tcc}</p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 inline-flex items-center justify-center mx-auto">
              <QRCodeCanvas value={linkQrAtual} size={190} includeMargin />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => copiarLinkQr(linkQrAtual)}
              className="w-full gap-2"
            >
              {linkCopiado ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" /> Link Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar Link de Inscrição
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}