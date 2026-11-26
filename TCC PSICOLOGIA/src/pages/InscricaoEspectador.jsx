import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listarAgendaPublica, criarInscricao } from '@/lib/api';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import StatusBadge from '@/components/public/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, Users, ArrowLeft } from 'lucide-react';

export default function InscricaoEspectador() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [selectedBanca, setSelectedBanca] = useState(searchParams.get('banca') || null);
  const [form, setForm] = useState({
    nome: '', email: '', cpf: '', codigo_academico: '', curso: 'Psicologia',
    semestre: '', parentesco: '', tipo: 'academico'
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

  const bancas = (data?.bancas || []).filter((b) => b.vagas_restantes > 0 && b.status !== "realizada" && b.status !== "cancelada");
  const bancaSelecionada = bancas.find((b) => b.id === selectedBanca);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome || !form.email || !selectedBanca) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    if (form.tipo === 'academico' && !form.codigo_academico) {
      toast({ title: 'Código do aluno obrigatório', description: 'Informe seu código acadêmico.', variant: 'destructive' });
      return;
    }
    if (form.tipo === 'academico' && !form.semestre) {
      toast({ title: 'Semestre obrigatório', description: 'Informe seu semestre/período.', variant: 'destructive' });
      return;
    }
    if (form.tipo === 'familiar' && !form.parentesco) {
      toast({ title: 'Parentesco obrigatório', description: 'Informe o grau de parentesco.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await criarInscricao({ tipo: form.tipo, banca_id: selectedBanca, ...form });
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

        {!selectedBanca ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Inscrição como Espectador</h1>
                <p className="text-slate-500 text-sm">Selecione a banca que deseja assistir</p>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : bancas.length === 0 ? (
              <p className="text-center text-slate-400 py-12">Nenhuma banca com vagas disponíveis no momento.</p>
            ) : (
              <div className="space-y-3">
                {bancas.map((banca) => (
                  <button
                    key={banca.id}
                    onClick={() => setSelectedBanca(banca.id)}
                    className="w-full text-left border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-slate-900">{banca.titulo_tcc}</h3>
                      <StatusBadge status={banca.status} />
                    </div>
                    <div className="text-sm text-slate-600 space-y-0.5">
                      {banca.apresentador_nome && <p>Apresentador: {banca.apresentador_nome}</p>}
                      {banca.orientador_nome && <p>Orientador: {banca.orientador_nome}</p>}
                      <p>{banca.horario_descricao || banca.horario_data}</p>
                      {banca.sala_nome && <p>Sala: {banca.sala_nome}</p>}
                      <p className="text-indigo-600 font-medium">{banca.vagas_restantes} vagas restantes</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <button onClick={() => setSelectedBanca(null)} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 mb-4 text-sm">
              <ArrowLeft className="w-4 h-4" /> Escolher outra banca
            </button>
            {bancaSelecionada && (
              <div className="bg-indigo-50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-slate-900">{bancaSelecionada.titulo_tcc}</h3>
                <p className="text-sm text-slate-600">{bancaSelecionada.horario_descricao || bancaSelecionada.horario_data}</p>
                {bancaSelecionada.sala_nome && <p className="text-sm text-slate-600">Sala: {bancaSelecionada.sala_nome}</p>}
              </div>
            )}
            <div className="mb-6">
              <Label className="mb-3 block">Tipo de Espectador *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => update('tipo', 'academico')}
                  className={`p-4 rounded-xl border-2 text-left transition ${form.tipo === 'academico' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="font-semibold text-slate-900">Acadêmico</p>
                  <p className="text-xs text-slate-500">Estudante - com certificado</p>
                </button>
                <button type="button" onClick={() => update('tipo', 'familiar')}
                  className={`p-4 rounded-xl border-2 text-left transition ${form.tipo === 'familiar' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="font-semibold text-slate-900">Familiar / Amigo</p>
                  <p className="text-xs text-slate-500">Sem certificado</p>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => update('nome', e.target.value)} required /></div>
              <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></div>
              {form.tipo === 'academico' && (
                <div><Label>Código do Aluno *</Label><Input value={form.codigo_academico} onChange={(e) => update('codigo_academico', e.target.value)} placeholder="Ex: 2024123456" required /></div>
              )}
              {form.tipo === 'academico' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>Curso</Label><Input value={form.curso} onChange={(e) => update('curso', e.target.value)} /></div>
                  <div><Label>Semestre/Período *</Label><Input value={form.semestre} onChange={(e) => update('semestre', e.target.value)} placeholder="Ex: 5º período" required /></div>
                </div>
              )}
              {form.tipo === 'familiar' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => update('cpf', e.target.value)} /></div>
                </div>
              )}
              {form.tipo === 'familiar' && (
                <div><Label>Grau de Parentesco *</Label><Input value={form.parentesco} onChange={(e) => update('parentesco', e.target.value)} placeholder="Ex: Pai, Mãe, Irmão..." required /></div>
              )}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Enviando...' : 'Confirmar Inscrição'}
              </Button>
            </form>
          </div>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}
