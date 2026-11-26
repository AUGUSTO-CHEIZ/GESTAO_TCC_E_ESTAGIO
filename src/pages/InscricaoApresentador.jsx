import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listarAgendaPublica, buscarAlunoPorCodigo, criarInscricao } from '@/lib/api';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import ProfessorSelector from '@/components/ProfessorSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckCircle,
  GraduationCap,
  ArrowLeft,
  Search,
  Lock,
  CalendarClock,
  Users,
} from 'lucide-react';

export default function InscricaoApresentador() {
  const [horarios, setHorarios] = useState([]);
  const [eventoInfo, setEventoInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buscandoAluno, setBuscandoAluno] = useState(false);
  const [alunoEncontrado, setAlunoEncontrado] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [edicaoLivre, setEdicaoLivre] = useState(false);

  const [form, setForm] = useState({
    codigo_academico: '',
    nome: '',
    orientador_nome: '',
    orientador_id: '',
    email: '',
    data_selecionada: '',
    horario_id: '',
    avaliador1_id: '',
    avaliador2_do_curso: true,
    avaliador2_id: '',
    avaliador2_externo_nome: '',
    avaliador2_externo_email: '',
    avaliador2_externo_titulacao: '',
    titulo_tcc: '',
  });

  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await listarAgendaPublica();
        setEventoInfo(res.data?.evento || null);
        const maxBancas = res.data?.evento?.max_bancas_por_horario || 2;
        const available = (res.data?.horarios || []).map((h) => ({
          ...h,
          disponivel: h.bancas_count < maxBancas,
        }));
        setHorarios(available);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleBuscarCodigo() {
    if (!form.codigo_academico.trim()) {
      toast({
        title: 'Informe o código',
        description: 'Digite seu código acadêmico para localizar seu pré-cadastro.',
        variant: 'destructive',
      });
      return;
    }

    setBuscandoAluno(true);
    try {
      const res = await buscarAlunoPorCodigo(form.codigo_academico);
      if (res.data?.error) {
        setAlunoEncontrado(null);
        setForm((f) => ({ ...f, nome: '', orientador_nome: '', orientador_id: '' }));
        toast({
          title: 'Código não encontrado',
          description: res.data.error,
          variant: 'destructive',
        });
        return;
      }

      const aluno = res.data.aluno;
      setAlunoEncontrado(aluno);
      setForm((f) => ({
        ...f,
        codigo_academico: aluno.codigo_aluno,
        nome: aluno.nome_completo,
        orientador_nome: aluno.orientador_nome,
        orientador_id: aluno.orientador_id || '',
      }));
      toast({
        title: 'Pré-cadastro localizado!',
        description: `${aluno.nome_completo} — Orientador(a): ${aluno.orientador_nome}`,
      });
    } catch (e) {
      toast({ title: 'Erro na busca', description: e.message, variant: 'destructive' });
    } finally {
      setBuscandoAluno(false);
    }
  }

  const datasUnicas = Array.from(new Set(horarios.map((h) => h.data))).filter(Boolean);
  const horariosDaData = form.data_selecionada
    ? horarios.filter((h) => h.data === form.data_selecionada)
    : [];

  // Etapas sequenciais separadas (1: Código, 2: E-mail, 3: Dia, 4: Horário, 5: Avaliadores, 6: Título)
  const etapa1Ok = Boolean(alunoEncontrado && form.nome && form.orientador_id);
  const etapa2Ok = etapa1Ok && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const etapa3Ok = etapa2Ok && Boolean(form.data_selecionada);
  const etapa4Ok = etapa3Ok && Boolean(form.horario_id);

  const avaliador2Ok = form.avaliador2_do_curso
    ? Boolean(form.avaliador2_id)
    : Boolean(
        form.avaliador2_externo_nome.trim() &&
          form.avaliador2_externo_email.trim() &&
          form.avaliador2_externo_titulacao.trim()
      );
  const etapa5Ok = etapa4Ok && Boolean(form.avaliador1_id) && avaliador2Ok;
  const etapa6Ok = etapa5Ok && form.titulo_tcc.trim().length >= 5;

  useEffect(() => {
    if (etapa6Ok && !edicaoLivre) {
      setEdicaoLivre(true);
    }
  }, [etapa6Ok, edicaoLivre]);

  const podeEditarEtapa2 = edicaoLivre || etapa1Ok;
  const podeEditarEtapa3 = edicaoLivre || etapa2Ok;
  const podeEditarEtapa4 = edicaoLivre || etapa3Ok;
  const podeEditarEtapa5 = edicaoLivre || etapa4Ok;
  const podeEditarEtapa6 = edicaoLivre || etapa5Ok;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!etapa6Ok) {
      toast({
        title: 'Preencha todas as etapas',
        description: 'Complete os dados na ordem solicitada antes de confirmar.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await criarInscricao({
        tipo: 'apresentador',
        codigo_academico: form.codigo_academico.trim(),
        nome: form.nome.trim(),
        email: form.email.trim(),
        horario_id: form.horario_id,
        orientador_id: form.orientador_id,
        avaliador1_id: form.avaliador1_id,
        avaliador2_tipo: form.avaliador2_do_curso ? 'curso' : 'externo',
        avaliador2_id: form.avaliador2_do_curso ? form.avaliador2_id : null,
        avaliador2_externo_nome: form.avaliador2_do_curso ? '' : form.avaliador2_externo_nome.trim(),
        avaliador2_externo_email: form.avaliador2_do_curso ? '' : form.avaliador2_externo_email.trim(),
        avaliador2_externo_titulacao: form.avaliador2_do_curso
          ? ''
          : form.avaliador2_externo_titulacao.trim(),
        titulo_tcc: form.titulo_tcc.trim(),
      });

      if (res.data?.error) {
        toast({ title: 'Erro', description: res.data.error, variant: 'destructive' });
      } else {
        setSuccess({ email: form.email.trim() });
      }
    } catch (e) {
      toast({
        title: 'Erro',
        description: e.message || 'Erro ao realizar inscrição',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && eventoInfo && eventoInfo.apresentador_inscricoes_abertas === false) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <CalendarClock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Prazo de Apresentadores Encerrado
            </h2>
            <p className="text-sm text-slate-600">
              {eventoInfo.apresentador_motivo_bloqueio ||
                'O período para escolha de horários de apresentação está fechado no momento.'}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/inscricao/espectador">
                <Button className="w-full gap-2">
                  <Users className="w-4 h-4" /> Inscrever-se como Espectador
                </Button>
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

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Apresentação Enviada!</h2>
            <p className="text-slate-500 mb-4 text-sm">
              Sua apresentação foi registrada e aguarda aprovação do administrador para liberar as
              vagas de espectadores. E-mail cadastrado:
            </p>
            <div className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl py-4 px-6 mb-6">
              <p className="text-lg font-medium text-indigo-700">{success.email}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/minha-inscricao">
                <Button className="w-full">Consultar Minha Inscrição</Button>
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <div className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Inscrição como Apresentador</h1>
              <p className="text-slate-500 text-sm">
                Preencha as etapas na ordem indicada. Após concluir, você poderá alterar qualquer
                campo.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
            {/* ETAPA 1: CÓDIGO DO ALUNO */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <Label className="font-semibold text-slate-900">1. Código do Aluno *</Label>
              <div className="flex gap-2">
                <Input
                  name="codigo_aluno_busca"
                  autoComplete="off"
                  value={form.codigo_academico}
                  onChange={(e) => {
                    update('codigo_academico', e.target.value);
                    if (!edicaoLivre && alunoEncontrado) {
                      setAlunoEncontrado(null);
                      setForm((f) => ({
                        ...f,
                        codigo_academico: e.target.value,
                        nome: '',
                        orientador_nome: '',
                        orientador_id: '',
                      }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBuscarCodigo();
                    }
                  }}
                  placeholder="Digite seu código acadêmico"
                />
                <Button
                  type="button"
                  onClick={handleBuscarCodigo}
                  disabled={buscandoAluno}
                  className="shrink-0"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {buscandoAluno ? 'Buscando...' : 'Buscar'}
                </Button>
              </div>

              {alunoEncontrado && (
                <div className="bg-white rounded-lg border border-indigo-200 p-3 space-y-2 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Nome completo</span>
                    <span className="font-semibold text-slate-900">{form.nome}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">
                      Orientador(a) pré-cadastrado(a)
                    </span>
                    <span className="font-medium text-indigo-700">{form.orientador_nome}</span>
                  </div>
                  {!form.orientador_id && (
                    <div className="pt-1">
                      <Label className="text-xs text-amber-700">
                        Confirme seu orientador na lista de professores do curso *
                      </Label>
                      <ProfessorSelector
                        value={form.orientador_id}
                        onChange={(id) => update('orientador_id', id)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ETAPA 2: E-MAIL */}
            <div
              className={`p-4 rounded-xl border space-y-2 transition ${
                podeEditarEtapa2
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-100 bg-slate-50 opacity-60 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-slate-900">2. E-mail *</Label>
                {!podeEditarEtapa2 && <Lock className="w-4 h-4 text-slate-400" />}
              </div>
              <Input
                type="email"
                value={form.email}
                disabled={!podeEditarEtapa2}
                onChange={(e) => update('email', e.target.value)}
                placeholder="seu.email@exemplo.com"
              />
            </div>

            {/* ETAPA 3: DIA DA APRESENTAÇÃO (SEPARADO) */}
            <div
              className={`p-4 rounded-xl border space-y-2 transition ${
                podeEditarEtapa3
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-100 bg-slate-50 opacity-60 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-slate-900">3. Dia da Apresentação *</Label>
                {!podeEditarEtapa3 && <Lock className="w-4 h-4 text-slate-400" />}
              </div>
              <select
                value={form.data_selecionada}
                disabled={!podeEditarEtapa3 || loading}
                onChange={(e) => {
                  update('data_selecionada', e.target.value);
                  update('horario_id', '');
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{loading ? 'Carregando datas...' : 'Selecione o dia...'}</option>
                {datasUnicas.map((d) => (
                  <option key={d} value={d}>
                    {d.split('-').reverse().join('/')}
                  </option>
                ))}
              </select>
            </div>

            {/* ETAPA 4: HORÁRIO DA APRESENTAÇÃO (SEPARADO) */}
            <div
              className={`p-4 rounded-xl border space-y-2 transition ${
                podeEditarEtapa4
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-100 bg-slate-50 opacity-60 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-slate-900">
                  4. Horário (2 vagas por faixa) *
                </Label>
                {!podeEditarEtapa4 && <Lock className="w-4 h-4 text-slate-400" />}
              </div>
              <select
                value={form.horario_id}
                disabled={!podeEditarEtapa4 || !form.data_selecionada}
                onChange={(e) => update('horario_id', e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione o horário...</option>
                {horariosDaData.map((h) => (
                  <option key={h.id} value={h.id} disabled={!h.disponivel}>
                    {h.hora_inicio?.slice(0, 5)} às {h.hora_fim?.slice(0, 5)} —{' '}
                    {h.disponivel
                      ? `Disponível (${h.vagas_apresentacao} vaga${h.vagas_apresentacao > 1 ? 's' : ''})`
                      : 'Indisponível (Lotado)'}
                  </option>
                ))}
              </select>
            </div>

            {/* ETAPA 5: BANCA AVALIADORA */}
            <div
              className={`p-4 rounded-xl border space-y-4 transition ${
                podeEditarEtapa5
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-100 bg-slate-50 opacity-60 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-slate-900">5. Banca Avaliadora *</Label>
                {!podeEditarEtapa5 && <Lock className="w-4 h-4 text-slate-400" />}
              </div>

              <div>
                <Label className="text-sm">Avaliador 1 (Professor do Curso) *</Label>
                <ProfessorSelector
                  value={form.avaliador1_id}
                  onChange={(id) => update('avaliador1_id', id)}
                  excludeIds={[form.orientador_id, form.avaliador2_id].filter(Boolean)}
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.avaliador2_do_curso}
                    disabled={!podeEditarEtapa5}
                    onChange={(e) => {
                      const marcado = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        avaliador2_do_curso: marcado,
                        avaliador2_id: marcado ? f.avaliador2_id : '',
                        avaliador2_externo_nome: marcado ? '' : f.avaliador2_externo_nome,
                        avaliador2_externo_email: marcado ? '' : f.avaliador2_externo_email,
                        avaliador2_externo_titulacao: marcado ? '' : f.avaliador2_externo_titulacao,
                      }));
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    O Avaliador 2 é professor do curso
                  </span>
                </label>

                {form.avaliador2_do_curso ? (
                  <div>
                    <Label className="text-sm">Avaliador 2 (Professor do Curso) *</Label>
                    <ProfessorSelector
                      value={form.avaliador2_id}
                      onChange={(id) => update('avaliador2_id', id)}
                      excludeIds={[form.orientador_id, form.avaliador1_id].filter(Boolean)}
                    />
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-medium text-slate-600">
                      Dados do Avaliador 2 Externo *
                    </p>
                    <div>
                      <Label className="text-xs">1. Nome completo do professor *</Label>
                      <Input
                        value={form.avaliador2_externo_nome}
                        disabled={!podeEditarEtapa5}
                        onChange={(e) => update('avaliador2_externo_nome', e.target.value)}
                        placeholder="Nome completo do avaliador"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">2. E-mail do professor *</Label>
                      <Input
                        type="email"
                        value={form.avaliador2_externo_email}
                        disabled={!podeEditarEtapa5}
                        onChange={(e) => update('avaliador2_externo_email', e.target.value)}
                        placeholder="email.avaliador@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">3. Titulação (Mestrado, Doutorado, etc.) *</Label>
                      <Input
                        value={form.avaliador2_externo_titulacao}
                        disabled={!podeEditarEtapa5}
                        onChange={(e) => update('avaliador2_externo_titulacao', e.target.value)}
                        placeholder="Ex: Mestrado, Doutorado, Especialização..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ETAPA 6: TÍTULO DO TCC */}
            <div
              className={`p-4 rounded-xl border space-y-2 transition ${
                podeEditarEtapa6
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-100 bg-slate-50 opacity-60 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-slate-900">6. Título do TCC *</Label>
                {!podeEditarEtapa6 && <Lock className="w-4 h-4 text-slate-400" />}
              </div>
              <Textarea
                value={form.titulo_tcc}
                disabled={!podeEditarEtapa6}
                onChange={(e) => update('titulo_tcc', e.target.value)}
                rows={3}
                placeholder="Digite o título completo do seu Trabalho de Conclusão de Curso"
              />
            </div>

            <Button type="submit" disabled={submitting || !etapa6Ok} className="w-full">
              {submitting ? 'Confirmando...' : 'Confirmar Inscrição'}
            </Button>
          </form>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}