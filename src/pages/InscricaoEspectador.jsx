import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  listarAgendaPublica,
  criarInscricaoEspectador,
  analisarEmailDigitado,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Clock,
  Users,
  Lock,
  Mail,
  AlertCircle,
  Sparkles,
  Edit3,
} from 'lucide-react';

const initialForm = {
  tipo: 'academico',
  nome: '',
  email: '',
  codigo_academico: '',
  cpf: '',
  parentesco: '',
  senha: '',
  confirmar_senha: '',
};

export default function InscricaoEspectador() {
  const [searchParams] = useSearchParams();
  const bancaPreSelecionada = searchParams.get('banca') || '';

  const [bancas, setBancas] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [dadosConfirmados, setDadosConfirmados] = useState(false);
  const [bancasSelecionadas, setBancasSelecionadas] = useState(
    bancaPreSelecionada ? [bancaPreSelecionada] : []
  );
  const [submitting, setSubmitting] = useState(false);
  const [resultadoSucesso, setResultadoSucesso] = useState(null);
  const [erroForm, setErroForm] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    async function carregar() {
      setLoadingAgenda(true);
      try {
        const res = await listarAgendaPublica();
        if (res?.data?.bancas) {
          setBancas(res.data.bancas);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAgenda(false);
      }
    }
    carregar();
  }, []);

  const analiseEmail = useMemo(() => {
    return analisarEmailDigitado(form.email);
  }, [form.email]);

  function atualizarCampo(campo, valor) {
    setErroForm('');
    if (dadosConfirmados) {
      setDadosConfirmados(false);
    }
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function aplicarSugestaoEmail() {
    if (!analiseEmail.sugestao) return;
    setErroForm('');
    setForm((prev) => ({ ...prev, email: analiseEmail.sugestao }));
    toast({
      title: 'E-mail corrigido',
      description: `Alterado para ${analiseEmail.sugestao}`,
    });
  }

  function handleConfirmarDados(e) {
    e.preventDefault();
    setErroForm('');

    const nomeLimpo = form.nome.trim();
    const emailLimpo = form.email.trim();
    const isFamiliar = form.tipo === 'familiar';

    if (!nomeLimpo) {
      setErroForm('Informe seu nome completo.');
      return;
    }

    if (!isFamiliar && !emailLimpo) {
      setErroForm('O campo e-mail é obrigatório para acadêmicos.');
      return;
    }

    if (emailLimpo && !analiseEmail.valido) {
      setErroForm(
        analiseEmail.erro ||
          'Verifique o endereço de e-mail antes de confirmar os dados.'
      );
      return;
    }

    if (!form.senha || form.senha.trim().length < 4) {
      setErroForm('Crie uma senha com pelo menos 4 caracteres para consultar sua inscrição.');
      return;
    }

    if (form.senha !== form.confirmar_senha) {
      setErroForm('A senha e a confirmação de senha não coincidem.');
      return;
    }

    setDadosConfirmados(true);
    toast({
      title: 'Dados confirmados!',
      description: 'Agora escolha as apresentações (sem choque de horário).',
    });
  }

function chaveHorarioBanca(banca) {
    return banca?.horario_id || `${banca?.horario_data || ''}_${banca?.horario_descricao || ''}`;
  }

  function alternarBanca(banca) {
    if (!dadosConfirmados) return;
    setErroForm('');

    const jaSelecionada = bancasSelecionadas.includes(banca.id);
    if (jaSelecionada) {
      setBancasSelecionadas((prev) => prev.filter((id) => id !== banca.id));
      return;
    }

    const chaveNova = chaveHorarioBanca(banca);
    const temConflito = bancasSelecionadas.some((idAtual) => {
      const bAtual = bancas.find((item) => item.id === idAtual);
      return bAtual && chaveHorarioBanca(bAtual) === chaveNova;
    });

    if (temConflito) {
      setErroForm(
        `Conflito de horário: você já selecionou uma apresentação no mesmo dia e horário (${banca.horario_descricao || banca.horario_data}).`
      );
      return;
    }

    setBancasSelecionadas((prev) => [...prev, banca.id]);
  }

  async function handleFinalizarInscricao() {
    if (!dadosConfirmados) {
      setErroForm('Confirme primeiro os seus dados pessoais antes de enviar.');
      return;
    }

    if (bancasSelecionadas.length === 0) {
      setErroForm('Selecione pelo menos uma banca para concluir a inscrição.');
      return;
    }

    setSubmitting(true);
    setErroForm('');

    try {
      const res = await criarInscricaoEspectador({
        tipo: form.tipo,
        nome: form.nome.trim(),
        email: form.email.trim(),
        codigo_academico: form.codigo_academico.trim(),
        cpf: form.cpf.trim(),
        parentesco: form.parentesco.trim(),
        senha: form.senha,
        banca_ids: bancasSelecionadas,
      });

      if (res?.data?.error) {
        if (res.data.sugestao_email) {
          setDadosConfirmados(false);
        }
        setErroForm(res.data.error);
        toast({
          title: 'Não foi possível concluir',
          description: res.data.error,
          variant: 'destructive',
        });
        return;
      }

      setResultadoSucesso(res.data);
      toast({
        title: 'Inscrição confirmada!',
        description: `${res.data.total || bancasSelecionadas.length} apresentação(ões) registrada(s).`,
      });
    } catch (err) {
      setErroForm(err.message || 'Erro inesperado ao salvar inscrição.');
    } finally {
      setSubmitting(false);
    }
  }

  const isFamiliar = form.tipo === 'familiar';
  const chavesOcupadas = new Set(
    bancasSelecionadas
      .map((id) => bancas.find((b) => b.id === id))
      .filter(Boolean)
      .map((b) => chaveHorarioBanca(b))
  );

  if (resultadoSucesso) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div className="flex items-center gap-3 text-emerald-600">
            <CheckCircle2 className="w-8 h-8 shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Inscrição Realizada!</h1>
              <p className="text-sm text-slate-600">
                Sua presença foi registrada em {resultadoSucesso.total || bancasSelecionadas.length}{' '}
                apresentação(ões).
              </p>
            </div>
          </div>

          {form.email.trim() ? (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-sm text-indigo-900 flex items-start gap-2.5">
              <Mail className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" />
              <div>
                <p className="font-medium">Confirmação por e-mail</p>
                <p className="text-xs text-indigo-700 mt-0.5">
                  {resultadoSucesso.email_confirmacao?.enviado
                    ? `Enviamos o resumo da sua inscrição para ${form.email.trim()}.`
                    : `Inscrição vinculada a ${form.email.trim()}. Use seu e-mail e a senha cadastrada em "Minha Inscrição" para consultar seus horários.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-700">
              Inscrição de familiar/amigo registrada sem e-mail. Para consultar depois, utilize
              seu nome/código e a senha definida.
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/minha-inscricao">
              <Button className="gap-2">Consultar Minha Inscrição</Button>
            </Link>
            <Link to="/">
              <Button variant="outline">Voltar ao Início</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para a tela inicial
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Inscrição de Espectador</h1>
            <p className="text-sm text-slate-500 mt-1">
              Passo 1: confirme seus dados e crie uma senha de consulta. Passo 2: escolha as
              bancas sem choque de horário.
            </p>
          </div>

          {/* PASSO 1: DADOS PESSOAIS + SENHA */}
          <form onSubmit={handleConfirmarDados} className="space-y-4 border-b border-slate-100 pb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Seus Dados e Senha de Acesso
              </h2>
              {dadosConfirmados && (
                <button
                  type="button"
                  onClick={() => setDadosConfirmados(false)}
                  className="text-xs font-medium text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Editar dados
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={dadosConfirmados}
                onClick={() => atualizarCampo('tipo', 'academico')}
                className={`p-3 rounded-xl border text-left transition ${
                  form.tipo === 'academico'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <p className="font-semibold text-sm">Acadêmico / Estudante</p>
                <p className="text-xs text-slate-500">E-mail obrigatório para registro</p>
              </button>

              <button
                type="button"
                disabled={dadosConfirmados}
                onClick={() => atualizarCampo('tipo', 'familiar')}
                className={`p-3 rounded-xl border text-left transition ${
                  form.tipo === 'familiar'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <p className="font-semibold text-sm">Familiar / Amigo</p>
                <p className="text-xs text-slate-500">E-mail opcional</p>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome completo *</Label>
                <Input
                  value={form.nome}
                  disabled={dadosConfirmados}
                  onChange={(e) => atualizarCampo('nome', e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <Label>
                  E-mail {isFamiliar ? '(opcional para familiar/amigo)' : '*'}
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  disabled={dadosConfirmados}
                  onChange={(e) => atualizarCampo('email', e.target.value)}
                  placeholder={isFamiliar ? 'opcional@exemplo.com' : 'seu.email@unesc.net'}
                  required={!isFamiliar}
                />
              </div>

              {form.tipo === 'academico' ? (
                <div>
                  <Label>Código do aluno (opcional)</Label>
                  <Input
                    value={form.codigo_academico}
                    disabled={dadosConfirmados}
                    onChange={(e) => atualizarCampo('codigo_academico', e.target.value)}
                    placeholder="Ex.: 20231045"
                  />
                </div>
              ) : (
                <div>
                  <Label>Parentesco ou relação (opcional)</Label>
                  <Input
                    value={form.parentesco}
                    disabled={dadosConfirmados}
                    onChange={(e) => atualizarCampo('parentesco', e.target.value)}
                    placeholder="Ex.: Mãe, Pai, Cônjuge, Amigo(a)"
                  />
                </div>
              )}

              <div>
                <Label className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" /> Senha de consulta *
                </Label>
                <Input
                  type="password"
                  value={form.senha}
                  disabled={dadosConfirmados}
                  onChange={(e) => atualizarCampo('senha', e.target.value)}
                  placeholder="Crie uma senha (mín. 4 caracteres)"
                  required
                />
              </div>

              <div>
                <Label>Confirmar senha *</Label>
                <Input
                  type="password"
                  value={form.confirmar_senha}
                  disabled={dadosConfirmados}
                  onChange={(e) => atualizarCampo('confirmar_senha', e.target.value)}
                  placeholder="Repita a senha"
                  required
                />
              </div>
            </div>

            {/* Detector / Corretor de erros comuns de digitação de e-mail */}
            {form.email.trim() && !analiseEmail.valido && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-amber-900 text-xs sm:text-sm">
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  <span>{analiseEmail.erro}</span>
                </div>
                {analiseEmail.sugestao && !dadosConfirmados && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={aplicarSugestaoEmail}
                    className="shrink-0"
                  >
                    Corrigir para {analiseEmail.sugestao}
                  </Button>
                )}
              </div>
            )}

            {!dadosConfirmados && (
              <div className="pt-1">
                <Button type="submit" className="gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Confirmar dados e escolher bancas
                </Button>
              </div>
            )}
          </form>

          {/* PASSO 2: ESCOLHA DAS BANCAS (LIBERADO APÓS CONFIRMAR DADOS) */}
          <div className={`space-y-4 ${!dadosConfirmados ? 'opacity-60 pointer-events-none select-none' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                    dadosConfirmados
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  2
                </span>
                Escolha as Apresentações de TCC
              </h2>
              <span className="text-xs font-medium text-slate-500">
                {bancasSelecionadas.length} selecionada(s)
              </span>
            </div>

            {!dadosConfirmados && (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                Preencha seus dados e clique em <strong>"Confirmar dados e escolher bancas"</strong>{' '}
                para liberar a seleção das apresentações.
              </p>
            )}

            {loadingAgenda ? (
              <p className="text-sm text-slate-500 py-4">Carregando apresentações...</p>
            ) : bancas.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                Nenhuma apresentação disponível no momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bancas.map((banca) => {
                  const selecionada = bancasSelecionadas.includes(banca.id);
                  const semVagas = (banca.vagas_restantes ?? 1) <= 0;
                  const encerrada =
                    banca.status === 'realizada' ||
                    banca.status === 'cancelada' ||
                    Boolean(banca.chamada2_concluida);
                  const choqueHorario =
                    !selecionada && chavesOcupadas.has(chaveHorarioBanca(banca));
                  const bloqueada = semVagas || encerrada || choqueHorario;

                  return (
                    <button
                      key={banca.id}
                      type="button"
                      disabled={!dadosConfirmados || bloqueada}
                      onClick={() => alternarBanca(banca)}
                      className={`p-4 rounded-xl border text-left transition flex flex-col justify-between gap-3 ${
                        selecionada
                          ? 'border-indigo-600 bg-indigo-50/80 ring-1 ring-indigo-600'
                          : bloqueada
                          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                          : 'border-slate-200 bg-white hover:border-indigo-300'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs font-medium text-indigo-700">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {banca.horario_data || 'Data a confirmar'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {banca.hora_inicio && banca.hora_fim
                              ? `${banca.hora_inicio.slice(0, 5)} – ${banca.hora_fim.slice(0, 5)}`
                              : banca.horario_descricao || 'Horário'}
                          </span>
                        </div>

                        <p className="font-semibold text-slate-900 text-sm line-clamp-2">
                          {banca.titulo_tcc}
                        </p>

                        <p className="text-xs text-slate-600">
                          Apresentador(a): <strong>{banca.apresentador_nome || 'A definir'}</strong>
                          {banca.orientador_nome ? ` • Orient.: ${banca.orientador_nome}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Users className="w-3.5 h-3.5" />
                          {semVagas
                            ? 'Sem vagas'
                            : `${banca.vagas_restantes ?? banca.vagas_espectadores ?? 30} vaga(s)`}
                        </span>

                        <span
                          className={`font-semibold ${
                            selecionada
                              ? 'text-indigo-700'
                              : choqueHorario
                              ? 'text-amber-600'
                              : encerrada
                              ? 'text-slate-400'
                              : 'text-emerald-700'
                          }`}
                        >
                          {selecionada
                            ? 'Selecionada'
                            : choqueHorario
                            ? 'Choque de horário'
                            : encerrada
                            ? 'Encerrada'
                            : 'Selecionar'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {erroForm && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erroForm}</span>
            </div>
          )}

          {dadosConfirmados && (
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                disabled={submitting || bancasSelecionadas.length === 0}
                onClick={handleFinalizarInscricao}
                className="gap-2"
              >
                {submitting
                  ? 'Salvando inscrição...'
                  : `Concluir inscrição (${bancasSelecionadas.length})`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}