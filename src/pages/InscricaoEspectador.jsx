import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listarAgendaPublica, criarInscricao } from '@/lib/api';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckCircle,
  Users,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  CheckSquare,
  Square,
  Lock,
} from 'lucide-react';

function formatarData(dataStr) {
  if (!dataStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const [y, m, d] = dataStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dataStr;
}

export default function InscricaoEspectador() {
  const [searchParams] = useSearchParams();
  const bancaParam = searchParams.get('banca');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [selectedBancas, setSelectedBancas] = useState(bancaParam ? [bancaParam] : []);
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  const [form, setForm] = useState({
    nome: '',
    email: '',
    cpf: '',
    codigo_academico: '',
    curso: 'Psicologia',
    semestre: '',
    parentesco: '',
    tipo: 'academico',
  });
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await listarAgendaPublica();
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Atualiza o relógio a cada 10s para liberar automaticamente às :15 sem precisar dar F5
  useEffect(() => {
    const timer = setInterval(() => {
      setAgoraMs(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const bancas = (data?.bancas || [])
    .filter((b) => b.vagas_restantes > 0 && b.status !== 'realizada' && b.status !== 'cancelada')
    .map((b) => {
      const bloqueadaAgora =
        Boolean(b.chamada1_concluida) &&
        Boolean(b.liberacao_2hora_ms) &&
        agoraMs < b.liberacao_2hora_ms;
      return {
        ...b,
        bloqueadaAgora,
      };
    });

  // Remove da seleção caso a banca vinda via QR Code esteja na trava de 15 minutos
  useEffect(() => {
    if (bancas.length === 0) return;
    setSelectedBancas((prev) =>
      prev.filter((id) => {
        const found = bancas.find((b) => b.id === id);
        return found && !found.bloqueadaAgora;
      })
    );
  }, [agoraMs, data]);

  function getChaveHorario(b) {
    return b.horario_id || `${b.horario_data}_${b.hora_inicio || b.horario_descricao}`;
  }

  function toggleBanca(banca) {
    if (banca.bloqueadaAgora) {
      toast({
        title: 'Aguarde o horário da 2ª hora',
        description: `As vagas desta apresentação abrem às ${banca.horario_liberacao_2hora}.`,
        variant: 'destructive',
      });
      return;
    }

    const jaSelecionada = selectedBancas.includes(banca.id);
    if (jaSelecionada) {
      setSelectedBancas((prev) => prev.filter((id) => id !== banca.id));
      return;
    }

    const chaveNova = getChaveHorario(banca);
    const conflito = selectedBancas.some((id) => {
      const outra = bancas.find((item) => item.id === id);
      return outra && getChaveHorario(outra) === chaveNova;
    });

    if (conflito) {
      toast({
        title: 'Conflito de horário',
        description:
          'Você já selecionou outra apresentação neste mesmo dia e horário. Escolha apenas uma por horário.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedBancas((prev) => [...prev, banca.id]);
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (selectedBancas.length === 0) {
      toast({
        title: 'Selecione ao menos uma banca',
        description: 'Marque uma ou mais apresentações que deseja assistir.',
        variant: 'destructive',
      });
      return;
    }

    if (!form.nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe seu nome completo.',
        variant: 'destructive',
      });
      return;
    }

    if (form.tipo === 'academico') {
      if (!form.email.trim()) {
        toast({
          title: 'E-mail obrigatório',
          description: 'Acadêmicos precisam informar o e-mail para emissão do certificado.',
          variant: 'destructive',
        });
        return;
      }
      if (!form.codigo_academico.trim()) {
        toast({
          title: 'Código do aluno obrigatório',
          description: 'Informe seu código acadêmico.',
          variant: 'destructive',
        });
        return;
      }
      if (!form.semestre.trim()) {
        toast({
          title: 'Semestre obrigatório',
          description: 'Informe seu semestre/período.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (form.tipo === 'familiar' && !form.parentesco.trim()) {
      toast({
        title: 'Parentesco obrigatório',
        description: 'Informe seu grau de parentesco ou vínculo com o apresentador.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await criarInscricao({
        tipo: form.tipo,
        banca_ids: selectedBancas,
        ...form,
      });

      if (res.data?.error) {
        toast({ title: 'Erro', description: res.data.error, variant: 'destructive' });
      } else {
        setSuccess({
          email: form.email.trim(),
          total: selectedBancas.length,
        });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao realizar inscrição',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Inscrição Confirmada!</h2>
            <p className="text-slate-600 mb-4">
              Você foi inscrito(a) como ouvinte em <strong>{success.total}</strong>{' '}
              apresentação(ões).
            </p>
            {success.email ? (
              <>
                <div className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl py-3 px-4 mb-4">
                  <p className="text-sm font-medium text-indigo-700">{success.email}</p>
                </div>
                <p className="text-xs text-slate-500 mb-6">
                  Use este e-mail na aba Consultar Inscrição para acompanhar suas bancas.
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 mb-6">
                Seu nome já consta na lista de presença do professor responsável pela sala.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {success.email && (
                <Link to="/minha-inscricao">
                  <Button className="w-full">Consultar Inscrição</Button>
                </Link>
              )}
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <div className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Inscrição como Espectador</h1>
              <p className="text-slate-500 text-sm">
                Selecione quantas apresentações desejar (desde que não sejam no mesmo dia e horário)
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seleção de Bancas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold text-slate-900">
                  1. Escolha as apresentações ({selectedBancas.length} selecionada(s)) *
                </Label>
                {selectedBancas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedBancas([])}
                    className="text-xs text-slate-500 hover:text-red-600"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : bancas.length === 0 ? (
                <div className="border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
                  Nenhuma apresentação com vagas disponíveis no momento.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {bancas.map((banca) => {
                    const selecionada = selectedBancas.includes(banca.id);
                    const chave = getChaveHorario(banca);
                    const bloqueadaPorConflito =
                      !selecionada &&
                      selectedBancas.some((id) => {
                        const outra = bancas.find((item) => item.id === id);
                        return outra && getChaveHorario(outra) === chave;
                      });
                    const desabilitada = banca.bloqueadaAgora || bloqueadaPorConflito;

                    return (
                      <div
                        key={banca.id}
                        onClick={() => !desabilitada && toggleBanca(banca)}
                        className={`rounded-xl border-2 p-4 transition ${
                          banca.bloqueadaAgora
                            ? 'border-amber-200 bg-amber-50/60 opacity-85 cursor-not-allowed'
                            : selecionada
                            ? 'border-indigo-600 bg-indigo-50/70 cursor-pointer'
                            : bloqueadaPorConflito
                            ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                            : 'border-slate-200 hover:border-indigo-300 bg-white cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-0.5 text-indigo-600">
                            {banca.bloqueadaAgora ? (
                              <Lock className="w-5 h-5 text-amber-600" />
                            ) : selecionada ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {banca.horario_data && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                  {formatarData(banca.horario_data)}
                                </span>
                              )}
                              {(banca.hora_inicio || banca.horario_descricao) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  {banca.hora_inicio && banca.hora_fim
                                    ? `${banca.hora_inicio.slice(0, 5)} às ${banca.hora_fim.slice(
                                        0,
                                        5
                                      )}`
                                    : banca.horario_descricao}
                                </span>
                              )}
                              {banca.sala_nome && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {banca.sala_nome}
                                </span>
                              )}
                              {banca.bloqueadaAgora ? (
                                <span className="ml-auto px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                                  2ª hora abre às {banca.horario_liberacao_2hora}
                                </span>
                              ) : (
                                <span className="ml-auto text-emerald-700 font-semibold">
                                  {banca.vagas_restantes} vaga(s)
                                </span>
                              )}
                            </div>

                            <p className="font-semibold text-slate-900 text-sm">
                              {banca.titulo_tcc}
                            </p>

                            <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                              {banca.apresentador_nome && (
                                <span>
                                  Apresentador: <strong>{banca.apresentador_nome}</strong>
                                </span>
                              )}
                              {banca.orientador_nome && (
                                <span>Orientador: {banca.orientador_nome}</span>
                              )}
                            </div>

                            {bloqueadaPorConflito && (
                              <p className="text-xs text-amber-700 font-medium">
                                Horário ocupado por outra banca já selecionada acima
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tipo de Espectador */}
            <div>
              <Label className="mb-3 block text-base font-semibold text-slate-900">
                2. Tipo de Espectador *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => update('tipo', 'academico')}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    form.tipo === 'academico'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-900 text-sm">Acadêmico</p>
                  <p className="text-xs text-slate-500">Estudante (com emissão de certificado)</p>
                </button>
                <button
                  type="button"
                  onClick={() => update('tipo', 'familiar')}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    form.tipo === 'familiar'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-900 text-sm">Familiar / Amigo</p>
                  <p className="text-xs text-slate-500">Convidado (e-mail opcional)</p>
                </button>
              </div>
            </div>

            {/* Dados Pessoais */}
            <div className="space-y-4">
              <div>
                <Label>Nome completo *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => update('nome', e.target.value)}
                  required
                />
              </div>

              {form.tipo === 'academico' ? (
                <>
                  <div>
                    <Label>E-mail *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Código do Aluno *</Label>
                      <Input
                        value={form.codigo_academico}
                        onChange={(e) => update('codigo_academico', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Semestre / Período *</Label>
                      <Input
                        value={form.semestre}
                        onChange={(e) => update('semestre', e.target.value)}
                        placeholder="Ex: 5º semestre"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Grau de Parentesco / Vínculo *</Label>
                    <Input
                      value={form.parentesco}
                      onChange={(e) => update('parentesco', e.target.value)}
                      placeholder="Ex: Mãe, Pai, Irmã(o), Amigo(a)..."
                      required
                    />
                  </div>
                  <div>
                    <Label>E-mail (opcional)</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="Opcional — caso queira consultar sua inscrição depois"
                    />
                  </div>
                </>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting || selectedBancas.length === 0}
              className="w-full"
            >
              {submitting
                ? 'Confirmando...'
                : `Confirmar Inscrição (${selectedBancas.length} banca${
                    selectedBancas.length === 1 ? '' : 's'
                  })`}
            </Button>
          </form>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}