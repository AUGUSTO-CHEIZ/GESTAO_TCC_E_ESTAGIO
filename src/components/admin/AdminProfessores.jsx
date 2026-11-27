import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { registrarLog } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Search,
  UserCheck,
  UserX,
  Mail,
  GraduationCap,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';

const emptyForm = {
  titulacao: '',
  nome: '',
  email: '',
  ativo: true,
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

export default function AdminProfessores() {
  const [orientadores, setOrientadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState('');

  const fileInputRef = useRef(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('professores')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setOrientadores(data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao carregar orientadores',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function abrirNovo() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
  }

  function abrirEdicao(item) {
    setForm({
      titulacao: item.titulacao || '',
      nome: item.nome || '',
      email: item.email || '',
      ativo: item.ativo !== false,
    });
    setEditId(item.id);
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const nome = limparTexto(form.nome);
    const email = limparTexto(form.email).toLowerCase();
    const titulacao = limparTexto(form.titulacao);

    if (!nome || !email) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o e-mail do orientador.',
        variant: 'destructive',
      });
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        titulacao,
        nome,
        email,
        ativo: Boolean(form.ativo),
      };

      const nomeExibicao = titulacao ? `${titulacao} ${nome}` : nome;

      if (editId) {
        const { error } = await supabase
          .from('professores')
          .update(payload)
          .eq('id', editId);
        if (error) throw error;

        await registrarLog({
          acao: 'EDITAR',
          entidade: 'ORIENTADORES',
          detalhes: `Editou orientador(a) ${nomeExibicao} (${email})`,
        });

        toast({ title: 'Orientador atualizado com sucesso!' });
      } else {
        const jaExiste = orientadores.find(
          (o) => String(o.email || '').trim().toLowerCase() === email
        );
        if (jaExiste) {
          throw new Error('Já existe um orientador cadastrado com este e-mail.');
        }

        const { error } = await supabase.from('professores').insert(payload);
        if (error) throw error;

        await registrarLog({
          acao: 'CRIAR',
          entidade: 'ORIENTADORES',
          detalhes: `Cadastrou orientador(a) ${nomeExibicao} (${email})`,
        });

        toast({ title: 'Orientador cadastrado com sucesso!' });
      }

      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
      load();
    } catch (err) {
      toast({
        title: 'Erro ao salvar orientador',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(item) {
    const novoStatus = item.ativo === false;
    const nomeExibicao = item.titulacao ? `${item.titulacao} ${item.nome}` : item.nome;

    try {
      const { error } = await supabase
        .from('professores')
        .update({ ativo: novoStatus })
        .eq('id', item.id);
      if (error) throw error;

      await registrarLog({
        acao: 'EDITAR',
        entidade: 'ORIENTADORES',
        detalhes: `${novoStatus ? 'Ativou' : 'Inativou'} orientador(a) ${nomeExibicao}`,
      });

      toast({
        title: novoStatus ? 'Orientador ativado' : 'Orientador inativado',
      });
      load();
    } catch (err) {
      toast({
        title: 'Erro ao alterar status',
        description: err.message,
        variant: 'destructive',
      });
    }
  }

  async function handleDelete(item) {
    const nomeExibicao = item.titulacao ? `${item.titulacao} ${item.nome}` : item.nome;
    if (!confirm(`Deseja realmente remover ${nomeExibicao} da lista de orientadores?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('professores').delete().eq('id', item.id);
      if (error) throw error;

      await registrarLog({
        acao: 'EXCLUIR',
        entidade: 'ORIENTADORES',
        detalhes: `Excluiu orientador(a) ${nomeExibicao} (${item.email || 'sem e-mail'})`,
      });

      toast({ title: 'Orientador removido' });
      load();
    } catch (err) {
      toast({
        title: 'Erro ao excluir orientador',
        description: err.message,
        variant: 'destructive',
      });
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

      // Lê como matriz de linhas para ignorar explicitamente a 1ª linha (cabeçalho)
      const matriz = XLSX.utils.sheet_to_json(primeiraAba, {
        header: 1,
        defval: '',
      });

      if (!matriz || matriz.length <= 1) {
        throw new Error(
          'A planilha precisa ter o cabeçalho na 1ª linha e pelo menos um orientador a partir da 2ª linha.'
        );
      }

      const cabecalhoNorm = (matriz[0] || []).map((col) => normalizarChave(col));

      let idxTitulacao = cabecalhoNorm.findIndex(
        (c) => c.includes('titul') || c === 'titulo' || c === 'grau'
      );
      let idxNome = cabecalhoNorm.findIndex(
        (c) => c.includes('nome') || c.includes('orientador') || c.includes('professor')
      );
      let idxEmail = cabecalhoNorm.findIndex(
        (c) => c.includes('mail') || c.includes('correio')
      );

      // Fallback para ordem padrão das colunas: A (0) = Titulação, B (1) = Nome, C (2) = E-mail
      if (idxTitulacao === -1) idxTitulacao = 0;
      if (idxNome === -1) idxNome = 1;
      if (idxEmail === -1) idxEmail = 2;

      const dadosAbaixoPrimeiraLinha = matriz.slice(1);
      const mapaPorEmail = new Map();

      for (const linha of dadosAbaixoPrimeiraLinha) {
        if (!Array.isArray(linha)) continue;
        const titulacao = limparTexto(linha[idxTitulacao]);
        const nome = limparTexto(linha[idxNome]);
        const email = limparTexto(linha[idxEmail]).toLowerCase();

        if (!nome || !email || !email.includes('@')) continue;

        mapaPorEmail.set(email, {
          titulacao,
          nome,
          email,
          ativo: true,
        });
      }

      const registros = Array.from(mapaPorEmail.values());

      if (registros.length === 0) {
        throw new Error(
          'Nenhum orientador válido encontrado abaixo da 1ª linha. Verifique as colunas: Titulação, Nome e E-mail.'
        );
      }

      const { data: existentes, error: fetchErr } = await supabase
        .from('professores')
        .select('id, email, titulacao');
      if (fetchErr) throw fetchErr;

      const mapaExistentes = new Map(
        (existentes || []).map((item) => [
          String(item.email || '').trim().toLowerCase(),
          item,
        ])
      );

      const paraInserir = [];
      let atualizados = 0;

      for (const reg of registros) {
        const encontrado = mapaExistentes.get(reg.email);
        if (encontrado) {
          const { error: updErr } = await supabase
            .from('professores')
            .update({
              nome: reg.nome,
              titulacao: reg.titulacao || encontrado.titulacao || '',
              ativo: true,
            })
            .eq('id', encontrado.id);
          if (updErr) throw updErr;
          atualizados += 1;
        } else {
          paraInserir.push(reg);
        }
      }

      if (paraInserir.length > 0) {
        const { error: insErr } = await supabase.from('professores').insert(paraInserir);
        if (insErr) throw insErr;
      }

      await registrarLog({
        acao: 'IMPORTAR',
        entidade: 'ORIENTADORES',
        detalhes: `Importou planilha Excel de orientadores (${paraInserir.length} novo(s), ${atualizados} atualizado(s))`,
      });

      toast({
        title: 'Planilha de orientadores importada!',
        description: `${paraInserir.length} novo(s) cadastrado(s) e ${atualizados} atualizado(s).`,
      });

      load();
    } catch (err) {
      toast({
        title: 'Erro ao importar planilha',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setImportando(false);
      e.target.value = '';
    }
  }

  const termo = busca.trim().toLowerCase();
  const orientadoresFiltrados = orientadores.filter((item) => {
    if (!termo) return true;
    const texto = [item.titulacao, item.nome, item.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return texto.includes(termo);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orientadores</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os orientadores e avaliadores do curso ({orientadores.length} cadastrado(s)).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => fileInputRef.current?.click()}
            disabled={importando}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            {importando ? 'Importando...' : 'Importar Orientadores (Excel)'}
          </Button>

          <Button type="button" onClick={abrirNovo} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Orientador
          </Button>
        </div>
      </div>

      {/* Dica rápida do formato da planilha */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>Modelo da planilha Excel:</strong> 1ª linha com cabeçalho e dados a partir da{' '}
          <strong>2ª linha</strong> nas colunas <strong>Titulação</strong>, <strong>Nome</strong> e{' '}
          <strong>E-mail</strong>.
        </span>
      </div>

      {/* Formulário de cadastro / edição */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-semibold text-slate-900">
              {editId ? 'Editar Orientador' : 'Cadastrar Novo Orientador'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <Label>Titulação</Label>
              <Input
                value={form.titulacao}
                onChange={(e) => update('titulacao', e.target.value)}
                placeholder="Ex: Me., Ma., Dr., Dra."
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Nome Completo *</Label>
              <Input
                value={form.nome}
                onChange={(e) => update('nome', e.target.value)}
                placeholder="Nome completo do orientador"
                required
              />
            </div>

            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="orientador@unesc.net"
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => update('ativo', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Cadastro ativo (disponível para seleção nas bancas)
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditId(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Cadastrar Orientador'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Barra de busca */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar orientador por nome, titulação ou e-mail..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Lista de orientadores */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : orientadoresFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
          Nenhum orientador encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {orientadoresFiltrados.map((item) => {
            const ativo = item.ativo !== false;
            const nomeCompletoExibicao = item.titulacao
              ? `${item.titulacao} ${item.nome}`
              : item.nome;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border p-4 flex items-start justify-between gap-3 transition ${
                  ativo ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-75'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                      <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="break-words">{nomeCompletoExibicao}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1.5 break-all">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {item.email || 'Sem e-mail cadastrado'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        ativo
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {ativo ? 'Ativo' : 'Inativo'}
                    </span>

                    {item.user_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <CheckCircle2 className="w-3 h-3" /> Senha criada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" /> 1º acesso pendente
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => abrirEdicao(item)}
                    title="Editar orientador"
                  >
                    <Pencil className="w-4 h-4 text-slate-600" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleAtivo(item)}
                    title={ativo ? 'Inativar orientador' : 'Ativar orientador'}
                  >
                    {ativo ? (
                      <UserX className="w-4 h-4 text-amber-600" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item)}
                    title="Excluir orientador"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}