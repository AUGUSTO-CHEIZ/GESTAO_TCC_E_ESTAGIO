import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { obterSemestrePorData } from '@/lib/api';
import {
  FileText,
  LayoutGrid,
  Clock,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

const STATUS_LABEL = {
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  agendada: { label: 'Agendada', cls: 'bg-indigo-100 text-indigo-700' },
  aprovada: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  realizada: { label: 'Finalizada', cls: 'bg-slate-800 text-white' },
  finalizada: { label: 'Finalizada', cls: 'bg-slate-800 text-white' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
};

export default function AdminOverview() {
  const [bancas, setBancas] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [inscricoes, setInscricoes] = useState([]);
  const [semestreAtivo, setSemestreAtivo] = useState('');
  const [loading, setLoading] = useState(true);
  const [cardAtivo, setCardAtivo] = useState('total_bancas');

  useEffect(() => {
    async function carregarResumo() {
      try {
        const [bancasRes, profsRes, inscsRes, eventoRes] = await Promise.all([
          supabase.from('bancas').select('*').order('horario_data', { ascending: true }),
          supabase.from('professores').select('*').order('nome', { ascending: true }),
          supabase.from('inscricoes').select('*').order('created_at', { ascending: false }),
          supabase.from('configuracao_evento').select('semestre_atual').limit(1),
        ]);

        const semConfig = eventoRes.data?.[0]?.semestre_atual;
        const semAtual = semConfig || obterSemestrePorData(new Date());
        setSemestreAtivo(semAtual);

        setBancas(bancasRes.data || []);
        setProfessores(profsRes.data || []);
        setInscricoes(inscsRes.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    carregarResumo();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const profMap = Object.fromEntries(professores.map((p) => [p.id, p.nome]));

  // Filtra bancas ativas pertencentes ao semestre atual
  const bancasSemestre = bancas.filter((b) => {
    const statusNorm = String(b.status || '').trim().toLowerCase();
    if (statusNorm === 'cancelada') return false;

    const semBanca =
      b.semestre ||
      (b.horario_data ? obterSemestrePorData(b.horario_data) : '');
    if (!semBanca || !semestreAtivo) return true;
    return semBanca === semestreAtivo;
  });

  const bancasAgendadas = bancasSemestre.filter(
    (b) => String(b.status || '').trim().toLowerCase() === 'agendada'
  );

  const bancasPendentes = bancasSemestre.filter((b) => {
    const st = String(b.status || '').trim().toLowerCase();
    return st === 'pendente' || st === 'aguardando';
  });

  const cards = [
    {
      id: 'total_bancas',
      label: 'Total de Bancas',
      valor: bancasSemestre.length,
      icon: FileText,
      iconBg: 'bg-indigo-100 text-indigo-600',
      ring: 'border-indigo-500 ring-2 ring-indigo-500/20',
    },
    {
      id: 'agendadas',
      label: 'Bancas Agendadas',
      valor: bancasAgendadas.length,
      icon: LayoutGrid,
      iconBg: 'bg-sky-100 text-sky-600',
      ring: 'border-sky-500 ring-2 ring-sky-500/20',
    },
    {
      id: 'pendentes',
      label: 'Bancas Pendentes',
      valor: bancasPendentes.length,
      icon: Clock,
      iconBg: 'bg-amber-100 text-amber-600',
      ring: 'border-amber-500 ring-2 ring-amber-500/20',
    },
  ];

  const toggleCard = (id) => {
    setCardAtivo((prev) => (prev === id ? null : id));
  };

  const renderListaBancas = (lista, tituloSecao) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-base">{tituloSecao}</h2>
          <p className="text-xs text-slate-500">
            Resumo detalhado com código, apresentador, banca examinadora e vagas
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCardAtivo(null)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          title="Fechar resumo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400">
          Nenhuma banca encontrada nesta categoria no semestre {semestreAtivo}.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {lista.map((banca) => {
            const statusNorm = String(banca.status || '').trim().toLowerCase();
            const badge = STATUS_LABEL[statusNorm] || {
              label: banca.status || 'Agendada',
              cls: 'bg-slate-100 text-slate-700',
            };

            const totalVagas = Number(banca.vagas_espectadores || 30);
            const espectadoresOcupados = inscricoes.filter(
              (i) =>
                i.banca_id === banca.id &&
                (i.tipo === 'academico' || i.tipo === 'familiar')
            ).length;
            const vagasDisponiveis = Math.max(0, totalVagas - espectadoresOcupados);

            const av1 =
              banca.avaliador1_nome ||
              (banca.avaliador1_id ? profMap[banca.avaliador1_id] : '');
            const av2 =
              banca.avaliador2_tipo === 'externo'
                ? banca.avaliador2_externo_nome || banca.avaliador2_nome
                : banca.avaliador2_nome ||
                  (banca.avaliador2_id ? profMap[banca.avaliador2_id] : '');
            const avaliadoresTexto = [av1, av2].filter(Boolean).join(' • ') || 'Não definidos';

            return (
              <div key={banca.id} className="p-5 hover:bg-slate-50/70 transition space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>

                    {banca.apresentador_codigo && (
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                        Cód: {banca.apresentador_codigo}
                      </span>
                    )}

                    {banca.horario_descricao && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" /> {banca.horario_descricao}
                      </span>
                    )}

                    {banca.sala_nome && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5" /> {banca.sala_nome}
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      vagasDisponiveis > 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {vagasDisponiveis}/{totalVagas} disponíveis
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base">
                  {banca.titulo_tcc}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600 pt-0.5">
                  <p>
                    <span className="text-slate-400">Apresentador:</span>{' '}
                    <strong className="text-slate-800">
                      {banca.apresentador_nome || 'Não informado'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">Orientador:</span>{' '}
                    <strong className="text-slate-800">
                      {banca.orientador_nome || 'Não informado'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-400">Avaliadores:</span>{' '}
                    <strong className="text-slate-800">{avaliadoresTexto}</strong>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Painel Geral</h1>
          {semestreAtivo && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              Semestre {semestreAtivo}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">Clique em um cartão para ver o resumo</p>
      </div>

      {/* Cartões clicáveis (3 colunas) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const selecionado = cardAtivo === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => toggleCard(card.id)}
              className={`text-left bg-white rounded-2xl border p-5 shadow-sm transition hover:shadow-md flex flex-col justify-between ${
                selecionado ? card.ring : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {selecionado ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>

              <div>
                <p className="text-3xl font-bold text-slate-900">{card.valor}</p>
                <p className="text-xs text-slate-500 mt-1">{card.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Painel de detalhe conforme o cartão clicado */}
      {cardAtivo === 'total_bancas' &&
        renderListaBancas(
          bancasSemestre,
          `Todas as Bancas do Semestre (${bancasSemestre.length})`
        )}

      {cardAtivo === 'agendadas' &&
        renderListaBancas(
          bancasAgendadas,
          `Bancas Agendadas (${bancasAgendadas.length})`
        )}

      {cardAtivo === 'pendentes' &&
        renderListaBancas(
          bancasPendentes,
          `Bancas Pendentes de Aprovação (${bancasPendentes.length})`
        )}
    </div>
  );
}