import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listarAgendaPublica } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Smartphone,
  UserPlus,
  ClipboardCheck,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function normalizarDataISO(valor) {
  const raw = String(valor || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  const matchBr = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (matchBr) {
    const [, dia, mes, ano] = matchBr;
    return `${ano}-${mes}-${dia}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatarDataCurtaBR(isoDate) {
  const norm = normalizarDataISO(isoDate);
  if (!norm) return '';
  const [ano, mes, dia] = norm.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function Home() {
  const navigate = useNavigate();

  const [evento, setEvento] = useState(null);
  const [bancas, setBancas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mesReferencia, setMesReferencia] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [bancasEscolhidasHome, setBancasEscolhidasHome] = useState([]);

  // Estado de instalação PWA ("Instalar no celular")
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [jaInstalado, setJaInstalado] = useState(false);
  const [mostrarAjudaInstalacao, setMostrarAjudaInstalacao] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator?.standalone === true;
    if (standalone) {
      setJaInstalado(true);
    }

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function onAppInstalled() {
      setJaInstalado(true);
      setDeferredPrompt(null);
      setMostrarAjudaInstalacao(false);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    async function carregarAgenda() {
      setLoading(true);
      try {
        const res = await listarAgendaPublica();
        const dados = res?.data;
        if (!dados || dados.error) return;

        setEvento(dados.evento || null);
        const listaBancas = dados.bancas || [];
        const listaHorarios = dados.horarios || [];
        setBancas(listaBancas);
        setHorarios(listaHorarios);

        const primeiraDataComBanca = listaBancas
          .map((b) => normalizarDataISO(b.horario_data || b.horario_descricao))
          .filter(Boolean)
          .sort()[0];

        const primeiraDataHorario = listaHorarios
          .map((h) => normalizarDataISO(h.data))
          .filter(Boolean)
          .sort()[0];

        const dataAlvo = primeiraDataComBanca || primeiraDataHorario || '';
        if (dataAlvo) {
          setDataSelecionada(dataAlvo);
          const [ano, mes] = dataAlvo.split('-').map(Number);
          setMesReferencia(new Date(ano, mes - 1, 1));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    carregarAgenda();
  }, []);

  async function handleInstalarApp() {
    if (jaInstalado) return;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setJaInstalado(true);
      }
      setDeferredPrompt(null);
      return;
    }
    setMostrarAjudaInstalacao((prev) => !prev);
  }

  const bancasPorData = useMemo(() => {
    const mapa = {};
    for (const b of bancas) {
      const iso = normalizarDataISO(b.horario_data || b.horario_descricao);
      if (!iso) continue;
      if (!mapa[iso]) mapa[iso] = [];
      mapa[iso].push(b);
    }
    return mapa;
  }, [bancas]);

  const diasCalendario = useMemo(() => {
    const ano = mesReferencia.getFullYear();
    const mes = mesReferencia.getMonth();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();

    const celulas = [];
    for (let i = 0; i < primeiroDiaSemana; i++) {
      celulas.push({ tipo: 'vazio', key: `empty-${i}` });
    }

    for (let dia = 1; dia <= ultimoDiaMes; dia++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const bancasDoDia = bancasPorData[iso] || [];
      celulas.push({
        tipo: 'dia',
        key: iso,
        dia,
        iso,
        bancas: bancasDoDia,
        temTcc: bancasDoDia.length > 0,
      });
    }

    return celulas;
  }, [mesReferencia, bancasPorData]);

const bancasDoDiaSelecionado = useMemo(() => {
    if (!dataSelecionada) return bancas;
    return bancasPorData[dataSelecionada] || [];
  }, [dataSelecionada, bancasPorData, bancas]);

  function alternarSelecaoBancaHome(bancaId) {
    setBancasEscolhidasHome((prev) =>
      prev.includes(bancaId) ? prev.filter((id) => id !== bancaId) : [...prev, bancaId]
    );
  }

  function irParaInscricaoComBancas() {
    if (bancasEscolhidasHome.length === 1) {
      navigate(`/inscricao/espectador?banca=${bancasEscolhidasHome[0]}`);
      return;
    }
    if (bancasEscolhidasHome.length > 1) {
      navigate(`/inscricao/espectador?banca=${bancasEscolhidasHome[0]}`);
      return;
    }
    navigate('/inscricao/espectador');
  }

  const tituloMes = mesReferencia.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* CABEÇALHO PRINCIPAL */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              <GraduationCap className="w-3.5 h-3.5" />
              Curso de Psicologia • Bancas de TCC
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              {evento?.nome_evento || 'Apresentações de TCC — Psicologia'}
            </h1>
            {evento?.local && (
              <p className="text-sm text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                {evento.local}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!jaInstalado && (
              <Button
                type="button"
                variant="outline"
                onClick={handleInstalarApp}
                className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Smartphone className="w-4 h-4" />
                Instalar no celular
              </Button>
            )}

            <Link to="/minha-inscricao">
              <Button variant="outline" className="gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Minha Inscrição
              </Button>
            </Link>

            <Link to="/login">
              <Button variant="secondary" className="gap-2">
                Área Restrita
              </Button>
            </Link>
          </div>
        </div>

        {/* AJUDA RÁPIA PARA INSTALAÇÃO QUANDO O NAVEGADOR NÃO EXIBE PROMPT AUTOMÁTICO */}
        {mostrarAjudaInstalacao && !jaInstalado && (
          <div className="bg-indigo-50 border-t border-indigo-100">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-start justify-between gap-4 text-xs sm:text-sm text-indigo-950">
              <div className="space-y-1">
                <p className="font-semibold">Como instalar no seu celular:</p>
                <p>
                  <strong>Android (Chrome):</strong> toque no menu de três pontos (⋮) e selecione{' '}
                  <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </p>
                <p>
                  <strong>iPhone / iPad (Safari):</strong> toque no botão de compartilhar (↑) e
                  selecione <strong>"Adicionar à Tela de Início"</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarAjudaInstalacao(false)}
                className="text-indigo-700 hover:text-indigo-950 p-1"
                aria-label="Fechar instruções"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* AÇÕES RÁPIDAS DE INSCRIÇÃO */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Quero Assistir às Bancas</h2>
              <p className="text-sm text-slate-600">
                Inscreva-se como acadêmico ou familiar/amigo e acompanhe os horários.
              </p>
            </div>
            <Link to="/inscricao/espectador" className="shrink-0">
              <Button className="gap-2 w-full sm:w-auto">
                <UserPlus className="w-4 h-4" />
                Inscrever-se
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Sou Apresentador(a) de TCC</h2>
              <p className="text-sm text-slate-600">
                Informe seu código de aluno para preencher seus dados e agendar sua banca.
              </p>
            </div>
            <Link to="/inscricao/apresentador" className="shrink-0">
              <Button variant="outline" className="gap-2 w-full sm:w-auto">
                <GraduationCap className="w-4 h-4" />
                Inscrição TCC
              </Button>
            </Link>
          </div>
        </section>

        {/* CALENDÁRIO INTERATIVO + BANCAS DO DIA */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CALENDÁRIO */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 capitalize flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-600" />
                {tituloMes}
              </h2>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setMesReferencia(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setMesReferencia(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {diasCalendario.map((celula) => {
                if (celula.tipo === 'vazio') {
                  return <div key={celula.key} className="h-11" />;
                }

                const selecionado = dataSelecionada === celula.iso;

                return (
                  <button
                    key={celula.key}
                    type="button"
                    onClick={() => setDataSelecionada(celula.iso)}
                    className={`h-11 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition relative ${
                      selecionado
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : celula.temTcc
                        ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
                        : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <span>{celula.dia}</span>
                    {celula.temTcc && (
                      <span
                        className={`text-[9px] leading-none mt-0.5 font-bold ${
                          selecionado ? 'text-indigo-100' : 'text-indigo-600'
                        }`}
                      >
                        {celula.bancas.length} TCC
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Dias com bancas de TCC
              </span>
              {dataSelecionada && (
                <button
                  type="button"
                  onClick={() => setDataSelecionada('')}
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Ver todos os dias
                </button>
              )}
            </div>
          </div>

          {/* BANCAS DO DIA SELECIONADO */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {dataSelecionada
                    ? `Bancas em ${formatarDataCurtaBR(dataSelecionada)}`
                    : 'Todas as Bancas Agendadas'}
                </h2>
                <p className="text-xs text-slate-500">
                  Clique nas bancas para marcar de interesse e avançar para a inscrição.
                </p>
              </div>

              {bancasEscolhidasHome.length > 0 && (
                <Button type="button" size="sm" onClick={irParaInscricaoComBancas} className="gap-1.5">
                  Inscrever nas selecionadas ({bancasEscolhidasHome.length})
                </Button>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-slate-500 py-6">Carregando agenda de bancas...</p>
            ) : bancasDoDiaSelecionado.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Nenhuma banca agendada para esta data.
                </p>
                <p className="text-xs text-slate-500">
                  Selecione outro dia destacado no calendário ou clique em "Ver todos os dias".
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bancasDoDiaSelecionado.map((banca) => {
                  const marcada = bancasEscolhidasHome.includes(banca.id);
                  const vagasRestantes = banca.vagas_restantes ?? banca.vagas_espectadores ?? 30;

                  return (
                    <div
                      key={banca.id}
                      onClick={() => alternarSelecaoBancaHome(banca.id)}
                      className={`rounded-xl border p-4 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        marcada
                          ? 'border-indigo-600 bg-indigo-50/70'
                          : 'border-slate-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-indigo-700">
                          {banca.horario_data && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              {banca.horario_data}
                            </span>
                          )}
                          {(banca.hora_inicio || banca.horario_descricao) && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {banca.hora_inicio && banca.hora_fim
                                ? `${banca.hora_inicio.slice(0, 5)} – ${banca.hora_fim.slice(0, 5)}`
                                : banca.horario_descricao}
                            </span>
                          )}
                          {banca.sala_nome && (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <MapPin className="w-3.5 h-3.5" />
                              {banca.sala_nome}
                            </span>
                          )}
                        </div>

                        <p className="font-semibold text-slate-900 text-sm">{banca.titulo_tcc}</p>
                        <p className="text-xs text-slate-600">
                          Apresentador(a): <strong>{banca.apresentador_nome || 'A definir'}</strong>
                          {banca.orientador_nome ? ` • Orient.: ${banca.orientador_nome}` : ''}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        <span className="text-xs text-slate-600 inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {vagasRestantes} vaga(s)
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                            marcada
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {marcada && <Check className="w-3.5 h-3.5" />}
                          {marcada ? 'Selecionada' : 'Marcar'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}