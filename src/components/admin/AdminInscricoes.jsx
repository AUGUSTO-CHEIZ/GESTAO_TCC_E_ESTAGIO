import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Search,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  GraduationCap,
} from 'lucide-react';

export default function AdminInscricoes() {
  const [bancas, setBancas] = useState([]);
  const [inscricoes, setInscricoes] = useState([]);
  const [ausentesHistorico, setAusentesHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const { toast } = useToast();

  async function load() {
    try {
      const [bRes, iRes, aRes] = await Promise.all([
        supabase
          .from('bancas')
          .select('*')
          .neq('status', 'cancelada')
          .order('horario_data', { ascending: true }),
        supabase
          .from('inscricoes')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('inscricoes_ausentes')
          .select('*')
          .order('created_at', { ascending: true }),
      ]);

      if (bRes.error) throw bRes.error;
      setBancas(bRes.data || []);
      setInscricoes(iRes.data || []);
      setAusentesHistorico(aRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDeleteInscricao(id) {
    if (!confirm('Remover espectador inscrito?')) return;
    try {
      const { error } = await supabase.from('inscricoes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Inscrição removida' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  const tipoLabel = {
    academico: 'Acadêmico',
    familiar: 'Familiar / Amigo',
  };

  const termo = search.trim().toLowerCase();

  const bancasFiltradas = bancas.filter((b) => {
    if (!termo) return true;
    const inscritosDaBanca = inscricoes.filter((i) => i.banca_id === b.id);
    const ausentesDaBanca = ausentesHistorico.filter((a) => a.banca_id === b.id);

    const textoBusca = [
      b.titulo_tcc,
      b.apresentador_nome,
      b.orientador_nome,
      b.sala_nome,
      ...inscritosDaBanca.map((i) => `${i.nome} ${i.email || ''} ${i.codigo_academico || ''}`),
      ...ausentesDaBanca.map((a) => `${a.nome} ${a.email || ''} ${a.codigo_academico || ''}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return textoBusca.includes(termo);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pessoas</h1>
          <p className="text-sm text-slate-500">
            Clique em uma apresentação para ver os espectadores inscritos ou o resultado da chamada
          </p>
        </div>
        <span className="text-sm text-slate-500">{bancasFiltradas.length} apresentação(ões)</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por apresentação, apresentador ou nome/e-mail do espectador..."
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : bancasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          Nenhuma apresentação encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {bancasFiltradas.map((banca) => {
            const jaAconteceu =
              banca.status === 'realizada' || Boolean(banca.chamada2_concluida);
            const aberta = expandedId === banca.id;

            const espectadoresAtivos = inscricoes.filter(
              (i) => i.banca_id === banca.id && i.tipo !== 'apresentador'
            );

            // Dados para bancas já realizadas
            const presentes = espectadoresAtivos.filter(
              (i) => i.presente || i.presente_chamada1 || i.presente_chamada2
            );

            const ausentesNaoConfirmados = espectadoresAtivos
              .filter(
                (i) => !i.presente && !i.presente_chamada1 && !i.presente_chamada2
              )
              .map((i) => ({
                id: i.id,
                nome: i.nome,
                email: i.email || '',
                codigo_academico: i.codigo_academico || '',
                tipo: i.tipo,
                etapa_falta: 'Não compareceu',
              }));

            const ausentesDaChamada1 = ausentesHistorico
              .filter((a) => a.banca_id === banca.id)
              .map((a) => ({
                id: a.id,
                nome: a.nome,
                email: a.email || '',
                codigo_academico: a.codigo_academico || '',
                tipo: a.tipo,
                etapa_falta: a.etapa_falta || '1ª Chamada',
              }));

            const ausentesTotais = Array.from(
              new Map(
                [...ausentesDaChamada1, ...ausentesNaoConfirmados].map((item) => [
                  `${item.nome.toLowerCase()}|${item.email.toLowerCase()}|${item.codigo_academico}`,
                  item,
                ])
              ).values()
            );

            return (
              <div
                key={banca.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(aberta ? null : banca.id)}
                  className="w-full text-left p-5 hover:bg-slate-50/80 transition flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          jaAconteceu
                            ? 'bg-slate-800 text-white'
                            : banca.status === 'aprovada'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {jaAconteceu
                          ? 'Realizada (Chamada Encerrada)'
                          : banca.status === 'aprovada'
                          ? 'Aprovada (Aguardando Apresentação)'
                          : 'Pendente de Aprovação'}
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

                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                      Apresentador: <strong>{banca.apresentador_nome || 'Não informado'}</strong>
                      {banca.orientador_nome ? ` • Orientador: ${banca.orientador_nome}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {jaAconteceu ? (
                      <div className="text-right text-xs">
                        <span className="text-green-600 font-semibold block">
                          {presentes.length} presente(s)
                        </span>
                        <span className="text-rose-600 font-medium">
                          {ausentesTotais.length} ausente(s)
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
                        <Users className="w-3.5 h-3.5" />
                        {espectadoresAtivos.length} espectador(es)
                      </span>
                    )}

                    {aberta ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {aberta && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                    {jaAconteceu ? (
                      /* APRESENTAÇÃO JÁ REALIZADA -> MOSTRA PRESENTES E AUSENTES */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl border border-green-200 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Presentes na Chamada ({presentes.length})
                          </div>

                          {presentes.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">
                              Nenhum espectador presente registrado.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {presentes.map((p) => (
                                <li
                                  key={p.id}
                                  className="text-xs border border-green-100 bg-green-50/40 rounded-lg p-2.5 flex justify-between items-center gap-2"
                                >
                                  <div>
                                    <p className="font-semibold text-slate-900">{p.nome}</p>
                                    <p className="text-slate-500">
                                      {tipoLabel[p.tipo] || p.tipo}
                                      {p.codigo_academico ? ` • Cód: ${p.codigo_academico}` : ''}
                                      {p.email ? ` • ${p.email}` : ''}
                                    </p>
                                  </div>
                                  {p.inclusao_ultima_hora && (
                                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-[11px] font-medium shrink-0">
                                      Última hora
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="bg-white rounded-xl border border-rose-200 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            Ausentes ({ausentesTotais.length})
                          </div>

                          {ausentesTotais.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">
                              Nenhum espectador ausente nesta apresentação.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {ausentesTotais.map((a, idx) => (
                                <li
                                  key={a.id || idx}
                                  className="text-xs border border-rose-100 bg-rose-50/40 rounded-lg p-2.5 flex justify-between items-center gap-2"
                                >
                                  <div>
                                    <p className="font-semibold text-slate-900">{a.nome}</p>
                                    <p className="text-slate-500">
                                      {tipoLabel[a.tipo] || a.tipo}
                                      {a.codigo_academico ? ` • Cód: ${a.codigo_academico}` : ''}
                                      {a.email ? ` • ${a.email}` : ''}
                                    </p>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[11px] font-medium shrink-0">
                                    {a.etapa_falta}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* APRESENTAÇÃO AINDA NÃO ACONTECEU -> MOSTRA APENAS ESPECTADORES INSCRITOS */
                      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-600" />
                            Espectadores Inscritos ({espectadoresAtivos.length})
                          </h4>
                          <span className="text-xs text-slate-400">
                            A chamada será exibida após a realização da banca
                          </span>
                        </div>

                        {espectadoresAtivos.length === 0 ? (
                          <p className="text-xs text-slate-400 py-3">
                            Nenhum espectador inscrito nesta apresentação até o momento.
                          </p>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {espectadoresAtivos.map((esp) => (
                              <div
                                key={esp.id}
                                className="py-2.5 flex items-center justify-between gap-3 text-xs"
                              >
                                <div>
                                  <p className="font-semibold text-slate-900">{esp.nome}</p>
                                  <p className="text-slate-500">
                                    <span className="font-medium text-indigo-600">
                                      {tipoLabel[esp.tipo] || esp.tipo}
                                    </span>
                                    {esp.codigo_academico ? ` • Cód: ${esp.codigo_academico}` : ''}
                                    {esp.parentesco ? ` • ${esp.parentesco}` : ''}
                                    {esp.email ? ` • ${esp.email}` : ''}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInscricao(esp.id)}
                                  title="Remover espectador"
                                  className="p-1.5 text-slate-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}