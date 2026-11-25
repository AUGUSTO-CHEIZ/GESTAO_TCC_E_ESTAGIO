import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { listarAgendaPublica, criarInscricao } from '@/lib/api';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import ProfessorSelector from '@/components/ProfessorSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, GraduationCap, ArrowLeft, Search, Lock } from 'lucide-react';

export default function InscricaoApresentador() {
  const [horarios, setHorarios] = useState([]);
  const [loadingHorarios, setLoadingHorarios] = useState(true);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [alunoPre, setAlunoPre] = useState(null);
  const [desbloqueadoGeral, setDesbloqueadoGeral] = useState(false);

  const [form, setForm] = useState({
    codigo_academico: '',
    nome: '',
    orientador_id: '',
    email: '',
    horario_id: '',
    avaliador1_id: '',
    avaliador2_tipo: 'curso',
    avaliador2_id: '',
    avaliador2_externo_titulacao: '',
    avaliador2_externo_nome: '',
    avaliador2_externo_email: '',
    titulo_tcc: '',
  });

  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await listarAgendaPublica();
        const maxBancas = res.data?.evento?.max_bancas_por_horario || 2;
        const lista = (res.data?.horarios || []).map((h) => ({
          ...h,
          disponivel: h.bancas_count < maxBancas,
          vagas_restantes: Math.max(0, maxBancas - h.bancas_count),
        }));
        setHorarios(lista);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingHorarios(false);
      }
    }
    load();
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleBuscarCodigo() {
    const codigo = form.codigo_academico.trim();
    if (!codigo) {
      toast({ title: 'Informe o código', description: 'Digite seu código de aluno para buscar o pré-cadastro.', variant: 'destructive' });
      return;
    }
    setBuscandoCodigo(true);
    try {
      const { data: aluno, error } = await supabase
        .from('alunos_precadastro')
        .select('*')
        .ilike('codigo_aluno', codigo)
        .maybeSingle();

      if (error) throw error;

      if (!aluno) {
        setAlunoPre(null);
        setForm((f) => ({ ...f, nome: '', orientador_id: '' }));
        toast({ title: 'Não encontrado', description: 'Código não localizado no pré-cadastro. Verifique com a coordenação.', variant: 'destructive' });
        return;
      }

      let orientadorId = '';
      if (aluno.orientador_nome) {
        const { data: profs } = await supabase
          .from('professores')
          .select('id, nome')
          .ilike('nome', `%${aluno.orientador_nome.trim()}%`)
          .limit(1);
        if (profs && profs.length > 0) {
          orientadorId = profs[0].id;
        }
      }

      setAlunoPre(aluno);
      setForm((f) => ({
        ...f,
        codigo_academico: aluno.codigo_aluno,
        nome: aluno.nome_completo,
        orientador_id: orientadorId,
      }));
      toast({ title: 'Pré-cadastro localizado!', description: `Bem-vindo(a), ${aluno.nome_completo}.` });
    } catch (err) {
      toast({ title: 'Erro ao buscar código', description: err.message, variant: 'destructive' });
    } finally {
      setBuscandoCodigo(false);
    }
  }

  const etapa1Ok = Boolean(alunoPre && form.nome && form.orientador_id);
  const etapa2Ok = etapa1Ok && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const etapa3Ok = etapa2Ok && Boolean(form.horario_id);
  const avaliador2Ok =
    form.avaliador2_tipo === 'curso'
      ? Boolean(form.avaliador2_id)
      : Boolean(
          form.avaliador2_externo_titulacao.trim() &&
            form.avaliador2_externo_nome.trim() &&
            form.avaliador2_externo_email.trim()
        );
  const etapa4Ok = etapa3Ok && Boolean(form.avaliador1_id) && avaliador2Ok;
  const etapa5Ok = etapa4Ok && form.titulo_tcc.trim().length > 0;

  useEffect(() => {
    if (etapa5Ok && !desbloqueadoGeral) {
      setDesbloqueadoGeral(true);
    }
  }, [etapa5Ok, desbloqueadoGeral]);

  const liberarEtapa2 = desbloqueadoGeral || etapa1Ok;
  const liberarEtapa3 = desbloqueadoGeral || etapa2Ok;
  const liberarEtapa4 = desbloqueadoGeral || etapa3Ok;
  const liberarEtapa5 = desbloqueadoGeral || etapa4Ok;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!etapa5Ok) {
      toast({ title: 'Etapas incompletas', description: 'Preencha todas as etapas na ordem indicada.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await criarInscricao({ tipo: 'apresentador', ...form });
      if (res.data?.error) {
        toast({ title: 'Erro na inscrição', description: res.data.error, variant: 'destructive' });
      } else {
        setSuccess({ email: form.email });
      }
    } catch (err) {
      toast({ title: 'Erro', description: err.message || 'Erro ao realizar inscrição', variant: 'destructive' });
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
            <p className="text-slate-500 mb-6">Sua inscrição foi registrada com o e-mail:</p>
            <div className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl py-4 px-6 mb-6">
              <p className="text-lg font-medium text-indigo-700">{success.email}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/minha-inscricao"><Button className="w-full">Consultar Inscrição</Button></Link>
              <Link to="/"><Button variant="outline" className="w-full">Voltar ao Início</Button></Link>
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
        <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Inscrição como Apresentador</h1>
              <p className="text-slate-500 text-sm">
                {desbloqueadoGeral
                  ? 'Todos os campos preenchidos — você pode revisar ou alterar qualquer dado.'
                  : 'Preencha cada etapa na ordem para liberar a próxima.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <Label className="font-semibold text-slate-800">1. Código do Aluno *</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  autoComplete="off"
                  value={form.codigo_academico}
                  onChange={(e) => {
                    update('codigo_academico', e.target.value);
                    if (alunoPre) setAlunoPre(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBuscarCodigo();
                    }
                  }}
                  placeholder="Digite seu código acadêmico"
                />
                <Button type="button" onClick={handleBuscarCodigo} disabled={buscandoCodigo} className="gap-1.5">
                  <Search className="w-4 h-4" /> {buscandoCodigo ? 'Buscando...' : 'Buscar'}
                </Button>
              </div>

              {alunoPre && (
                <div className="bg-white p-3.5 rounded-lg border border-indigo-200 space-y-1.5 text-sm">
                  <p className="text-slate-700"><span className="font-semibold">Nome completo:</span> {alunoPre.nome_completo}</p>
                  <p className="text-slate-700"><span className="font-semibold">Orientador(a):</span> {alunoPre.orientador_nome}</p>
                  {!alunoPre.orientador_id && !form.orientador_id && (
                    <div className="pt-2">
                      <Label className="text-xs text-amber-700">Selecione seu orientador na lista cadastrada:</Label>
                      <ProfessorSelector value={form.orientador_id} onChange={(id) => update('orientador_id', id)} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <fieldset disabled={!liberarEtapa2} className={`p-4 rounded-xl border border-slate-200 space-y-2 transition ${!liberarEtapa2 ? 'opacity-50 bg-slate-50' : 'bg-white'}`}>
              <Label className="font-semibold text-slate-800 flex items-center gap-1.5">
                {!liberarEtapa2 && <Lock className="w-3.5 h-3.5 text-slate-400" />} 2. E-mail *
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="seu.email@exemplo.com"
              />
            </fieldset>

            <fieldset disabled={!liberarEtapa3} className={`p-4 rounded-xl border border-slate-200 space-y-2 transition ${!liberarEtapa3 ? 'opacity-50 bg-slate-50' : 'bg-white'}`}>
              <Label className="font-semibold text-slate-800 flex items-center gap-1.5">
                {!liberarEtapa3 && <Lock className="w-3.5 h-3.5 text-slate-400" />} 3. Data e Horário da Apresentação *
              </Label>
              <select
                value={form.horario_id}
                onChange={(e) => update('horario_id', e.target.value)}
                disabled={!liberarEtapa3 || loadingHorarios}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{loadingHorarios ? 'Carregando horários...' : 'Selecione a data e o horário'}</option>
                {horarios.map((h) => (
                  <option key={h.id} value={h.id} disabled={!h.disponivel}>
                    {h.data.split('-').reverse().join('/')} • {h.hora_inicio?.slice(0, 5)} às {h.hora_fim?.slice(0, 5)}
                    {h.disponivel ? ` (${h.vagas_restantes} vaga(s) disponível)` : ' (Lotado)'}
                  </option>
                ))}
              </select>
            </fieldset>

            <fieldset disabled={!liberarEtapa4} className={`p-4 rounded-xl border border-slate-200 space-y-4 transition ${!liberarEtapa4 ? 'opacity-50 bg-slate-50' : 'bg-white'}`}>
              <Label className="font-semibold text-slate-800 flex items-center gap-1.5">
                {!liberarEtapa4 && <Lock className="w-3.5 h-3.5 text-slate-400" />} 4. Banca Avaliadora *
              </Label>

              <div>
                <Label className="text-xs text-slate-600">Avaliador 1 (Professor do Curso) *</Label>
                <ProfessorSelector
                  value={form.avaliador1_id}
                  onChange={(id) => update('avaliador1_id', id)}
                  excludeIds={[form.orientador_id, form.avaliador2_id].filter(Boolean)}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs text-slate-600 block">Avaliador 2 *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => update('avaliador2_tipo', 'curso')}
                    className={`p-3 rounded-lg border-2 text-left text-sm font-medium transition ${
                      form.avaliador2_tipo === 'curso'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Avaliador/Professor do Curso
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      update('avaliador2_tipo', 'externo');
                      update('avaliador2_id', '');
                    }}
                    className={`p-3 rounded-lg border-2 text-left text-sm font-medium transition ${
                      form.avaliador2_tipo === 'externo'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Avaliador Externo
                  </button>
                </div>

                {form.avaliador2_tipo === 'curso' ? (
                  <ProfessorSelector
                    value={form.avaliador2_id}
                    onChange={(id) => update('avaliador2_id', id)}
                    excludeIds={[form.orientador_id, form.avaliador1_id].filter(Boolean)}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <Label className="text-xs">Titulação do avaliador *</Label>
                      <Input
                        value={form.avaliador2_externo_titulacao}
                        onChange={(e) => update('avaliador2_externo_titulacao', e.target.value)}
                        placeholder="Ex: Me. / Dr(a)."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nome completo do Avaliador *</Label>
                      <Input
                        value={form.avaliador2_externo_nome}
                        onChange={(e) => update('avaliador2_externo_nome', e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail do avaliador *</Label>
                      <Input
                        type="email"
                        value={form.avaliador2_externo_email}
                        onChange={(e) => update('avaliador2_externo_email', e.target.value)}
                        placeholder="email@instituicao.com"
                      />
                    </div>
                  </div>
                )}
              </div>
            </fieldset>

            <fieldset disabled={!liberarEtapa5} className={`p-4 rounded-xl border border-slate-200 space-y-2 transition ${!liberarEtapa5 ? 'opacity-50 bg-slate-50' : 'bg-white'}`}>
              <Label className="font-semibold text-slate-800 flex items-center gap-1.5">
                {!liberarEtapa5 && <Lock className="w-3.5 h-3.5 text-slate-400" />} 5. Título do TCC *
              </Label>
              <Textarea
                value={form.titulo_tcc}
                onChange={(e) => update('titulo_tcc', e.target.value)}
                rows={2}
                placeholder="Digite o título completo do seu trabalho"
              />
            </fieldset>

            <Button type="submit" disabled={submitting || !etapa5Ok} className="w-full">
              {submitting ? 'Enviando inscrição...' : 'Confirmar Inscrição'}
            </Button>
          </form>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}