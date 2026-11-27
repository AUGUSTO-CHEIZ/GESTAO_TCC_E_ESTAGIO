import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { registrarLog } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, UserPlus, Search, Pencil, Trash2, X, GraduationCap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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

export default function AdminAlunos() {
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [busca, setBusca] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyAlunoForm);
  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  async function load() {
    try {
      const { data, error } = await supabase
        .from('alunos_precadastro')
        .select('*')
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setAlunos(data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao carregar alunos',
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

  async function handleImportarExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      const registros = linhas
        .map((row) => {
          const norm = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [normalizarChave(k), limparTexto(v)])
          );
          return {
            codigo_aluno:
              norm['codigo do aluno'] ||
              norm['codigo_aluno'] ||
              norm['cd_pessoa'] ||
              norm['codigo'] ||
              norm['matricula'] ||
              '',
            nome_completo:
              norm['nome completo'] ||
              norm['nome_completo'] ||
              norm['nm_pessoa'] ||
              norm['nome'] ||
              norm['aluno'] ||
              '',
            orientador_nome:
              norm['orientador'] ||
              norm['orientador(a)'] ||
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

      await registrarLog({
        acao: 'IMPORTAR',
        entidade: 'ALUNOS_PRECADASTRO',
        detalhes: `${registros.length} aluno(s) importado(s) via planilha Excel.`,
      });

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

  async function handleSalvarAluno(e) {
    e.preventDefault();
    const codigo = form.codigo_aluno.trim();
    const nome = form.nome_completo.trim();
    const orientador = form.orientador_nome.trim();
    const titulacao = form.titulacao.trim();

    if (!codigo || !nome) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o código do aluno e o nome completo.',
        variant: 'destructive',
      });
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        codigo_aluno: codigo,
        nome_completo: nome,
        orientador_nome: orientador,
        titulacao,
      };

      if (editId) {
        const { error } = await supabase
          .from('alunos_precadastro')
          .update(payload)
          .eq('id', editId);
        if (error) throw error;

        await registrarLog({
          acao: 'EDITAR',
          entidade: 'ALUNOS_PRECADASTRO',
          detalhes: `Aluno editado: ${nome} (Cód: ${codigo})`,
        });
        toast({ title: 'Aluno atualizado!' });
      } else {
        const { error } = await supabase
          .from('alunos_precadastro')
          .upsert(payload, { onConflict: 'codigo_aluno' });
        if (error) throw error;

        await registrarLog({
          acao: 'CRIAR',
          entidade: 'ALUNOS_PRECADASTRO',
          detalhes: `Aluno cadastrado: ${nome} (Cód: ${codigo})`,
        });
        toast({ title: 'Aluno cadastrado no pré-cadastro!' });
      }

      setShowModal(false);
      setEditId(null);
      setForm(emptyAlunoForm);
      load();
    } catch (err) {
      toast({
        title: 'Erro ao salvar aluno',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(aluno) {
    if (!confirm(`Remover "${aluno.nome_completo}" do pré-cadastro?`)) return;
    try {
      const { error } = await supabase
        .from('alunos_precadastro')
        .delete()
        .eq('id', aluno.id);
      if (error) throw error;

      await registrarLog({
        acao: 'EXCLUIR',
        entidade: 'ALUNOS_PRECADASTRO',
        detalhes: `Aluno removido: ${aluno.nome_completo} (Cód: ${aluno.codigo_aluno})`,
      });
      toast({ title: 'Aluno removido' });
      load();
    } catch (err) {
      toast({
        title: 'Erro ao remover',
        description: err.message,
        variant: 'destructive',
      });
    }
  }

  const termo = busca.trim().toLowerCase();
  const alunosFiltrados = alunos.filter((a) => {
    if (!termo) return true;
    return [a.codigo_aluno, a.nome_completo, a.orientador_nome, a.titulacao]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(termo);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alunos</h1>
          <p className="text-xs text-slate-500">
            {alunos.length} aluno(s) apto(s) no pré-cadastro para apresentar TCC
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
            variant="outline"
            disabled={importando}
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            {importando ? 'Importando...' : 'Importar Alunos (Excel)'}
          </Button>
          <Button
            onClick={() => {
              setEditId(null);
              setForm(emptyAlunoForm);
              setShowModal(true);
            }}
            className="gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar Aluno
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar aluno por código, nome ou orientador..."
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : alunosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-500">Nenhum aluno encontrado no pré-cadastro.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Nome Completo</th>
                  <th className="py-3 px-4">Orientador(a)</th>
                  <th className="py-3 px-4">Titulação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {alunosFiltrados.map((aluno) => (
                  <tr key={aluno.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-indigo-700 whitespace-nowrap">
                      {aluno.codigo_aluno}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {aluno.nome_completo}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {aluno.orientador_nome || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {aluno.titulacao || '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditId(aluno.id);
                          setForm({
                            codigo_aluno: aluno.codigo_aluno || '',
                            nome_completo: aluno.nome_completo || '',
                            orientador_nome: aluno.orientador_nome || '',
                            titulacao: aluno.titulacao || '',
                          });
                          setShowModal(true);
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600"
                        title="Editar aluno"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExcluir(aluno)}
                        className="p-2 text-slate-400 hover:text-red-600"
                        title="Remover aluno"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900">
                {editId ? 'Editar Aluno' : 'Cadastrar Aluno no Pré-cadastro'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarAluno} className="space-y-3">
              <div>
                <Label>Código do Aluno *</Label>
                <Input
                  value={form.codigo_aluno}
                  onChange={(e) => setForm({ ...form, codigo_aluno: e.target.value })}
                  placeholder="Ex: 156138"
                  required
                />
              </div>
              <div>
                <Label>Nome Completo *</Label>
                <Input
                  value={form.nome_completo}
                  onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
                  placeholder="Nome completo do acadêmico"
                  required
                />
              </div>
              <div>
                <Label>Orientador(a)</Label>
                <Input
                  value={form.orientador_nome}
                  onChange={(e) => setForm({ ...form, orientador_nome: e.target.value })}
                  placeholder="Nome do professor orientador"
                />
              </div>
              <div>
                <Label>Titulação do Orientador</Label>
                <Input
                  value={form.titulacao}
                  onChange={(e) => setForm({ ...form, titulacao: e.target.value })}
                  placeholder="Ex: Me., Ma., Dr., Dra."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar Aluno'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}