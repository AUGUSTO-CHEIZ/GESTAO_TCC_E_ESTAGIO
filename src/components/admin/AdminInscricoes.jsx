import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { adicionarAlunoUltimaHora } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Search, UserX, Users, UserPlus, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const tipoLabel = {
  apresentador: 'Apresentador',
  academico: 'Acadêmico',
  familiar: 'Familiar',
};

const emptyAddForm = {
  banca_id: '',
  tipo: 'academico',
  nome: '',
  email: '',
  codigo_academico: '',
  curso: 'Psicologia',
  semestre: '',
  parentesco: '',
  cpf: '',
};

export default function AdminInscricoes() {
  const [aba, setAba] = useState('ativas');
  const [inscricoes, setInscricoes] = useState([]);
  const [ausentes, setAusentes] = useState([]);
  const [bancas, setBancas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [salvandoAluno, setSalvandoAluno] = useState(false);

  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const [inscRes, ausRes, bancasRes] = await Promise.all([
        supabase.from('inscricoes').select('*').order('created_at', { ascending: false }),
        supabase.from('inscricoes_ausentes').select('*').order('created_at', { ascending: false }),
        supabase.from('bancas').select('id, titulo_tcc, apresentador_nome, horario_descricao, horario_data, sala_nome').neq('status', 'cancelada').order('horario_data', { ascending: true }),
      ]);
      if (inscRes.error) throw inscRes.error;
      setInscricoes(inscRes.data || []);
      setAusentes(ausRes.data || []);
      setBancas(bancasRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function abrirModalUltimaHora() {
    setAddForm({
      ...emptyAddForm,
      banca_id: bancas[0]?.id || '',
    });
    setShowAddModal(true);
  }

  function updateAddField(field, value) {
    setAddForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSalvarUltimaHora(e) {
    e.preventDefault();
    if (!addForm.banca_id || !addForm.nome.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione a banca e informe o nome do aluno.',
        variant: 'destructive',
      });
      return;
    }
    if (addForm.tipo === 'academico' && !addForm.email.trim()) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe o e-mail para inscrição acadêmica.',
        variant: 'destructive',
      });
      return;
    }

    setSalvandoAluno(true);
    try {
      const res = await adicionarAlunoUltimaHora({
        ...addForm,
        nome: addForm.nome.trim(),
        email: addForm.email.trim(),
      });
      if (res.data?.error) {
        throw new Error(res.data.error);
      }
      toast({
        title: 'Aluno adicionado de última hora',
        description: `${addForm.nome.trim()} foi incluído(a) e marcado(a) como presente.`,
      });
      setShowAddModal(false);
      setAddForm(emptyAddForm);
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

  async function handleDelete(id, tabela = 'inscricoes') {
    if (!confirm('Remover este registro?')) return;
    const { error } = await supabase.from(tabela).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Registro removido' });
    load();
  }

  const listaBase = aba === 'ativas' ? inscricoes : ausentes;
  const filtered = listaBase.filter((i) => {
    const matchTipo = filtroTipo === 'todos' || i.tipo === filtroTipo;
    const termo = search.toLowerCase();
    const matchSearch =
      !termo ||
      i.nome?.toLowerCase().includes(termo) ||
      i.email?.toLowerCase().includes(termo) ||
      i.codigo_academico?.toLowerCase().includes(termo) ||
      i.banca_titulo?.toLowerCase().includes(termo);
    return matchTipo && matchSearch;
  });

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inscrições</h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setAba('ativas')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                aba === 'ativas' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" /> Ativas ({inscricoes.length})
            </button>
            <button
              type="button"
              onClick={() => setAba('ausentes')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                aba === 'ausentes' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserX className="w-4 h-4" /> Histórico de Ausentes ({ausentes.length})
            </button>
          </div>

          <Button type="button" onClick={abrirModalUltimaHora} className="gap-1.5">
            <UserPlus className="w-4 h-4" /> Adicionar Última Hora
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, código ou banca..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['todos', 'apresentador', 'academico', 'familiar'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filtroTipo === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'todos' ? 'Todos' : tipoLabel[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">
          {aba === 'ativas' ? 'Nenhuma inscrição encontrada.' : 'Nenhum registro de ausência na 1ª chamada.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Participante</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">Banca / Horário</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Tipo</th>
                {aba === 'ausentes' && (
                  <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">Registro de Falta</th>
                )}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{i.nome}</p>
                      {i.inclusao_ultima_hora && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          Última hora
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[
                        i.codigo_academico && `Cód: ${i.codigo_academico}`,
                        i.email,
                        i.inclusao_ultima_hora && i.added_by_professor_nome && `Adicionado por: ${i.added_by_professor_nome}`,
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'Sem e-mail'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    <p className="line-clamp-1 font-medium text-slate-700">{i.banca_titulo || '—'}</p>
                    <p className="text-xs text-slate-400">{i.horario_descricao || i.horario_data}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        i.tipo === 'apresentador'
                          ? 'bg-indigo-100 text-indigo-700'
                          : i.tipo === 'academico'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {tipoLabel[i.tipo] || i.tipo}
                    </span>
                  </td>
                  {aba === 'ausentes' && (
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                      <span className="inline-block px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium">
                        {i.etapa_falta || '1ª Chamada'}
                      </span>
                      {i.registrado_por && <p className="mt-0.5 text-slate-400">Por: {i.registrado_por}</p>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(i.id, aba === 'ativas' ? 'inscricoes' : 'inscricoes_ausentes')}
                      className="p-1.5 text-slate-400 hover:text-red-600 ml-auto block"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Adicionar Aluno de Última Hora</h2>
                <p className="text-xs text-slate-500">O participante será registrado como última hora e marcado como presente.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarUltimaHora} className="space-y-4">
              <div>
                <Label>Banca *</Label>
                <select
                  value={addForm.banca_id}
                  onChange={(e) => updateAddField('banca_id', e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione uma banca...</option>
                  {bancas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.titulo_tcc} {b.apresentador_nome ? `(${b.apresentador_nome})` : ''} {b.horario_descricao ? `• ${b.horario_descricao}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Tipo de Participante *</Label>
                <select
                  value={addForm.tipo}
                  onChange={(e) => updateAddField('tipo', e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="academico">Acadêmico</option>
                  <option value="familiar">Familiar / Amigo</option>
                  <option value="apresentador">Apresentador</option>
                </select>
              </div>

              <div>
                <Label>Nome completo *</Label>
                <Input
                  value={addForm.nome}
                  onChange={(e) => updateAddField('nome', e.target.value)}
                  required
                  placeholder="Nome completo do aluno"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>{addForm.tipo === 'familiar' ? 'E-mail (opcional)' : 'E-mail *'}</Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => updateAddField('email', e.target.value)}
                  required={addForm.tipo !== 'familiar'}
                  placeholder="email@exemplo.com"
                  className="mt-1"
                />
              </div>

              {addForm.tipo === 'academico' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Código do Aluno</Label>
                    <Input
                      value={addForm.codigo_academico}
                      onChange={(e) => updateAddField('codigo_academico', e.target.value)}
                      placeholder="Ex: 156138"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Semestre / Período</Label>
                    <Input
                      value={addForm.semestre}
                      onChange={(e) => updateAddField('semestre', e.target.value)}
                      placeholder="Ex: 6º"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {addForm.tipo === 'familiar' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Parentesco / Vínculo</Label>
                    <Input
                      value={addForm.parentesco}
                      onChange={(e) => updateAddField('parentesco', e.target.value)}
                      placeholder="Ex: Mãe, Amigo"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>CPF (opcional)</Label>
                    <Input
                      value={addForm.cpf}
                      onChange={(e) => updateAddField('cpf', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvandoAluno}>
                  {salvandoAluno ? 'Salvando...' : 'Confirmar Inclusão'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}