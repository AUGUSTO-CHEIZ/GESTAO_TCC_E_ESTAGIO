import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { obterSemestrePorData, arquivarSemestreAtual } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Archive,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  Users,
  GraduationCap,
  Calendar,
  RefreshCw,
} from 'lucide-react';

export default function AdminHistoricoSemestres() {
  const [arquivos, setArquivos] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arquivando, setArquivando] = useState(false);
  const [busca, setBusca] = useState('');
  const { toast } = useToast();

  const semAtual = obterSemestrePorData(new Date());

  async function load() {
    try {
      const { data, error } = await supabase
        .from('semestres_arquivados')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const lista = data || [];
      setArquivos(lista);
      if (lista.length > 0 && !selecionadoId) {
        setSelecionadoId(lista[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleEncerrarManual() {
    const confirmar = confirm(
      `Deseja encerrar e arquivar o semestre ${semAtual.codigo} agora?\n\nTodas as bancas, apresentadores, orientadores, avaliadores, presentes e ausentes serão salvos nesta aba e o sistema será zerado para o próximo semestre.`
    );
    if (!confirmar) return;

    setArquivando(true);
    try {
      const [ano, num] = semAtual.codigo.split('/');
      const proximoCodigo = num === '1' ? `${ano}/2` : `${Number(ano) + 1}/1`;

      const res = await arquivarSemestreAtual({
        semestreCodigo: semAtual.codigo,
        periodoDescricao: semAtual.periodo,
        novoSemestreCodigo: proximoCodigo,
        automatico: false,
      });

      if (res.data?.error) throw new Error(res.data.error);

      toast({
        title: `Semestre ${semAtual.codigo} arquivado!`,
        description: `${res.data.total_bancas} banca(s) salva(s) no histórico e sistema zerado.`,
      });
      setSelecionadoId(null);
      load();
    } catch (err) {
      toast({
        title: 'Erro ao arquivar semestre',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setArquivando(false);
    }
  }

  function exportarExcel(arquivo) {
    if (!arquivo) return;
    const linhas = [];

    (arquivo.dados_bancas || []).forEach((b) => {
      const presentesStr =
        (b.presentes || []).map((p) => `${p.nome} (${p.tipo})`).join('; ') || 'Nenhum';
      const ausentesStr =
        (b.ausentes || []).map((a) => `${a.nome} (${a.tipo})`).join('; ') || 'Nenhum';

      linhas.push({
        Semestre: arquivo.semestre_codigo,
        Apresentador: b.apresentador_nome,
        'Código Apresentador': b.apresentador_codigo || '',
        'Título do TCC': b.titulo_tcc,
        'Data / Horário': b.horario_descricao || b.horario_data || '',
        Sala: b.sala_nome || '',
        Orientador: b.orientador_nome,
        'Avaliador 1': b.avaliador1_nome,
        'Avaliador 2': b.avaliador2_nome,
        'Qtd. Presentes': (b.presentes || []).length,
        'Quem Viu (Presentes)': presentesStr,
        'Qtd. Ausentes': (b.ausentes || []).length,
        'Inscritos que Não Viram (Ausentes)': ausentesStr,
      });
    });

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Semestre_${arquivo.semestre_codigo.replace('/', '-')}`);
    XLSX.writeFile(wb, `Historico_TCC_${arquivo.semestre_codigo.replace('/', '_')}.xlsx`);
  }

  const arquivoAtual = arquivos.find((a) => a.id === selecionadoId) || arquivos[0] || null;
  const termo = busca.trim().toLowerCase();

  const bancasFiltradas = (arquivoAtual?.dados_bancas || []).filter((b) => {
    if (!termo) return true;
    const texto = [
      b.apresentador_nome,
      b.apresentador_codigo,
      b.titulo_tcc,
      b.orientador_nome,
      b.avaliador1_nome,
      b.avaliador2_nome,
      ...(b.presentes || []).map((p) => p.nome),
      ...(b.ausentes || []).map((a) => a.nome),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return texto.includes(termo);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Histórico Semestral</h1>
          <p className="text-sm text-slate-500">
            Ciclos automáticos: <strong>1º Semestre</strong> (01/02 a 15/07) e{' '}
            <strong>2º Semestre</strong> (16/07 a 15/12)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-800">
            Ciclo vigente: <strong>{semAtual.codigo}</strong> ({semAtual.periodo})
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={arquivando}
            onClick={handleEncerrarManual}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${arquivando ? 'animate-spin' : ''}`} />
            {arquivando ? 'Arquivando...' : 'Encerrar Semestre Agora'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : arquivos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
          <Archive className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-slate-800">Nenhum semestre arquivado ainda</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Quando o semestre encerrar (após 15/07 ou 15/12), todas as bancas, apresentadores,
            orientadores, avaliadores, presentes e ausentes ficarão guardados aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Seletor de Semestres Arquivados */}
          <div className="flex flex-wrap gap-2">
            {arquivos.map((arq) => {
              const ativo = arquivoAtual?.id === arq.id;
              return (
                <button
                  key={arq.id}
                  type="button"
                  onClick={() => setSelecionadoId(arq.id)}
                  className={`px-4 py-2.5 rounded-xl border text-left transition ${
                    ativo
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="font-bold text-sm">Semestre {arq.semestre_codigo}</div>
                  <div className={`text-xs ${ativo ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {arq.total_bancas} banca(s) • {arq.total_presentes} presente(s)
                  </div>
                </button>
              );
            })}
          </div>

          {arquivoAtual && (
            <div className="space-y-4">
              {/* Resumo e Exportação */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div>
                    <span className="text-slate-400 text-xs block">Semestre</span>
                    <strong className="text-slate-900">{arquivoAtual.semestre_codigo}</strong>
                    {arquivoAtual.periodo_descricao && (
                      <span className="text-slate-500 text-xs ml-1">
                        ({arquivoAtual.periodo_descricao})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs block">Bancas</span>
                    <strong className="text-slate-900">{arquivoAtual.total_bancas}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs block">Assistiram (Presentes)</span>
                    <strong className="text-green-600">{arquivoAtual.total_presentes}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs block">Inscritos que não viram</span>
                    <strong className="text-rose-600">{arquivoAtual.total_ausentes}</strong>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportarExcel(arquivoAtual)}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" /> Baixar Excel do Semestre
                </Button>
              </div>

              {/* Barra de Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar por apresentador, título do TCC, orientador, avaliador ou espectador..."
                  className="pl-9 bg-white"
                />
              </div>

              {/* Lista Detalhada de Bancas do Semestre */}
              {bancasFiltradas.length === 0 ? (
                <p className="text-center text-slate-400 py-8">
                  Nenhum registro encontrado para essa busca.
                </p>
              ) : (
                <div className="space-y-4">
                  {bancasFiltradas.map((b, idx) => (
                    <div
                      key={b.banca_id || idx}
                      className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
                    >
                      <div className="border-b border-slate-100 pb-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                          <span className="inline-flex items-center gap-1 font-medium text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                            <GraduationCap className="w-3.5 h-3.5" />
                            Apresentador: {b.apresentador_nome || 'Não informado'}
                            {b.apresentador_codigo ? ` (${b.apresentador_codigo})` : ''}
                          </span>
                          {(b.horario_descricao || b.horario_data) && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {b.horario_descricao || b.horario_data}
                            </span>
                          )}
                          {b.sala_nome && <span>• Sala: {b.sala_nome}</span>}
                        </div>

                        <h3 className="text-base font-bold text-slate-900">{b.titulo_tcc}</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                          <div>
                            <span className="text-slate-400 block">Orientador(a)</span>
                            <strong>{b.orientador_nome || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Avaliador 1</span>
                            <strong>{b.avaliador1_nome || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Avaliador 2</span>
                            <strong>{b.avaliador2_nome || '—'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Quem viu x Quem se inscreveu mas não viu */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-green-200 bg-green-50/40 p-3.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-800 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Quem viu ({(b.presentes || []).length})
                          </div>
                          {(b.presentes || []).length === 0 ? (
                            <p className="text-xs text-slate-400">Nenhum espectador presente.</p>
                          ) : (
                            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                              {b.presentes.map((p, i) => (
                                <li
                                  key={i}
                                  className="text-xs bg-white border border-green-100 rounded-lg px-2.5 py-1.5 flex justify-between items-center gap-2"
                                >
                                  <span className="font-medium text-slate-800">{p.nome}</span>
                                  <span className="text-[11px] text-slate-500 shrink-0">
                                    {p.tipo === 'academico'
                                      ? `Acadêmico${p.codigo_academico ? ` • ${p.codigo_academico}` : ''}`
                                      : 'Familiar/Amigo'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 mb-2">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            Inscritos que não viram ({(b.ausentes || []).length})
                          </div>
                          {(b.ausentes || []).length === 0 ? (
                            <p className="text-xs text-slate-400">Nenhum ausente registrado.</p>
                          ) : (
                            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                              {b.ausentes.map((a, i) => (
                                <li
                                  key={i}
                                  className="text-xs bg-white border border-rose-100 rounded-lg px-2.5 py-1.5 flex justify-between items-center gap-2"
                                >
                                  <div>
                                    <span className="font-medium text-slate-800 block">{a.nome}</span>
                                    {a.email && (
                                      <span className="text-[11px] text-slate-400">{a.email}</span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-rose-600 shrink-0">
                                    {a.tipo === 'academico' ? 'Acadêmico' : 'Familiar/Amigo'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}