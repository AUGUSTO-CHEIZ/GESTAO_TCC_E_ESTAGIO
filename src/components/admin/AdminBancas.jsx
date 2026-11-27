import { useState, useEffect, useRef } from 'react';
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
  Mail,
  Search,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const VAGAS_PADRAO = 55;

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
  vagas_espectadores: VAGAS_PADRAO,
};

const emptyAlunoForm = {
  codigo_aluno: '',
  nome_completo: '',
  orientador_nome: '',
  titulacao: '',
};

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

export default function AdminBancas() {
  const [bancas, setBancas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [totalPreCadastro, setTotalPreCadastro] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [aprovandoId, setAprovandoId] = useState(null);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const [showAlunoModal, setShowAlunoModal] = useState(false);
  const [alunoForm, setAlunoForm] = useState(emptyAlunoForm);
  const [salvandoAluno, setSalvandoAluno] = useState(false);

  const [qrBanca, setQrBanca] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  async function load() {
    try {
      const [bRes, hRes, sRes, pRes, preRes] = await Promise.all([
        supabase.from('bancas').select('*').order('created_at', { ascending: false }),
        supabase.from('horarios').select('*').eq('ativo', true).order('data', { ascending: true }),
        supabase.from('salas').select('*').eq('ativa', true).order('nome', { ascending: true }),
        supabase
          .from('professores')
          .select('id, nome, user_id')
          .eq('ativo', true)
          .order('nome', { ascending: true }),
        supabase.from('alunos_precadastro').select('id', { count: 'exact', head: true }),
      ]);
      setBancas(bRes.data || []);
      setHorarios(hRes.data || []);
      setSalas(sRes.data || []);
      setProfessores(pRes.data || []);
      setTotalPreCadastro(preRes.count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSalaChange(novaSalaId) {
    const salaSelecionada = salas.find((s) => s.id === novaSalaId);
    const capacidadeSala =
      salaSelecionada && Number(salaSelecionada.capacidade) > 0
        ? Number(salaSelecionada.capacidade)
        : VAGAS_PADRAO;

    setForm((f) => ({
      ...f,
      sala_id: novaSalaId,
      vagas_espectadores: capacidadeSala,
    }));
  }

  async function enviarEmailConfirmacaoApresentador(banca, inscricaoApresentador) {
    const destinatario =
      limparTexto(inscricaoApresentador?.email) || limparTexto(banca?.apresentador_email);

    if (!destinatario) {
      return { enviado: false, motivo: 'Apresentador sem e-mail cadastrado na inscrição.' };
    }

    const nomeApresentador =
      limparTexto(inscricaoApresentador?.nome) || limparTexto(banca.apresentador_nome) || 'Acadêmico(a)';

    const assunto = `Banca de TCC Aprovada - ${banca.titulo_tcc}`;
    const mensagem = `Olá, ${nomeApresentador}! Sua banca de TCC "${banca.titulo_tcc}" foi aprovada pela coordenação. Data/Horário: ${banca.horario_descricao || 'A definir'} | Sala: ${banca.sala_nome || 'A definir'}.`;

    try {
      const { error: fnError } = await supabase.functions.invoke('enviar-email-confirmacao', {
        body: {
          to: destinatario,
          email: destinatario,
          nome: nomeApresentador,
          subject: assunto,
          mensagem,
          banca_id: banca.id,
          titulo_tcc: banca.titulo_tcc,
          horario_descricao: banca.horario_descricao || '',
          sala_nome: banca.sala_nome || '',
          tipo: 'aprovacao_banca',
        },
      });

      if (inscricaoApresentador?.id) {
        await supabase
          .from('inscricoes')
          .update({
            email_enviado: !fnError,
            email_status: fnError ? 'pendente_envio' : 'confirmado',
          })
          .eq('id', inscricaoApresentador.id);
      }

      if (fnError) {
        return { enviado: false, email: destinatario, motivo: fnError.message };
      }

      return { enviado: true, email: destinatario };
    } catch (err) {
      return { enviado: false, email: destinatario, motivo: err.message };
    }
  }

  async function handleAprovarBanca(banca) {
    setAprovandoId(banca.id);
    try {
      const { error } = await supabase
        .from('bancas')
        .update({ status: 'agendada' })
        .eq('id', banca.id);

      if (error) throw error;

      const { data: inscricaoApresentador } = await supabase
        .from('inscricoes')
        .select('*')
        .eq('banca_id', banca.id)
        .eq('tipo', 'apresentador')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const resultadoEmail = await enviarEmailConfirmacaoApresentador(banca, inscricaoApresentador);

      if (resultadoEmail.enviado) {
        toast({
          title: 'TCC Aprovado e E-mail Enviado!',
          description: `Banca liberada e confirmação enviada para ${resultadoEmail.email}.`,
        });
      } else if (resultadoEmail.email) {
        toast({
          title: 'TCC Aprovado!',
          description: `Banca liberada para espectadores. E-mail registrado para ${resultadoEmail.email}.`,
        });
      } else {
        toast({
          title: 'TCC Aprovado!',
          description: 'Esta banca já está liberada para inscrição de espectadores.',
        });
      }

      load();
    } catch (err) {
      toast({
        title: 'Erro ao aprovar TCC',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setAprovandoId(null);
    }
  }

  async function handleSalvarAlunoAvulso(e) {
    e.preventDefault();
    const codigo = alunoForm.codigo_aluno.trim();
    const nome = alunoForm.nome_completo.trim();
    const orientador = alunoForm.orientador_nome.trim();
    const titulacao = alunoForm.titulacao.trim();

    if (!codigo || !nome) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o código do aluno e o nome completo.',
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
        title: 'Aluno salvo no pré-cadastro!',
        description: `${nome} (${codigo}) já pode realizar a inscrição.`,
      });
      setAlunoForm(emptyAlunoForm);
      setShowAlunoModal(false);
      load();
    } catch (err) {
      toast({
        title: 'Erro ao cadastrar aluno',
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
            Object.entries(row).map(([k, v]) => [normalizarChave(k), String(v).trim()])
          );
          return {
            codigo_aluno:
              norm['codigo do aluno'] ||
              norm['codigo_aluno'] ||
              norm['codigo'] ||
              norm['matricula'] ||
              '',
            nome_completo:
              norm['nome completo'] ||
              norm['nome_completo'] ||
              norm['nome'] ||
              norm['aluno'] ||
              '',
            orientador_nome:
              norm['orientador'] ||
              norm['orientador_nome'] ||
              norm['professor orientador'] ||
              '',
            titulacao: norm['titulacao'] || norm['titulo'] || '',
          };
        })
        .filter((r) => r.codigo_aluno && r.nome_completo);

      if (registros.length === 0) {
        throw new Error(
          'Nenhuma linha válida encontrada. Verifique as colunas: Código do aluno, Nome completo, Orientador e Titulação.'
        );
      }

      const { error } = await supabase
        .from('alunos_precadastro')
        .upsert(registros, { onConflict: 'codigo_aluno' });
      if (error) throw error;

      toast({
        title: 'Planilha importada!',
        description: `${registros.length} aluno(s) sincronizado(s) no pré-cadastro.`,
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
      const avaliador2Obj =
        form.avaliador2_tipo === 'curso'
          ? professores.find((p) => p.id === form.avaliador2_id)
          : null;

      const isExterno = form.avaliador2_tipo === 'externo';
      const nomeAvaliador2Externo = [
        limparTexto(form.avaliador2_externo_titulacao),
        limparTexto(form.avaliador2_externo_nome),
      ]
        .filter(Boolean)
        .join(' ');

      const vagasFinal =
        Number.isFinite(Number(form.vagas_espectadores)) && Number(form.vagas_espectadores) >= 0
          ? Number(form.vagas_espectadores)
          : salaObj && Number(salaObj.capacidade) > 0
            ? Number(salaObj.capacidade)
            : VAGAS_PADRAO;

      const payload = {
        titulo_tcc: form.titulo_tcc.trim(),
        apresentador_nome: form.apresentador_nome.trim(),
        horario_id: form.horario_id || null,
        sala_id: form.sala_id || null,
        orientador_id: form.orientador_id || null,
        orientador_nome: orientadorObj ? orientadorObj.nome : '',
        orientador_user_id: orientadorObj?.user_id || null,
        avaliador1_id: form.avaliador1_id || null,
        avaliador1_nome: avaliador1Obj ? avaliador1Obj.nome : '',
        avaliador2_tipo: form.avaliador2_tipo || 'curso',
        avaliador2_id: isExterno ? null : form.avaliador2_id || null,
        avaliador2_nome: isExterno
          ? nomeAvaliador2Externo
          : avaliador2Obj
            ? avaliador2Obj.nome
            : '',
        avaliador2_externo_titulacao: isExterno
          ? limparTexto(form.avaliador2_externo_titulacao)
          : '',
        avaliador2_externo_nome: isExterno ? limparTexto(form.avaliador2_externo_nome) : '',
        avaliador2_externo_email: isExterno ? limparTexto(form.avaliador2_externo_email) : '',
        horario_descricao: horarioObj
          ? horarioObj.descricao ||
            `${horarioObj.data} • ${horarioObj.hora_inicio?.slice(0, 5)} às ${horarioObj.hora_fim?.slice(0, 5)}`
          : '',
        horario_data: horarioObj ? horarioObj.data : '',
        sala_nome: salaObj ? salaObj.nome : '',
        status: form.status,
        vagas_espectadores: vagasFinal,
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
    const { error } = await supabase.from('bancas').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Banca removida' });
    load();
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

  const bancasFiltradas = bancas.filter((b) => {
    const matchStatus = filtroStatus === 'todos' || b.status === filtroStatus;
    const termo = busca.toLowerCase().trim();
    const matchBusca =
      !termo ||
      b.titulo_tcc?.toLowerCase().includes(termo) ||
      b.apresentador_nome?.toLowerCase().includes(termo) ||
      b.orientador_nome?.toLowerCase().includes(termo) ||
      b.sala_nome?.toLowerCase().includes(termo);
    return matchStatus && matchBusca;
  });

  const salaAtualForm = salas.find((s) => s.id === form.sala_id);

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bancas</h1>
          <p className="text-xs text-slate-500">{totalPreCadastro} aluno(s) no pré-cadastro</p>
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
            variant="outline"
            disabled={importando}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importando ? 'Importando...' : 'Importar Alunos (Excel)'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setAlunoForm(emptyAlunoForm);
              setShowAlunoModal(true);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Cadastrar Aluno
          </Button>
          <Button
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

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, apresentador, orientador ou sala..."
            className="pl-9 bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'todos', label: 'Todas' },
            { key: 'pendente', label: 'Pendentes' },
            { key: 'aprovada', label: 'Aprovadas' },
            { key: 'agendada', label: 'Agendadas' },
            { key: 'realizada', label: 'Realizadas' },
            { key: 'cancelada', label: 'Canceladas' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFiltroStatus(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filtroStatus === tab.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecionar...</option>
                {horarios.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.data} • {h.hora_inicio?.slice(0, 5)} às {h.hora_fim?.slice(0, 5)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Sala</Label>
              <select
                value={form.sala_id}
                onChange={(e) => handleSalaChange(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecionar (padrão {VAGAS_PADRAO} vagas)...</option>
                {salas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} {s.capacidade ? `(Cap. ${s.capacidade} vagas)` : ''}
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
              <Label>Avaliador 1</Label>
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
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="curso">Professor do Curso</option>
                <option value="externo">Avaliador Externo</option>
              </select>
            </div>

            {form.avaliador2_tipo === 'externo' ? (
              <>
                <div>
                  <Label>Titulação (Avaliador Externo)</Label>
                  <Input
                    placeholder="Ex: Prof. Dr., Me., Esp."
                    value={form.avaliador2_externo_titulacao}
                    onChange={(e) => update('avaliador2_externo_titulacao', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Nome Completo (Avaliador Externo)</Label>
                  <Input
                    value={form.avaliador2_externo_nome}
                    onChange={(e) => update('avaliador2_externo_nome', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>E-mail (Avaliador Externo)</Label>
                  <Input
                    type="email"
                    value={form.avaliador2_externo_email}
                    onChange={(e) => update('avaliador2_externo_email', e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div>
                <Label>Avaliador 2</Label>
                <ProfessorSelector
                  value={form.avaliador2_id}
                  onChange={(id) => update('avaliador2_id', id)}
                  excludeIds={[form.orientador_id, form.avaliador1_id].filter(Boolean)}
                />
              </div>
            )}

            <div>
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {['pendente', 'aprovada', 'agendada', 'realizada', 'cancelada'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Vagas Espectadores</Label>
              <Input
                type="number"
                value={form.vagas_espectadores}
                onChange={(e) =>
                  update(
                    'vagas_espectadores',
                    e.target.value === '' ? '' : parseInt(e.target.value, 10)
                  )
                }
                min={0}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {salaAtualForm?.capacidade
                  ? `Capacidade máxima da sala ${salaAtualForm.nome}: ${salaAtualForm.capacidade} vagas.`
                  : `Padrão de ${VAGAS_PADRAO} vagas (ajusta automaticamente ao escolher uma sala).`}
              </p>
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
      ) : bancasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
          Nenhuma banca encontrada com os filtros atuais.
        </div>
      ) : (
        <div className="space-y-3">
          {bancasFiltradas.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row justify-between items-start gap-4"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h3 className="font-semibold text-slate-900">{b.titulo_tcc}</h3>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-sm text-slate-600">
                  {b.apresentador_nome} {b.sala_nome ? `• ${b.sala_nome}` : ''} •{' '}
                  <span className="text-slate-500">
                    {b.vagas_espectadores ?? VAGAS_PADRAO} vagas
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {b.horario_descricao}
                  {b.orientador_nome ? ` • Orientador(a): ${b.orientador_nome}` : ''}
                  {b.avaliador2_tipo === 'externo' && b.avaliador2_nome
                    ? ` • Avaliador Ext.: ${b.avaliador2_nome}`
                    : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-start">
                {b.status === 'pendente' && (
                  <Button
                    size="sm"
                    onClick={() => handleAprovarBanca(b)}
                    disabled={aprovandoId === b.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    title="Aprovar banca e enviar e-mail de confirmação ao apresentador"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {aprovandoId === b.id ? 'Aprovando...' : 'Aprovar e Notificar'}
                    <Mail className="w-3.5 h-3.5 opacity-80" />
                  </Button>
                )}

                <button
                  onClick={() => setQrBanca(b)}
                  title="Gerar QR Code"
                  className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const salaVinculada = salas.find((s) => s.id === b.sala_id);
                    const vagasIniciais =
                      b.vagas_espectadores !== null && b.vagas_espectadores !== undefined
                        ? b.vagas_espectadores
                        : salaVinculada?.capacidade || VAGAS_PADRAO;

                    setForm({
                      titulo_tcc: b.titulo_tcc || '',
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
                      status: b.status || 'pendente',
                      vagas_espectadores: vagasIniciais,
                    });
                    setEditId(b.id);
                    setShowForm(true);
                  }}
                  title="Editar banca"
                  className="p-2 text-slate-400 hover:text-indigo-600"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(b.id)}
                  title="Remover banca"
                  className="p-2 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cadastro Avulso de Aluno */}
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
              <h3 className="font-bold text-slate-900">Cadastrar Aluno no Pré-Cadastro</h3>
              <button
                onClick={() => setShowAlunoModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSalvarAlunoAvulso} className="space-y-3">
              <div>
                <Label>Código do Aluno *</Label>
                <Input
                  value={alunoForm.codigo_aluno}
                  onChange={(e) =>
                    setAlunoForm((f) => ({ ...f, codigo_aluno: e.target.value }))
                  }
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
                  required
                />
              </div>
              <div>
                <Label>Orientador</Label>
                <Input
                  value={alunoForm.orientador_nome}
                  onChange={(e) =>
                    setAlunoForm((f) => ({ ...f, orientador_nome: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Titulação do Orientador</Label>
                <Input
                  placeholder="Ex: Prof. Dr., Me., Esp."
                  value={alunoForm.titulacao}
                  onChange={(e) =>
                    setAlunoForm((f) => ({ ...f, titulacao: e.target.value }))
                  }
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

      {/* Modal QR Code */}
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
            <Button onClick={baixarQrCode} className="w-full gap-2">
              <Download className="w-4 h-4" /> Baixar QR Code (PNG)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}