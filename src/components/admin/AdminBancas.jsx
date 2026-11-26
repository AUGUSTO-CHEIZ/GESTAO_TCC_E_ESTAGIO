import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ProfessorSelector from '@/components/ProfessorSelector';
import StatusBadge from '@/components/public/StatusBadge';
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  UserPlus,
  QrCode,
  Download,
  X,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyForm = {
  titulo_tcc: '',
  apresentador_nome: '',
  horario_id: '',
  sala_id: '',
  orientador_id: '',
  avaliador1_id: '',
  avaliador2_tipo: 'curso',
  avaliador2_id: '',
  avaliador2_externo_titulacao: '',
  avaliador2_externo_nome: '',
  avaliador2_externo_email: '',
  status: 'pendente',
  vagas_espectadores: 30,
};

const emptyAlunoForm = {
  codigo_aluno: '',
  nome_completo: '',
  orientador_nome: '',
  titulacao: '',
};

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendentes de aprovação' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'realizada', label: 'Realizada e aprovada' },
  { value: 'cancelada', label: 'Cancelada' },
];

function normalizarChave(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function limparTexto(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
  return s;
}

function comTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tempo limite excedido ao carregar dados.')), ms)
    ),
  ]);
}

export default function AdminBancas() {
  const [bancas, setBancas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [totalPreCadastro, setTotalPreCadastro] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [importando, setImportando] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const [showAlunoModal, setShowAlunoModal] = useState(false);
  const [alunoForm, setAlunoForm] = useState(emptyAlunoForm);
  const [salvandoAluno, setSalvandoAluno] = useState(false);

  const [qrBanca, setQrBanca] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const load = useCallback(async (isMountedRef = { current: true }) => {
    setErroCarregamento('');
    setLoading(true);
    try {
      const [bRes, hRes, sRes, pRes, preRes] = await comTimeout(
        Promise.all([
          supabase.from('bancas').select('*').order('created_at', { ascending: false }),
          supabase.from('horarios').select('*').eq('ativo', true).order('data', { ascending: true }),
          supabase.from('salas').select('*').eq('ativa', true).order('nome', { ascending: true }),
          supabase
            .from('professores')
            .select('id, nome, user_id')
            .eq('ativo', true)
            .order('nome', { ascending: true }),
          supabase.from('alunos_precadastro').select('id', { count: 'exact', head: true }),
        ])
      );

      if (!isMountedRef.current) return;

      const primeiraFalha = [bRes, hRes, sRes, pRes, preRes].find((r) => r?.error)?.error;
      if (primeiraFalha) {
        throw new Error(primeiraFalha.message || 'Falha ao consultar o banco de dados.');
      }

      setBancas(bRes.data || []);
      setHorarios(hRes.data || []);
      setSalas(sRes.data || []);
      setProfessores(pRes.data || []);
      setTotalPreCadastro(preRes.count || 0);
    } catch (e) {
      if (!isMountedRef.current) return;
      console.error(e);
      setErroCarregamento(e.message || 'Não foi possível carregar as bancas.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const isMountedRef = { current: true };
    load(isMountedRef);
    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAprovarBanca(banca) {
    try {
      const { error } = await supabase
        .from('bancas')
        .update({ status: 'agendada' })
        .eq('id', banca.id);

      if (error) throw error;

      toast({
        title: 'Banca Agendada / Aprovada!',
        description: 'Esta banca já está liberada para inscrição de espectadores na tela inicial.',
      });
      load();
    } catch (err) {
      toast({
        title: 'Erro ao aprovar TCC',
        description: err.message,
        variant: 'destructive',
      });
    }
  }

  async function handleSalvarAlunoAvulso(e) {
    e.preventDefault();
    const codigo = alunoForm.codigo_aluno.trim();
    const nome = alunoForm.nome_completo.trim();
    const orientador = alunoForm.orientador_nome.trim();
    const titulacao = alunoForm.titulacao.trim();

    if (!codigo || !nome || !orientador) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha código do aluno, nome completo e orientador.',
        variant: 'destructive',
      });
      return;
    }

    setSalvandoAluno(true);
    try {
      const { error } = await supabase.from('alunos_precadastro').upsert(
        {
          codigo_aluno: codigo,
          nome_completo: nome,
          orientador_nome: orientador,
          titulacao,
        },
        { onConflict: 'codigo_aluno' }
      );

      if (error) throw error;

      toast({
        title: 'Aluno adicionado!',
        description: `${nome} (${codigo}) salvo no pré-cadastro sem alterar os registros existentes.`,
      });
      setAlunoForm(emptyAlunoForm);
      setShowAlunoModal(false);
      load();
    } catch (err) {
      toast({
        title: 'Erro ao adicionar aluno',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSalvandoAluno(false);
    }
  }

  async function handleImportarExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const primeiraAba = wb.Sheets[wb.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json(primeiraAba, { defval: '' });

      const registros = linhas
        .map((row) => {
          const norm = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [normalizarChave(k), limparTexto(v)])
          );

          const codigoAluno =
            norm['codigo do aluno'] ||
            norm['codigo_aluno'] ||
            norm['cd_pessoa'] ||
            norm['cd pessoa'] ||
            norm['codigo'] ||
            norm['matricula'] ||
            '';

          const nomeCompleto =
            norm['nome completo'] ||
            norm['nome_completo'] ||
            norm['nm_pessoa'] ||
            norm['nm pessoa'] ||
            norm['nome'] ||
            norm['aluno'] ||
            '';

          const orientadorNome =
            norm['orientador(a)'] ||
            norm['orientador'] ||
            norm['orientador_nome'] ||
            norm['professor orientador'] ||
            '';

          const titulacao =
            norm['titulacao'] ||
            norm['titulacao do avaliador'] ||
            norm['titulo'] ||
            '';

          return {
            codigo_aluno: codigoAluno,
            nome_completo: nomeCompleto,
            orientador_nome: orientadorNome,
            titulacao,
          };
        })
        .filter((r) => r.codigo_aluno && r.nome_completo && r.orientador_nome);

      if (registros.length === 0) {
        throw new Error(
          'Nenhuma linha válida encontrada. Verifique as colunas de código, nome completo e orientador.'
        );
      }

      const unicosPorCodigo = Array.from(
        new Map(registros.map((item) => [item.codigo_aluno.toLowerCase(), item])).values()
      );

      const { error } = await supabase
        .from('alunos_precadastro')
        .upsert(unicosPorCodigo, { onConflict: 'codigo_aluno' });

      if (error) throw error;

      toast({
        title: 'Planilha importada!',
        description: `${unicosPorCodigo.length} aluno(s) sincronizado(s) sem apagar os anteriores.`,
      });
      load();
    } catch (err) {
      toast({
        title: 'Erro ao importar Excel',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setImportando(false);
      e.target.value = '';
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const horarioObj = horarios.find((h) => h.id === form.horario_id);
      const salaObj = salas.find((s) => s.id === form.sala_id);
      const orientadorObj = professores.find((p) => p.id === form.orientador_id);
      const avaliador1Obj = professores.find((p) => p.id === form.avaliador1_id);
      const avaliador2CursoObj = professores.find((p) => p.id === form.avaliador2_id);

      const isExterno = form.avaliador2_tipo === 'externo';
      if (
        isExterno &&
        (!form.avaliador2_externo_titulacao.trim() ||
          !form.avaliador2_externo_nome.trim() ||
          !form.avaliador2_externo_email.trim())
      ) {
        throw new Error('Preencha titulação, nome completo e e-mail do avaliador externo.');
      }

      const avaliador2Nome = isExterno
        ? `${form.avaliador2_externo_titulacao.trim()} ${form.avaliador2_externo_nome.trim()}`.trim()
        : avaliador2CursoObj?.nome || '';

      const payload = {
        titulo_tcc: form.titulo_tcc.trim(),
        apresentador_nome: form.apresentador_nome.trim(),
        horario_id: form.horario_id || null,
        sala_id: form.sala_id || null,
        orientador_id: form.orientador_id || null,
        orientador_nome: orientadorObj?.nome || '',
        orientador_user_id: orientadorObj?.user_id || null,
        avaliador1_id: form.avaliador1_id || null,
        avaliador1_nome: avaliador1Obj?.nome || '',
        avaliador2_tipo: isExterno ? 'externo' : 'curso',
        avaliador2_id: isExterno ? null : form.avaliador2_id || null,
        avaliador2_nome: avaliador2Nome,
        avaliador2_externo_titulacao: isExterno ? form.avaliador2_externo_titulacao.trim() : null,
        avaliador2_externo_nome: isExterno ? form.avaliador2_externo_nome.trim() : null,
        avaliador2_externo_email: isExterno ? form.avaliador2_externo_email.trim() : null,
        status: form.status,
        vagas_espectadores: parseInt(form.vagas_espectadores, 10) || 30,
        horario_descricao: horarioObj
          ? horarioObj.descricao ||
            `${horarioObj.data} • ${horarioObj.hora_inicio?.slice(0, 5)} às ${horarioObj.hora_fim?.slice(0, 5)}`
          : '',
        horario_data: horarioObj ? horarioObj.data : '',
        sala_nome: salaObj ? salaObj.nome : '',
      };

      const { error } = editId
        ? await supabase.from('bancas').update(payload).eq('id', editId)
        : await supabase.from('bancas').insert(payload);

      if (error) throw error;

      toast({ title: editId ? 'Banca atualizada' : 'Banca criada' });
      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remover banca?')) return;
    try {
      const { error } = await supabase.from('bancas').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Banca removida' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  function baixarQrCode() {
    const canvas = document.getElementById('qr-banca-canvas');
    if (!canvas || !qrBanca) return;
    const link = document.createElement('a');
    link.download = `qrcode-${(qrBanca.apresentador_nome || qrBanca.id).replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const qrUrl = qrBanca ? `${window.location.origin}/inscricao/espectador?banca=${qrBanca.id}` : '';

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bancas</h1>
          <p className="text-xs text-slate-500">
            {totalPreCadastro} aluno(s) no pré-cadastro • Aprove os TCCs para liberá-los aos
            espectadores
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportarExcel}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAlunoForm(emptyAlunoForm);
              setShowAlunoModal(true);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Adicionar Aluno
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={importando}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importando ? 'Importando...' : 'Importar Alunos (Excel)'}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setEditId(null);
              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Banca
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">
            {editId ? 'Editar Banca' : 'Nova Banca'}
          </h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Título do TCC *</Label>
              <Textarea
                value={form.titulo_tcc}
                onChange={(e) => update('titulo_tcc', e.target.value)}
                required
                rows={2}
              />
            </div>

            <div>
              <Label>Nome do Apresentador</Label>
              <Input
                value={form.apresentador_nome}
                onChange={(e) => update('apresentador_nome', e.target.value)}
              />
            </div>

            <div>
              <Label>Horário</Label>
              <select
                value={form.horario_id}
                onChange={(e) => update('horario_id', e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecionar...</option>
                {horarios.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.descricao ||
                      `${h.data} • ${h.hora_inicio?.slice(0, 5)} às ${h.hora_fim?.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Sala</Label>
              <select
                value={form.sala_id}
                onChange={(e) => update('sala_id', e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecionar...</option>
                {salas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Orientador</Label>
              <ProfessorSelector
                value={form.orientador_id}
                onChange={(id) => update('orientador_id', id)}
                excludeIds={[form.avaliador1_id, form.avaliador2_id].filter(Boolean)}
              />
            </div>

            <div>
              <Label>Avaliador 1 (Professor do Curso) *</Label>
              <ProfessorSelector
                value={form.avaliador1_id}
                onChange={(id) => update('avaliador1_id', id)}
                excludeIds={[form.orientador_id, form.avaliador2_id].filter(Boolean)}
              />
            </div>

            <div>
              <Label>Tipo do Avaliador 2</Label>
              <select
                value={form.avaliador2_tipo}
                onChange={(e) => update('avaliador2_tipo', e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="curso">Avaliador / Professor do Curso</option>
                <option value="externo">Avaliador Externo</option>
              </select>
            </div>

            {form.avaliador2_tipo === 'curso' ? (
              <div>
                <Label>Avaliador 2 (Professor do Curso)</Label>
                <ProfessorSelector
                  value={form.avaliador2_id}
                  onChange={(id) => update('avaliador2_id', id)}
                  excludeIds={[form.orientador_id, form.avaliador1_id].filter(Boolean)}
                />
              </div>
            ) : (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <Label>Titulação do Avaliador *</Label>
                  <Input
                    value={form.avaliador2_externo_titulacao}
                    onChange={(e) => update('avaliador2_externo_titulacao', e.target.value)}
                    placeholder="Ex: Dr., Dra., Me., Ma."
                  />
                </div>
                <div>
                  <Label>Nome completo do Avaliador *</Label>
                  <Input
                    value={form.avaliador2_externo_nome}
                    onChange={(e) => update('avaliador2_externo_nome', e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label>E-mail do Avaliador *</Label>
                  <Input
                    type="email"
                    value={form.avaliador2_externo_email}
                    onChange={(e) => update('avaliador2_externo_email', e.target.value)}
                    placeholder="avaliador@exemplo.com"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Vagas Espectadores</Label>
              <Input
                type="number"
                value={form.vagas_espectadores}
                onChange={(e) => update('vagas_espectadores', parseInt(e.target.value, 10) || 0)}
                min={0}
              />
            </div>

            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : erroCarregamento ? (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center space-y-3">
          <p className="text-sm font-medium text-red-700">{erroCarregamento}</p>
          <Button type="button" variant="outline" onClick={() => load()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bancas.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap justify-between items-start gap-4"
            >
              <div className="flex-1 min-w-[240px]">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900">{b.titulo_tcc}</h3>
                  {b.status === 'aprovada' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprovada
                    </span>
                  ) : (
                    <StatusBadge status={b.status} />
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {b.apresentador_nome} {b.sala_nome ? `• ${b.sala_nome}` : ''}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {b.horario_descricao}
                  {b.orientador_nome ? ` • Orientador: ${b.orientador_nome}` : ''}
                  {b.avaliador2_nome ? ` • Avaliador 2: ${b.avaliador2_nome}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {b.status === 'pendente' && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAprovarBanca(b)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 mr-1"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Aprovar TCC
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => setQrBanca(b)}
                  title="Gerar QR Code"
                  className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                >
                  <QrCode className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      titulo_tcc: b.titulo_tcc,
                      apresentador_nome: b.apresentador_nome || '',
                      horario_id: b.horario_id || '',
                      sala_id: b.sala_id || '',
                      orientador_id: b.orientador_id || '',
                      avaliador1_id: b.avaliador1_id || '',
                      avaliador2_tipo: b.avaliador2_tipo || 'curso',
                      avaliador2_id: b.avaliador2_id || '',
                      avaliador2_externo_titulacao: b.avaliador2_externo_titulacao || '',
                      avaliador2_externo_nome: b.avaliador2_externo_nome || '',
                      avaliador2_externo_email: b.avaliador2_externo_email || '',
                      status: b.status,
                      vagas_espectadores: b.vagas_espectadores || 30,
                    });
                    setEditId(b.id);
                    setShowForm(true);
                  }}
                  className="p-2 text-slate-400 hover:text-indigo-600"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(b.id)}
                  className="p-2 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Adicionar Aluno Avulso ao Pré-cadastro */}
      {showAlunoModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAlunoModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Adicionar Aluno ao Pré-cadastro</h3>
              <button
                type="button"
                onClick={() => setShowAlunoModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Adiciona este aluno sem substituir ou apagar os alunos já importados via Excel.
            </p>
            <form onSubmit={handleSalvarAlunoAvulso} className="space-y-3">
              <div>
                <Label>Código do Aluno *</Label>
                <Input
                  value={alunoForm.codigo_aluno}
                  onChange={(e) =>
                    setAlunoForm((f) => ({ ...f, codigo_aluno: e.target.value }))
                  }
                  placeholder="Ex: 123456"
                  required
                />
              </div>
              <div>
                <Label>Nome Completo *</Label>
                <Input
                  value={alunoForm.nome_completo}
                  onChange={(e) =>
                    setAlunoForm((f) => ({ ...f, nome_completo: e.target.value }))
                  }
                  placeholder="Nome completo do aluno"
                  required
                />
              </div>
              <div>
                <Label>Professor(a) Orientador(a) *</Label>
                <select
                  value={alunoForm.orientador_nome}
                  onChange={(e) =>
                    setAlunoForm((f) => ({ ...f, orientador_nome: e.target.value }))
                  }
                  required
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione o orientador...</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.nome}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Titulação (opcional)</Label>
                <Input
                  value={alunoForm.titulacao}
                  onChange={(e) =>
                    setAlunoForm((f) => ({ ...f, titulacao: e.target.value }))
                  }
                  placeholder="Ex: Mestrado, Doutorado..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAlunoModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvandoAluno}>
                  {salvandoAluno ? 'Salvando...' : 'Salvar Aluno'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: QR Code da Banca */}
      {qrBanca && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setQrBanca(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900">QR Code da Banca</h3>
              <button
                type="button"
                onClick={() => setQrBanca(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm font-medium text-slate-700">
              {qrBanca.apresentador_nome || qrBanca.titulo_tcc}
            </p>
            <div className="flex justify-center p-4 bg-slate-50 rounded-xl border">
              <QRCodeCanvas id="qr-banca-canvas" value={qrUrl} size={210} includeMargin />
            </div>
            <p className="text-[11px] text-slate-400 break-all">{qrUrl}</p>
            <Button type="button" onClick={baixarQrCode} className="w-full gap-2">
              <Download className="w-4 h-4" /> Baixar QR Code (PNG)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}