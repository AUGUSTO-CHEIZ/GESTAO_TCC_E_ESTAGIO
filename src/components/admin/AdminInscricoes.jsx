import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { registrarLog } from '@/lib/auditLog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Search,
  Users,
  UserX,
  UserPlus,
  GraduationCap,
  Eye,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  X,
  RefreshCw,
  Presentation,
  ChevronRight,
} from 'lucide-react';

const tipoLabel = {
  apresentador: 'Apresentador',
  academico: 'Acadêmico',
  familiar: 'Familiar / Amigo',
};

const emptyUltimaHora = {
  banca_id: '',
  tipo: 'academico',
  nome: '',
  email: '',
  codigo_academico: '',
  semestre: '',
  parentesco: '',
};

function gerarChavePessoa(item) {
  const cod = String(item.codigo_academico || '').trim().toLowerCase();
  if (cod) return `cod:${cod}`;
  const mail = String(item.email || '').trim().toLowerCase();
  if (mail) return `mail:${mail}`;
  return `nome:${String(item.nome || 'sem-nome').trim().toLowerCase()}`;
}

export default function AdminInscricoes() {
  const [aba, setAba] = useState('cartoes'); // 'cartoes' | 'bancas' | 'ausentes'
  const [bancas, setBancas] = useState([]);
  const [inscricoes, setInscricoes] = useState([]);
  const [ausentes, setAusentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  // Cartão selecionado (detalhes do inscrito)
  const [pessoaSelecionadaChave, setPessoaSelecionadaChave] = useState(null);

  // Modal de inclusão de última hora
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyUltimaHora);
  const [salvandoAdd, setSalvandoAdd] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const consulta = Promise.all([
        supabase
          .from('bancas')
          .select('*')
          .neq('status', 'cancelada')
          .order('horario_data', { ascending: true }),
        supabase
          .from('inscricoes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('inscricoes_ausentes')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      const [bRes, iRes, aRes] = await Promise.race([
        consulta,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tempo limite ao carregar inscritos.')), 12000)
        ),
      ]);

      if (bRes.error) throw bRes.error;
      if (iRes.error) throw iRes.error;

      setBancas(bRes.data || []);
      setInscricoes(iRes.data || []);
      setAusentes(aRes.data || []);
    } catch (err) {
      console.error(err);
      setErro(err.message || 'Erro ao carregar dados de espectadores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bancasMap = useMemo(() => {
    const map = new Map();
    bancas.forEach((b) => map.set(b.id, b));
    return map;
  }, [bancas]);

  // Agrupa todas as inscrições por pessoa para os cartões clicáveis
  const pessoasAgrupadas = useMemo(() => {
    const mapa = new Map();

    inscricoes.forEach((insc) => {
      const chave = gerarChavePessoa(insc);
      const bancaInfo = bancasMap.get(insc.banca_id) || {};

      const itemDetalhado = {
        ...insc,
        titulo_tcc: insc.banca_titulo || bancaInfo.titulo_tcc || 'Apresentação sem título',
        horario_descricao: insc.horario_descricao || bancaInfo.horario_descricao || '',
        horario_data: insc.horario_data || bancaInfo.horario_data || '',
        sala_nome: insc.sala_nome || bancaInfo.sala_nome || '',
        orientador_nome: bancaInfo.orientador_nome || '',
        apresentador_nome: bancaInfo.apresentador_nome || '',
        banca_status: bancaInfo.status || '',
        chamada2_concluida: Boolean(bancaInfo.chamada2_concluida),
      };

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          nome: insc.nome || 'Sem nome',
          email: insc.email || '',
          codigo_academico: insc.codigo_academico || '',
          semestre: insc.semestre || '',
          parentesco: insc.parentesco || '',
          tipos: new Set([insc.tipo]),
          temUltimaHora: Boolean(insc.inclusao_ultima_hora),
          apresentacoes: [],
          assistindo: [],
        });
      }

      const pessoa = mapa.get(chave);
      if (!pessoa.email && insc.email) pessoa.email = insc.email;
      if (!pessoa.codigo_academico && insc.codigo_academico) {
        pessoa.codigo_academico = insc.codigo_academico;
      }
      if (!pessoa.semestre && insc.semestre) pessoa.semestre = insc.semestre;
      if (!pessoa.parentesco && insc.parentesco) pessoa.parentesco = insc.parentesco;
      if (insc.tipo) pessoa.tipos.add(insc.tipo);
      if (insc.inclusao_ultima_hora) pessoa.temUltimaHora = true;

      if (insc.tipo === 'apresentador') {
        pessoa.apresentacoes.push(itemDetalhado);
      } else {
        pessoa.assistindo.push(itemDetalhado);
      }
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [inscricoes, bancasMap]);

  const pessoaSelecionada = useMemo(
    () => pessoasAgrupadas.find((p) => p.chave === pessoaSelecionadaChave) || null,
    [pessoasAgrupadas, pessoaSelecionadaChave]
  );

  async function handleRemoverRegistro(registro, tabela = 'inscricoes') {
    if (!confirm(`Remover o registro de "${registro.nome}"?`)) return;
    try {
      const { error } = await supabase.from(tabela).delete().eq('id', registro.id);
      if (error) throw error;

      await registrarLog({
        acao: 'EXCLUIU',
        entidade: 'ESPECTADORES',
        detalhes: `Removeu ${registro.nome} (${tipoLabel[registro.tipo] || registro.tipo}) da banca "${
          registro.banca_titulo || '—'
        }".`,
      });

      toast({ title: 'Registro removido com sucesso' });
      load();
    } catch (err) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
  }

  async function handleSalvarUltimaHora(e) {
    e.preventDefault();
    if (!addForm.banca_id || !addForm.nome.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione a apresentação e informe o nome completo.',
        variant: 'destructive',
      });
      return;
    }

    if (addForm.tipo === 'academico' && !addForm.codigo_academico.trim()) {
      toast({
        title: 'Código obrigatório',
        description: 'Informe o código do aluno para espectador acadêmico.',
        variant: 'destructive',
      });
      return;
    }

    setSalvandoAdd(true);
    try {
      const banca = bancasMap.get(addForm.banca_id);
      const { error } = await supabase.from('inscricoes').insert({
        banca_id: addForm.banca_id,
        banca_titulo: banca?.titulo_tcc || '',
        horario_descricao: banca?.horario_descricao || '',
        horario_data: banca?.horario_data || '',
        sala_nome: banca?.sala_nome || '',
        orientador_user_id: banca?.orientador_user_id || null,
        tipo: addForm.tipo,
        nome: addForm.nome.trim(),
        email: addForm.email.trim(),
        codigo_academico: addForm.codigo_academico.trim(),
        curso: 'Psicologia',
        semestre: addForm.semestre.trim(),
        parentesco: addForm.parentesco.trim(),
        presente: true,
        presente_chamada1: !banca?.chamada1_concluida,
        presente_chamada2: true,
        inclusao_ultima_hora: true,
        email_enviado: Boolean(addForm.email.trim()),
        email_status: addForm.email.trim() ? 'confirmado' : 'sem_email',
      });

      if (error) throw error;

      await registrarLog({
        acao: 'ADICIONOU_ULTIMA_HORA',
        entidade: 'ESPECTADORES',
        detalhes: `Incluiu ${addForm.nome.trim()} (${tipoLabel[addForm.tipo]}) na banca "${
          banca?.titulo_tcc || '—'
        }".`,
      });

      toast({
        title: 'Participante adicionado!',
        description: 'Inclusão de última hora registrada com presença confirmada.',
      });
      setShowAddModal(false);
      setAddForm(emptyUltimaHora);
      load();
    } catch (err) {
      toast({
        title: 'Erro ao adicionar participante',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSalvandoAdd(false);
    }
  }

  const termo = search.trim().toLowerCase();

  const pessoasFiltradas = pessoasAgrupadas.filter((p) => {
    const matchTipo = filtroTipo === 'todos' || p.tipos.has(filtroTipo);
    if (!matchTipo) return false;
    if (!termo) return true;

    const texto = [
      p.nome,
      p.email,
      p.codigo_academico,
      p.parentesco,
      ...p.apresentacoes.map((a) => `${a.titulo_tcc} ${a.horario_descricao}`),
      ...p.assistindo.map((a) => `${a.titulo_tcc} ${a.horario_descricao}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return texto.includes(termo);
  });

  const bancasFiltradas = bancas.filter((b) => {
    if (!termo) return true;
    const inscritosDaBanca = inscricoes.filter((i) => i.banca_id === b.id);
    const texto = [
      b.titulo_tcc,
      b.apresentador_nome,
      b.orientador_nome,
      b.sala_nome,
      ...inscritosDaBanca.map((i) => `${i.nome} ${i.email || ''} ${i.codigo_academico || ''}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return texto.includes(termo);
  });

  const ausentesFiltrados = ausentes.filter((a) => {
    const matchTipo = filtroTipo === 'todos' || a.tipo === filtroTipo;
    if (!matchTipo) return false;
    if (!termo) return true;
    const texto = [a.nome, a.email, a.codigo_academico, a.banca_titulo, a.registrado_por]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return texto.includes(termo);
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Espectadores e Inscritos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Clique em qualquer cartão para visualizar o que cada participante apresenta ou assiste
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            type="button"
            onClick={() => {
              setAddForm(emptyUltimaHora);
              setShowAddModal(true);
            }}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar Última Hora
          </Button>
        </div>
      </div>

      {/* Sub-abas de visualização */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap bg-slate-200/70 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setAba('cartoes')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              aba === 'cartoes'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Inscritos ({pessoasAgrupadas.length})
          </button>

          <button
            type="button"
            onClick={() => setAba('bancas')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              aba === 'bancas'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Presentation className="w-4 h-4" />
            Por Apresentação ({bancas.length})
          </button>

          <button
            type="button"
            onClick={() => setAba('ausentes')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              aba === 'ausentes'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserX className="w-4 h-4" />
            Ausentes 1ª Chamada ({ausentes.length})
          </button>
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, código, e-mail ou título do TCC..."
            className="pl-9 bg-white"
          />
        </div>

        {aba !== 'bancas' && (
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
        )}
      </div>

      {/* Conteúdo principal */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : erro ? (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center space-y-3">
          <p className="text-sm font-medium text-red-700">{erro}</p>
          <Button type="button" variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      ) : aba === 'cartoes' ? (
        /* ABA 1: GRADE DE CARTÕES CLICÁVEIS POR PESSOA */
        pessoasFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">
            Nenhum inscrito encontrado para os filtros aplicados.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pessoasFiltradas.map((pessoa) => {
              const tiposLista = Array.from(pessoa.tipos);
              return (
                <button
                  key={pessoa.chave}
                  type="button"
                  onClick={() => setPessoaSelecionadaChave(pessoa.chave)}
                  className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-indigo-400 hover:shadow-md transition flex flex-col justify-between gap-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {tiposLista.map((tp) => (
                          <span
                            key={tp}
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              tp === 'apresentador'
                                ? 'bg-indigo-100 text-indigo-700'
                                : tp === 'academico'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {tipoLabel[tp] || tp}
                          </span>
                        ))}
                        {pessoa.temUltimaHora && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700">
                            Última hora
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0 mt-0.5" />
                    </div>

                    <h3 className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-indigo-700 transition">
                      {pessoa.nome}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {[
                        pessoa.codigo_academico && `Cód: ${pessoa.codigo_academico}`,
                        pessoa.semestre,
                        pessoa.parentesco,
                        pessoa.email,
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'Sem identificação complementar'}
                    </p>
                  </div>

                  {/* Resumo rápido de participação */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {pessoa.apresentacoes.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        <GraduationCap className="w-3.5 h-3.5" />
                        Apresenta {pessoa.apresentacoes.length} TCC
                      </span>
                    ) : (
                      <span />
                    )}

                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg ml-auto">
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      Assiste {pessoa.assistindo.length} banca(s)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : aba === 'bancas' ? (
        /* ABA 2: VISÃO POR APRESENTAÇÃO (CHAMADA E ESPECTADORES) */
        bancasFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">
            Nenhuma apresentação encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {bancasFiltradas.map((banca) => {
              const jaAconteceu =
                banca.status === 'realizada' || Boolean(banca.chamada2_concluida);
              const espectadores = inscricoes.filter(
                (i) => i.banca_id === banca.id && i.tipo !== 'apresentador'
              );
              const presentes = espectadores.filter(
                (i) => i.presente || i.presente_chamada1 || i.presente_chamada2
              );

              return (
                <div
                  key={banca.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            jaAconteceu
                              ? 'bg-slate-800 text-white'
                              : banca.status === 'agendada' || banca.status === 'aprovada'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {jaAconteceu
                            ? 'Realizada'
                            : banca.status === 'agendada' || banca.status === 'aprovada'
                            ? 'Agendada'
                            : 'Pendente'}
                        </span>
                        {banca.horario_descricao && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {banca.horario_descricao}
                          </span>
                        )}
                        {banca.sala_nome && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5" />
                            {banca.sala_nome}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900">{banca.titulo_tcc}</h3>
                      <p className="text-xs text-slate-600">
                        Apresentador: <strong>{banca.apresentador_nome || '—'}</strong>
                        {banca.orientador_nome ? ` • Orientador: ${banca.orientador_nome}` : ''}
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
                        <Users className="w-3.5 h-3.5" />
                        {espectadores.length} espectador(es)
                      </span>
                      {jaAconteceu && (
                        <p className="text-emerald-700 font-medium mt-1">
                          {presentes.length} presente(s) na chamada
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ABA 3: HISTÓRICO DE AUSENTES NA 1ª CHAMADA */
        ausentesFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">
            Nenhum registro de ausência na 1ª chamada.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Participante</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Banca / Horário</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Registro</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ausentesFiltrados.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{a.nome}</p>
                      <p className="text-xs text-slate-400">
                        {[a.codigo_academico && `Cód: ${a.codigo_academico}`, a.email]
                          .filter(Boolean)
                          .join(' • ') || 'Sem e-mail'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-medium text-slate-800 line-clamp-1">
                        {a.banca_titulo || '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {a.horario_descricao || a.horario_data}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {tipoLabel[a.tipo] || a.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">
                        {a.etapa_falta || '1ª Chamada'}
                      </span>
                      {a.registrado_por && (
                        <p className="text-slate-400 mt-0.5">Por: {a.registrado_por}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoverRegistro(a, 'inscricoes_ausentes')}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                        title="Remover registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* MODAL DETALHADO AO CLICAR EM UM CARTÃO */}
      {pessoaSelecionada && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPessoaSelecionadaChave(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Topo do modal */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(pessoaSelecionada.tipos).map((tp) => (
                    <span
                      key={tp}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        tp === 'apresentador'
                          ? 'bg-indigo-100 text-indigo-700'
                          : tp === 'academico'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {tipoLabel[tp] || tp}
                    </span>
                  ))}
                  {pessoaSelecionada.temUltimaHora && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      Última hora
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{pessoaSelecionada.nome}</h2>
                <p className="text-xs text-slate-500">
                  {[
                    pessoaSelecionada.codigo_academico &&
                      `Código: ${pessoaSelecionada.codigo_academico}`,
                    pessoaSelecionada.semestre && `Semestre: ${pessoaSelecionada.semestre}`,
                    pessoaSelecionada.parentesco && `Vínculo: ${pessoaSelecionada.parentesco}`,
                    pessoaSelecionada.email,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Sem dados adicionais'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPessoaSelecionadaChave(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo rolável com Apresentações e Bancas Assistidas */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Bloco 1: O que apresenta */}
              {pessoaSelecionada.apresentacoes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    Trabalho que Apresenta ({pessoaSelecionada.apresentacoes.length})
                  </h3>

                  <div className="space-y-2.5">
                    {pessoaSelecionada.apresentacoes.map((ap) => (
                      <div
                        key={ap.id}
                        className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-1.5"
                      >
                        <p className="font-semibold text-slate-900 text-sm">{ap.titulo_tcc}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                          {ap.horario_descricao && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                              {ap.horario_descricao}
                            </span>
                          )}
                          {ap.sala_nome && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                              {ap.sala_nome}
                            </span>
                          )}
                          {ap.orientador_nome && (
                            <span>Orientador(a): {ap.orientador_nome}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bloco 2: O que assiste */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-600" />
                  Apresentações que Assiste ({pessoaSelecionada.assistindo.length})
                </h3>

                {pessoaSelecionada.assistindo.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    Este participante não possui inscrições como ouvinte.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {pessoaSelecionada.assistindo.map((item) => {
                      const presente =
                        item.presente || item.presente_chamada1 || item.presente_chamada2;
                      const encerrada =
                        item.banca_status === 'realizada' || item.chamada2_concluida;

                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {presente ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                                  <CheckCircle2 className="w-3 h-3" /> Presente
                                </span>
                              ) : encerrada ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">
                                  <XCircle className="w-3 h-3" /> Ausente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                                  <Clock className="w-3 h-3" /> Inscrito (Aguardando)
                                </span>
                              )}

                              {item.inclusao_ultima_hora && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700">
                                  Última hora
                                </span>
                              )}
                            </div>

                            <p className="font-semibold text-slate-900 text-sm">
                              {item.titulo_tcc}
                            </p>

                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                              {item.apresentador_nome && (
                                <span>Apresentador: {item.apresentador_nome}</span>
                              )}
                              {item.horario_descricao && <span>• {item.horario_descricao}</span>}
                              {item.sala_nome && <span>• {item.sala_nome}</span>}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoverRegistro(item, 'inscricoes')}
                            className="p-1.5 text-slate-400 hover:text-red-600 shrink-0"
                            title="Remover inscrição nesta banca"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPessoaSelecionadaChave(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR ALUNO DE ÚLTIMA HORA */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Adicionar Espectador (Última Hora)
                </h2>
                <p className="text-xs text-slate-500">
                  Já registra o participante como presente e com selo de última hora
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarUltimaHora} className="space-y-4">
              <div>
                <Label>Apresentação (Banca) *</Label>
                <select
                  value={addForm.banca_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, banca_id: e.target.value }))}
                  required
                  className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione a apresentação...</option>
                  {bancas.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.titulo_tcc} ({b.apresentador_nome || 'Apresentador'} •{' '}
                      {b.horario_descricao || b.horario_data})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Tipo de Participante *</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, tipo: 'academico' }))}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${
                      addForm.tipo === 'academico'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Acadêmico
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, tipo: 'familiar' }))}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${
                      addForm.tipo === 'familiar'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Familiar / Amigo
                  </button>
                </div>
              </div>

              <div>
                <Label>Nome completo *</Label>
                <Input
                  value={addForm.nome}
                  onChange={(e) => setAddForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo do espectador"
                  required
                />
              </div>

              {addForm.tipo === 'academico' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Código do Aluno *</Label>
                    <Input
                      value={addForm.codigo_academico}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, codigo_academico: e.target.value }))
                      }
                      placeholder="Ex: 123456"
                      required
                    />
                  </div>
                  <div>
                    <Label>Semestre / Período</Label>
                    <Input
                      value={addForm.semestre}
                      onChange={(e) => setAddForm((f) => ({ ...f, semestre: e.target.value }))}
                      placeholder="Ex: 6º período"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Parentesco / Vínculo</Label>
                  <Input
                    value={addForm.parentesco}
                    onChange={(e) => setAddForm((f) => ({ ...f, parentesco: e.target.value }))}
                    placeholder="Ex: Mãe, Pai, Amigo(a)"
                  />
                </div>
              )}

              <div>
                <Label>
                  E-mail {addForm.tipo === 'familiar' ? '(opcional)' : '(para certificado)'}
                </Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoAdd}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {salvandoAdd ? 'Salvando...' : 'Confirmar Inclusão'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}