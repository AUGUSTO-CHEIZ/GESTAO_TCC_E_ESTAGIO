import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listarAgendaPublica, criarInscricao } from '@/lib/api';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import ProfessorSelector from '@/components/ProfessorSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, GraduationCap, ArrowLeft } from 'lucide-react';

export default function InscricaoApresentador() {
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    nome: '', email: '', codigo_academico: '', curso: 'Psicologia',
    titulo_tcc: '', orientador_id: '', avaliador1_id: '', avaliador2_id: '', horario_id: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await listarAgendaPublica();
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

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.titulo_tcc || !form.horario_id || !form.orientador_id || !form.avaliador1_id || !form.avaliador2_id) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos obrigatórios, incluindo os três professores.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await criarInscricao({ tipo: 'apresentador', ...form });
      if (res.data?.error) {
        toast({ title: 'Erro', description: res.data.error, variant: 'destructive' });
      } else {
        setSuccess({ email: form.email });
      }
    } catch (e) {
      toast({ title: 'Erro', description: e.message || 'Erro ao realizar inscrição', variant: 'destructive' });
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
            <p className="text-slate-500 mb-6">Sua inscrição foi realizada com o e-mail:</p>
            <div className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl py-4 px-6 mb-6">
              <p className="text-lg font-medium text-indigo-700">{success.email}</p>
            </div>
            <p className="text-sm text-slate-400 mb-6">Use seu e-mail para consultar sua inscrição a qualquer momento.</p>
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Inscrição como Apresentador</h1>
              <p className="text-slate-500 text-sm">Preencha os dados para apresentar seu TCC</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => update('nome', e.target.value)} required /></div>
            <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></div>
            <div><Label>Código Acadêmico / Matrícula</Label><Input value={form.codigo_academico} onChange={(e) => update('codigo_academico', e.target.value)} placeholder="Ex: 2024123456" /></div>
            <div><Label>Curso</Label><Input value={form.curso} onChange={(e) => update('curso', e.target.value)} /></div>
            <div><Label>Título do TCC *</Label><Textarea value={form.titulo_tcc} onChange={(e) => update('titulo_tcc', e.target.value)} required rows={2} /></div>
            <div>
              <Label>Professor Orientador *</Label>
              <ProfessorSelector value={form.orientador_id} onChange={(id) => update('orientador_id', id)} excludeIds={[form.avaliador1_id, form.avaliador2_id].filter(Boolean)} />
            </div>
            <div>
              <Label>Professor Avaliador 1 *</Label>
              <ProfessorSelector value={form.avaliador1_id} onChange={(id) => update('avaliador1_id', id)} excludeIds={[form.orientador_id, form.avaliador2_id].filter(Boolean)} />
            </div>
            <div>
              <Label>Professor Avaliador 2 *</Label>
              <ProfessorSelector value={form.avaliador2_id} onChange={(id) => update('avaliador2_id', id)} excludeIds={[form.orientador_id, form.avaliador1_id].filter(Boolean)} />
            </div>
            <div>
              <Label>Horário *</Label>
              <select
                value={form.horario_id}
                onChange={(e) => update('horario_id', e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{loading ? 'Carregando...' : 'Selecione um horário'}</option>
                {horarios.map((h) => (
                  <option key={h.id} value={h.id} disabled={!h.disponivel}>
                    {h.descricao || h.data} • {h.hora_inicio} às {h.hora_fim}
                    {h.disponivel ? ` (${h.bancas_count} banca(s))` : ' (esgotado)'}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Enviando...' : 'Confirmar Inscrição'}
            </Button>
          </form>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
