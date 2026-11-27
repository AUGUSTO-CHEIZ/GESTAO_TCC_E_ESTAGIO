import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  listarAgendaPublica,
  criarInscricao,
  verificarPrazoApresentador,
} from '@/lib/api';
import { registrarLog } from '@/lib/auditLog';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import ProfessorSelector from '@/components/ProfessorSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  GraduationCap,
  ArrowLeft,
  Search,
  CheckCircle2,
  Calendar,
  Clock,
  UserCheck,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';

function normalizarTexto(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatarDataBr(dataStr) {
  if (!dataStr) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dataStr)) {
    const [ano, mes, dia] = dataStr.slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return dataStr;
}

function formatarNomeComTitulacao(nome, titulacao) {
  const nomeLimpo = String(nome || '').trim();
  const titLimpa = String(titulacao || '').trim();
  if (!nomeLimpo) return '';
  if (!titLimpa) return nomeLimpo;
  if (normalizarTexto(nomeLimpo).startsWith(normalizarTexto(titLimpa))) {
    return nomeLimpo;
  }
  return `${titLimpa} ${nomeLimpo}`;
}

export default function InscricaoApresentador() {
  const { toast } = useToast();

  const [loadingInicial, setLoadingInicial] = useState(true);
  const [prazoInfo, setPrazoInfo] = useState({ aberto: true, motivo: '' });
  const [horarios, setHorarios] = useState([]);
  const [professores, setProfessores] = useState([]);

  // Etapa 1: Busca por código do aluno
  const [codigoBusca, setCodigoBusca] = useState('');
  const [buscandoAluno, setBuscandoAluno] = useState(false);
  const [alunoEncontrado, setAlunoEncontrado] = useState(null);
  const [erroBusca, setErroBusca] = useState('');

  // Etapa 2: E-mail e dados da apresentação
  const [email, setEmail] = useState('');
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [horarioId, setHorarioId] = useState('');
  const [avaliador1Id, setAvaliador1Id] = useState('');
  const [avaliador2Externo, setAvaliador2Externo] = useState(false);
  const [avaliador2Id, setAvaliador2Id] = useState('');
  const [avaliador2ExternoTitulacao, setAvaliador2ExternoTitulacao] = useState('');
  const [avaliador2ExternoNome, setAvaliador2ExternoNome] = useState('');
  const [avaliador2ExternoEmail, setAvaliador2ExternoEmail] = useState('');
  const [tituloTcc, setTituloTcc] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(null);

  useEffect(() => {
    async function carregarInicial() {
      try {
        const [prazoRes, agendaRes, profsRes] = await Promise.all([
          verificarPrazoApresentador(),
          listarAgendaPublica(),
          supabase
            .from('professores')
            .select('id, nome, titulacao, email, user_id')
            .eq('ativo', true)
            .order('nome', { ascending: true }),
        ]);

        if (prazoRes?.data) {
          setPrazoInfo({
            aberto: prazoRes.data.aberto !== false,
            motivo: prazoRes.data.motivo || 'As inscrições para apresentadores estão encerradas.',
          });
        }

        const maxBancas = agendaRes?.data?.evento?.max_bancas_por_horario || 2;
        const listaHorarios = (agendaRes?.data?.horarios || []).map((h) => {
          const limiteSlot = h.max_bancas ?? maxBancas;
          return {
            ...h,
            limite_bancas: limiteSlot,
            disponivel: (h.bancas_count || 0) < limiteSlot,
          };
        });
        setHorarios(listaHorarios);
        setProfessores(profsRes?.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInicial(false);
      }
    }
    carregarInicial();
  }, []);

  // Dias distintos disponíveis
  const diasDisponiveis = useMemo(() => {
    const mapa = new Map();
    for (const h of horarios) {
      if (!h.data) continue;
      if (!mapa.has(h.data)) {
        mapa.set(h.data, { data: h.data, total: 0, livres: 0 });
      }
      const item = mapa.get(h.data);
      item.total += 1;
      if (h.disponivel) item.livres += 1;
    }
    return Array.from(mapa.values());
  }, [horarios]);

  // Horários filtrados pelo dia selecionado
  const horariosDoDia = useMemo(() => {
    if (!diaSelecionado) return [];
    return horarios.filter((h) => h.data === diaSelecionado);
  }, [horarios, diaSelecionado]);

  async function handleBuscarCodigo(e) {
    e.preventDefault();
    const codigoLimpo = codigoBusca.trim();
    if (!codigoLimpo) return;

    setBuscandoAluno(true);
    setErroBusca('');
    setAlunoEncontrado(null);

    try {
      const { data: alunos, error } = await supabase
        .from('alunos_precadastro')
        .select('*')
        .ilike('codigo_aluno', codigoLimpo)
        .limit(1);

      if (error) throw error;

      const aluno = alunos?.[0];
      if (!aluno) {
        setErroBusca(
          'Código não encontrado no pré-cadastro de matriculados. Confira o número ou contate a coordenação.'
        );
        return;
      }

      // Verifica se já existe inscrição ativa como apresentador para este código
      const { data: jaInscrito } = await supabase
        .from('inscricoes')
        .select('id')
        .eq('tipo', 'apresentador')
        .ilike('codigo_academico', codigoLimpo)
        .limit(1);

      if (jaInscrito && jaInscrito.length > 0) {
        setErroBusca(
          'Já existe uma inscrição de apresentador registrada para este código acadêmico. Consulte em Minha Inscrição.'
        );
        return;
      }

      // Vincula orientador cadastrado na tabela professores para obter ID e titulação
      const orientadorRaw = String(aluno.orientador_nome || '').trim();
      const profMatch = professores.find(
        (p) => normalizarTexto(p.nome) === normalizarTexto(orientadorRaw)
      );

      const titulacaoFinal = profMatch?.titulacao || aluno.titulacao || '';
      const nomeOrientadorBase = profMatch?.nome || orientadorRaw;
      const orientadorComTitulacao = formatarNomeComTitulacao(
        nomeOrientadorBase,
        titulacaoFinal
      );

      setAlunoEncontrado({
        ...aluno,
        orientador_id: profMatch?.id || null,
        orientador_nome_base: nomeOrientadorBase,
        orientador_titulacao: titulacaoFinal,
        orientador_exibicao: orientadorComTitulacao,
      });

      const emailSugerido = aluno.email_unesc || aluno.e_mail_unesc || aluno.email || aluno.e_mail || '';
      setEmail(emailSugerido);
    } catch (err) {
      setErroBusca(err.message || 'Erro ao consultar matrícula.');
    } finally {
      setBuscandoAluno(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!alunoEncontrado) {
      toast({
        title: 'Busque seu código acadêmico',
        description: 'Informe e valide seu código antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe seu e-mail para confirmação e certificado.',
        variant: 'destructive',
      });
      return;
    }

    if (!diaSelecionado || !horarioId) {
      toast({
        title: 'Dia e horário obrigatórios',
        description: 'Selecione o dia e o horário da sua apresentação.',
        variant: 'destructive',
      });
      return;
    }

    if (!avaliador1Id) {
      toast({
        title: 'Avaliador(a) 1 obrigatório',
        description: 'Selecione o(a) 1º(ª) professor(a) avaliador(a).',
        variant: 'destructive',
      });
      return;
    }

    if (avaliador2Externo) {
      if (
        !avaliador2ExternoTitulacao.trim() ||
        !avaliador2ExternoNome.trim() ||
        !avaliador2ExternoEmail.trim()
      ) {
        toast({
          title: 'Dados do avaliador externo incompletos',
          description: 'Preencha titulação, nome completo e e-mail do 2º avaliador externo.',
          variant: 'destructive',
        });
        return;
      }
    } else if (!avaliador2Id) {
      toast({
        title: 'Avaliador(a) 2 obrigatório',
        description: 'Selecione o(a) 2º(ª) avaliador(a) ou marque a opção de avaliador externo.',
        variant: 'destructive',
      });
      return;
    }

    if (!tituloTcc.trim()) {
      toast({
        title: 'Título do TCC obrigatório',
        description: 'Informe o título completo do seu trabalho.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const avaliador2ExternoCompleto = formatarNomeComTitulacao(
        avaliador2ExternoNome,
        avaliador2ExternoTitulacao
      );

      const payload = {
        tipo: 'apresentador',
        nome: alunoEncontrado.nome_completo,
        email: email.trim(),
        codigo_academico: alunoEncontrado.codigo_aluno,
        curso: 'Psicologia',
        titulo_tcc: tituloTcc.trim(),
        horario_id: horarioId,
        orientador_id: alunoEncontrado.orientador_id || '',
        orientador_nome: alunoEncontrado.orientador_exibicao || alunoEncontrado.orientador_nome || '',
        avaliador1_id: avaliador1Id,
        avaliador2_tipo: avaliador2Externo ? 'externo' : 'curso',
        avaliador2_id: avaliador2Externo ? '' : avaliador2Id,
        avaliador2_externo_titulacao: avaliador2Externo ? avaliador2ExternoTitulacao.trim() : '',
        avaliador2_externo_nome: avaliador2Externo ? avaliador2ExternoNome.trim() : '',
        avaliador2_externo_email: avaliador2Externo ? avaliador2ExternoEmail.trim() : '',
        avaliador2_nome: avaliador2Externo ? avaliador2ExternoCompleto : '',
      };

      const res = await criarInscricao(payload);

      if (res.data?.error) {
        toast({
          title: 'Não foi possível concluir',
          description: res.data.error,
          variant: 'destructive',
        });
        return;
      }

      // Garante persistência dos campos de avaliador externo e orientador com titulação na banca criada
      const bancaIdCriada = res.data?.banca_id || res.data?.banca?.id;
      if (bancaIdCriada) {
        await supabase
          .from('bancas')
          .update({
            orientador_nome: payload.orientador_nome,
            avaliador2_tipo: avaliador2Externo ? 'externo' : 'curso',
            avaliador2_id: avaliador2Externo ? null : avaliador2Id,
            ...(avaliador2Externo
              ? {
                  avaliador2_nome: avaliador2ExternoCompleto,
                  avaliador2_externo_titulacao: avaliador2ExternoTitulacao.trim(),
                  avaliador2_externo_nome: avaliador2ExternoNome.trim(),
                  avaliador2_externo_email: avaliador2ExternoEmail.trim(),
                }
              : {
                  avaliador2_externo_titulacao: null,
                  avaliador2_externo_nome: null,
                  avaliador2_externo_email: null,
                }),
          })
          .eq('id', bancaIdCriada);
      }

      await registrarLog({
        acao: 'INSCRICAO_APRESENTADOR',
        entidade: 'BANCAS',
        detalhes: `Apresentador(a) ${alunoEncontrado.nome_completo} (${alunoEncontrado.codigo_aluno}) inscreveu o TCC "${tituloTcc.trim()}"`,
      });

      setSucesso({
        nome: alunoEncontrado.nome_completo,
        codigo: alunoEncontrado.codigo_aluno,
        email: email.trim(),
        orientador: payload.orientador_nome,
      });
    } catch (err) {
      toast({
        title: 'Erro ao enviar inscrição',
        description: err.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInicial) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (!prazoInfo.aberto) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Inscrições de Apresentadores Encerradas
            </h1>
            <p className="text-sm text-slate-600">{prazoInfo.motivo}</p>
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/inscricao/espectador">
                <Button className="w-full">Inscrever-se como Espectador</Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  Voltar ao Início
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Inscrição Enviada!</h2>
            <p className="text-sm text-slate-600">
              Olá, <strong>{sucesso.nome}</strong>! Sua proposta de banca foi enviada para aprovação da coordenação.
            </p>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-left text-xs space-y-1 text-slate-700">
              <p>
                <strong>Código:</strong> {sucesso.codigo}
              </p>
              <p>
                <strong>Orientador(a):</strong> {sucesso.orientador || '—'}
              </p>
              <p>
                <strong>E-mail:</strong> {sucesso.email}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/minha-inscricao">
                <Button className="w-full">Acompanhar em Minha Inscrição</Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full">
                  Voltar ao Início
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const professoresExcluidos = [
    alunoEncontrado?.orientador_id,
    avaliador1Id,
    avaliador2Externo ? null : avaliador2Id,
  ].filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />

      <div className="flex-1 max-w-2xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Inscrição como Apresentador
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Siga as etapas abaixo para agendar sua banca de TCC
              </p>
            </div>
          </div>

          {/* Etapa 1: Código do Aluno */}
          <form onSubmit={handleBuscarCodigo} className="space-y-2.5">
            <Label htmlFor="codigo-aluno" className="text-sm font-semibold text-slate-900">
              1. Código do Aluno (Matrícula) *
            </Label>
            <div className="flex gap-2">
              <Input
                id="codigo-aluno"
                value={codigoBusca}
                onChange={(e) => setCodigoBusca(e.target.value)}
                placeholder="Digite seu código acadêmico"
                required
              />
              <Button type="submit" disabled={buscandoAluno} className="shrink-0 gap-1.5">
                {buscandoAluno ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Buscar</span>
              </Button>
            </div>

            {erroBusca && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {erroBusca}
              </div>
            )}
          </form>

          {/* Dados carregados do pré-cadastro + Etapas 2 a 6 */}
          {alunoEncontrado && (
            <form onSubmit={handleSubmit} className="space-y-6 pt-2 border-t border-slate-100">
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold text-xs">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>Matrícula localizada</span>
                </div>
                <p className="text-sm font-bold text-slate-900 break-words">
                  {alunoEncontrado.nome_completo}
                </p>
                <p className="text-xs text-slate-700 break-words">
                  <strong>Orientador(a):</strong>{' '}
                  {alunoEncontrado.orientador_exibicao || 'Não vinculado'}
                </p>
              </div>

              {/* Etapa 2: E-mail */}
              <div className="space-y-1.5">
                <Label htmlFor="email-apresentador" className="text-sm font-semibold text-slate-900">
                  2. E-mail para contato e certificado *
                </Label>
                <Input
                  id="email-apresentador"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@unesc.net"
                  required
                />
              </div>

              {/* Etapa 3: Dia da Apresentação */}
              <div className="space-y-1.5">
                <Label htmlFor="dia-apresentacao" className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>3. Dia da Apresentação *</span>
                </Label>
                <select
                  id="dia-apresentacao"
                  value={diaSelecionado}
                  onChange={(e) => {
                    setDiaSelecionado(e.target.value);
                    setHorarioId('');
                  }}
                  required
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione o dia</option>
                  {diasDisponiveis.map((d) => (
                    <option key={d.data} value={d.data} disabled={d.livres === 0}>
                      {formatarDataBr(d.data)}{' '}
                      {d.livres > 0 ? `(${d.livres} horário(s) disponível(is))` : '(sem vagas)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Etapa 4: Horário da Apresentação */}
              <div className="space-y-1.5">
                <Label htmlFor="horario-apresentacao" className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>4. Horário *</span>
                </Label>
                <select
                  id="horario-apresentacao"
                  value={horarioId}
                  onChange={(e) => setHorarioId(e.target.value)}
                  disabled={!diaSelecionado}
                  required
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {!diaSelecionado
                      ? 'Escolha primeiro o dia acima'
                      : 'Selecione um horário'}
                  </option>
                  {horariosDoDia.map((h) => (
                    <option key={h.id} value={h.id} disabled={!h.disponivel}>
                      {h.hora_inicio?.slice(0, 5)} às {h.hora_fim?.slice(0, 5)}
                      {h.descricao ? ` — ${h.descricao}` : ''}
                      {h.disponivel ? '' : ' (esgotado)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Etapa 5: Banca Avaliadora */}
              <div className="space-y-4">
                <Label className="text-sm font-semibold text-slate-900 block">
                  5. Composição da Banca Avaliadora *
                </Label>

                {/* Orientador bloqueado com titulação antes do nome */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                    Orientador(a)
                  </span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5 break-words">
                    {alunoEncontrado.orientador_exibicao || 'Não informado'}
                  </p>
                </div>

                {/* Avaliador 1 */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">
                    Avaliador(a) 1 (Professor(a) do curso) *
                  </Label>
                  <ProfessorSelector
                    value={avaliador1Id}
                    onChange={(id) => setAvaliador1Id(id)}
                    excludeIds={professoresExcluidos.filter((id) => id !== avaliador1Id)}
                  />
                </div>

                {/* Checkbox grande e destacado para 2º Avaliador Externo */}
                <div className="space-y-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={avaliador2Externo}
                    onClick={() => {
                      const proximo = !avaliador2Externo;
                      setAvaliador2Externo(proximo);
                      if (proximo) {
                        setAvaliador2Id('');
                      } else {
                        setAvaliador2ExternoTitulacao('');
                        setAvaliador2ExternoNome('');
                        setAvaliador2ExternoEmail('');
                      }
                    }}
                    className={`w-full flex items-center gap-3.5 p-4 rounded-xl border-2 text-left transition ${
                      avaliador2Externo
                        ? 'border-indigo-600 bg-indigo-50/70'
                        : 'border-slate-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <div className="shrink-0 text-indigo-600">
                      {avaliador2Externo ? (
                        <CheckSquare className="w-6 h-6" />
                      ) : (
                        <Square className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        2º Avaliador(a) é externo(a) ao curso / instituição
                      </p>
                      <p className="text-xs text-slate-500">
                        Marque esta caixa caso o segundo membro da banca seja convidado externo
                      </p>
                    </div>
                  </button>

                  {!avaliador2Externo ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-700">
                        Avaliador(a) 2 (Professor(a) do curso) *
                      </Label>
                      <ProfessorSelector
                        value={avaliador2Id}
                        onChange={(id) => setAvaliador2Id(id)}
                        excludeIds={professoresExcluidos.filter((id) => id !== avaliador2Id)}
                      />
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-200 space-y-3">
                      <p className="text-xs font-semibold text-indigo-900">
                        Dados do(a) 2º(ª) Avaliador(a) Externo(a)
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Titulação *</Label>
                          <Input
                            value={avaliador2ExternoTitulacao}
                            onChange={(e) => setAvaliador2ExternoTitulacao(e.target.value)}
                            placeholder="Ex: Me., Dra., Esp."
                            required={avaliador2Externo}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Nome Completo *</Label>
                          <Input
                            value={avaliador2ExternoNome}
                            onChange={(e) => setAvaliador2ExternoNome(e.target.value)}
                            placeholder="Nome completo do(a) avaliador(a)"
                            required={avaliador2Externo}
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">E-mail do(a) Avaliador(a) Externo(a) *</Label>
                        <Input
                          type="email"
                          value={avaliador2ExternoEmail}
                          onChange={(e) => setAvaliador2ExternoEmail(e.target.value)}
                          placeholder="avaliador.externo@exemplo.com"
                          required={avaliador2Externo}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Etapa 6: Título do TCC */}
              <div className="space-y-1.5">
                <Label htmlFor="titulo-tcc" className="text-sm font-semibold text-slate-900">
                  6. Título do TCC *
                </Label>
                <Textarea
                  id="titulo-tcc"
                  value={tituloTcc}
                  onChange={(e) => setTituloTcc(e.target.value)}
                  placeholder="Digite o título completo do seu Trabalho de Conclusão de Curso"
                  rows={3}
                  required
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full py-5 text-base">
                {submitting ? 'Enviando inscrição...' : 'Confirmar Inscrição'}
              </Button>
            </form>
          )}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}