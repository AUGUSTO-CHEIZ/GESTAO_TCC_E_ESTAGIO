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
import { CheckCircle, Users, ArrowLeft, Calendar, Clock, MapPin, CheckSquare, Square } from 'lucide-react';

function formatarData(iso) {
  if (!iso) return '';
  return iso.includes('-') ? iso.split('-').reverse().join('/') : iso;
}

function chaveHorario(banca) {
  return banca.horario_id || `${banca.horario_data}_${banca.hora_inicio || banca.horario_descricao}`;
}

export default function InscricaoEspectador() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => {
    const idUrl = searchParams.get('banca');
    return idUrl ? [idUrl] : [];
  });
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

  const bancas = (data?.bancas || []).filter(
    (b) => b.vagas_restantes > 0 && b.status !== 'realizada' && b.status !== 'cancelada'
  );
  const bancasSelecionadas = bancas.filter((b) => selectedIds.includes(b.id));
  const horariosOcupados = new Set(bancasSelecionadas.map(chaveHorario));

  function toggleBanca(banca) {
    if (selectedIds.includes(banca.id)) {
      setSelectedIds((prev) => prev.filter((id) => id !== banca.id));
      return;
    }
    if (horariosOcupados.has(chaveHorario(banca))) {
      toast({
        title: 'Conflito de horário',
        description: 'Você já selecionou outra banca neste mesmo dia e horário.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedIds((prev) => [...prev, banca.id]);
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim() || selectedIds.length === 0) {
      toast({ title: 'Campos obrigatórios', description: 'Informe seu nome e selecione ao menos uma banca.', variant: 'destructive' });
      return;
    }
    if (form.tipo === 'academico') {
      if (!form.email.trim() || !form.codigo_academico.trim() || !form.semestre.trim()) {
        toast({ title: 'Dados acadêmicos obrigatórios', description: 'Preencha e-mail, código do aluno e semestre.', variant: 'destructive' });
        return;
      }
    } else if (!form.parentesco.trim()) {
      toast({ title: 'Parentesco obrigatório', description: 'Informe o grau de parentesco ou vínculo.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await criarInscricao({ ...form, banca_ids: selectedIds });
      if (res.data?.error) {
        toast({ title: 'Erro', description: res.data.error, variant: 'destructive' });
      } else {
        setSuccess({ email: form.email.trim(), total: selectedIds.length });
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
            <p className="text-slate-500 mb-4">
              Presença reservada em <strong>{success.total}</strong> apresentação(ões).
            </p>
            {success.email ? (
              <div className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl py-3 px-5 mb-6">
                <p className="text-xs text-slate-500 mb-1">E-mail registrado para consulta:</p>
                <p className="text-base font-medium text-indigo-700">{success.email}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3 mb-6">
                Seu nome já está na lista da portaria/chamada da banca.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {success.email && <Link to="/minha-inscricao"><Button className="w-full">Consultar Inscrição</Button></Link>}
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
      <div className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Inscrição como Espectador</h1>
              <p className="text-slate-500 text-sm">Selecione uma ou mais bancas em horários diferentes ({selectedIds.length} selecionada(s))</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : bancas.length === 0 ? (
            <p className="text-center text-slate-400 py-10">Nenhuma banca com vagas disponíveis no momento.</p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {bancas.map((banca) => {
                const selecionada = selectedIds.includes(banca.id);
                const conflito = !selecionada && horariosOcupados.has(chaveHorario(banca));
                const faixaHora = banca.hora_inicio && banca.hora_fim
                  ? `${banca.hora_inicio.slice(0, 5)} às ${banca.hora_fim.slice(0, 5)}`
                  : banca.horario_descricao;

                return (
                  <button
                    key={banca.id}
                    type="button"
                    onClick={() => toggleBanca(banca)}
                    className={`w-full text-left border-2 rounded-xl p-4 transition ${
                      selecionada
                        ? 'border-indigo-600 bg-indigo-50/60'
                        : conflito
                        ? 'border-slate-100 bg-slate-50 opacity-55 cursor-not-allowed'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5 text-indigo-600">
                        {selecionada ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1.5">
                          <h3 className="font-semibold text-slate-900">{banca.titulo_tcc}</h3>
                          <StatusBadge status={banca.status} />
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs font-medium text-indigo-700 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg mb-2">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatarData(banca.horario_data)}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {faixaHora}</span>
                          {banca.sala_nome && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {banca.sala_nome}</span>}
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap justify-between gap-2">
                          <span>Apresentador: <strong>{banca.apresentador_nome}</strong> {banca.orientador_nome ? `• Orient.: ${banca.orientador_nome}` : ''}</span>
                          <span className="text-indigo-600 font-semibold">
                            {conflito ? 'Mesmo horário já escolhido' : `${banca.vagas_restantes} vagas`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-5">
          <div>
            <Label className="mb-2 block font-semibold">Tipo de Espectador *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => update('tipo', 'academico')}
                className={`p-3.5 rounded-xl border-2 text-left transition ${form.tipo === 'academico' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}
              >
                <p className="font-semibold text-slate-900 text-sm">Acadêmico</p>
                <p className="text-xs text-slate-500">Estudante (com certificado)</p>
              </button>
              <button
                type="button"
                onClick={() => update('tipo', 'familiar')}
                className={`p-3.5 rounded-xl border-2 text-left transition ${form.tipo === 'familiar' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}
              >
                <p className="font-semibold text-slate-900 text-sm">Familiar / Amigo</p>
                <p className="text-xs text-slate-500">Convidado (e-mail opcional)</p>
              </button>
            </div>
          </div>

          <div>
            <Label>Nome completo *</Label>
            <Input value={form.nome} onChange={(e) => update('nome', e.target.value)} required />
          </div>

          <div>
            <Label>{form.tipo === 'academico' ? 'E-mail *' : 'E-mail (opcional)'}</Label>
            <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required={form.tipo === 'academico'} />
          </div>

          {form.tipo === 'academico' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Código do Aluno *</Label><Input value={form.codigo_academico} onChange={(e) => update('codigo_academico', e.target.value)} required /></div>
              <div><Label>Curso</Label><Input value={form.curso} onChange={(e) => update('curso', e.target.value)} /></div>
              <div><Label>Semestre/Período *</Label><Input value={form.semestre} onChange={(e) => update('semestre', e.target.value)} placeholder="Ex: 5º" required /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Grau de Parentesco / Vínculo *</Label><Input value={form.parentesco} onChange={(e) => update('parentesco', e.target.value)} placeholder="Ex: Mãe, Pai, Amigo..." required /></div>
              <div><Label>CPF (opcional)</Label><Input value={form.cpf} onChange={(e) => update('cpf', e.target.value)} /></div>
            </div>
          )}

          <Button type="submit" disabled={submitting || selectedIds.length === 0} className="w-full">
            {submitting ? 'Enviando...' : `Confirmar Inscrição (${selectedIds.length} banca(s))`}
          </Button>
        </form>
      </div>
      <PublicFooter />
    </div>
  );
}