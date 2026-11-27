import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listarAgendaPublica } from '@/lib/api';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import { Button } from '@/components/ui/button';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Smartphone,
  UserPlus,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ArrowRight,
  Sparkles,
  BookOpen,
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

function detectarMobileOuTablet() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  const isMobileUA =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|playbook|silk/i.test(
      ua
    );
  const isIpadOS =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isMobileUA || isIpadOS;
}

function formatarOrientadorComTitulacao(banca) {
  if (banca?.orientador_com_titulacao) return banca.orientador_com_titulacao;
  const nome = String(banca?.orientador_nome || '').trim();
  const tit = String(banca?.orientador_titulacao || '').trim();
  if (!nome) return '';
  if (!tit) return nome;
  if (nome.toLowerCase().startsWith(tit.toLowerCase())) return nome;
  return `${tit} ${nome}`;
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

  // Exibir botão de instalação APENAS em celulares e tablets
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(detectarMobileOuTablet);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [jaInstalado, setJaInstalado] = useState(false);
  const [mostrarAjudaInstalacao, setMostrarAjudaInstalacao] = useState(false);

  useEffect(() => {
    setIsMobileOrTablet(detectarMobileOuTablet());

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
    if (bancasEscolhidasHome.length > 0) {
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <PublicHeader />

      {/* HERO BANNER COM GRADIENTE MODERNO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-14 relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-white/15 backdrop-blur-sm text-indigo-50 px-3.5 py-1.5 rounded-full border border-white/20">
                <Sparkles className="w-3.5 h-3.5" />
                Curso de Psicologia • Unesc
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                {evento?.nome_evento || 'Bancas de TCC — Psicologia Unesc'}
              </h1>
              <p className="text-sm sm:text-base text-indigo-100 leading-relaxed">
                {evento?.descricao ||
                  'Confira a programação oficial das defesas de Trabalho de Conclusão de Curso, reserve sua vaga como espectador ou agende sua apresentação.'}
              </p>
              {evento?.local && (
                <p className="text-xs sm:text-sm text-indigo-100 inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                  <MapPin className="w-4 h-4 shrink-0 text-indigo-200" />
                  {evento.local}
                </p>
              )}
            </div>

            {/* BOTÃO INSTALAR NO CELULAR — VISÍVEL APENAS EM MOBILE E TABLET */}
            {isMobileOrTablet && !jaInstalado && (
              <div className="shrink-0">
                <Button
                  type="button"
                  onClick={handleInstalarApp}
                  className="w-full sm:w-auto bg-white text-indigo-700 hover:bg-indigo-50 font-semibold shadow-lg gap-2 h-11 px-5 rounded-xl"
                >
                  <Smartphone className="w-4 h-4" />
                  Instalar no celular
                </Button>
              </div>
            )}
          </div>

          {isMobileOrTablet && mostrarAjudaInstalacao && !jaInstalado && (
            <div className="mt-5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-4 flex items-start justify-between gap-4 text-xs sm:text-sm text-white">
              <div className="space-y-1">
                <p className="font-bold">Como adicionar à tela inicial:</p>
                <p>
                  <strong>Android (Chrome):</strong> toque no menu (⋮) e escolha{' '}
                  <strong>"Instalar aplicativo"</strong> ou{' '}
                  <strong>"Adicionar à tela inicial"</strong>.
                </p>
                <p>
                  <strong>iPhone / iPad (Safari):</strong> toque em compartilhar (↑) e escolha{' '}
                  <strong>"Adicionar à Tela de Início"</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarAjudaInstalacao(false)}
                className="text-white/80 hover:text-white p-1"
                aria-label="Fechar instruções"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-12 space-y-8 relative z-10">
        {/* CARTÕES PRINCIPAIS DE AÇÃO */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <UserPlus className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Quero Assistir às Bancas
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Inscreva-se como acadêmico ou familiar/amigo para acompanhar as apresentações e
                  garantir sua vaga.
                </p>
              </div>
            </div>
            <Link to="/inscricao/espectador" className="block">
              <Button className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 shadow-sm">
                Inscrever-se como Espectador
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Sou Apresentador(a) de TCC
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Informe seu código de aluno para confirmar seus dados, banca examinadora e
                  agendar seu horário.
                </p>
              </div>
            </div>
            <Link to="/inscricao/apresentador" className="block">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold gap-2"
              >
                Inscrição de Apresentador (TCC)
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* CALENDÁRIO INTERATIVO + PROGRAMAÇÃO DO DIA */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CALENDÁRIO MENSAL */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                {tituloMes}
              </h2>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
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
                  className="h-9 w-9 rounded-lg"
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

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 tracking-wide">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-1.5">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {diasCalendario.map((celula) => {
                if (celula.tipo === 'vazio') {
                  return <div key={celula.key} className="h-12" />;
                }

                const selecionado = dataSelecionada === celula.iso;

                return (
                  <button
                    key={celula.key}
                    type="button"
                    onClick={() => setDataSelecionada(celula.iso)}
                    className={`h-12 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                      selecionado
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                        : celula.temTcc
                        ? 'bg-indigo-50/90 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
                        : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>{celula.dia}</span>
                    {celula.temTcc && (
                      <span
                        className={`text-[9px] leading-none mt-1 font-bold px-1.5 py-0.5 rounded-full ${
                          selecionado
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-600/10 text-indigo-700'
                        }`}
                      >
                        {celula.bancas.length} TCC
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                Dias com bancas de TCC
              </span>
              {dataSelecionada && (
                <button
                  type="button"
                  onClick={() => setDataSelecionada('')}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Ver todos os dias
                </button>
              )}
            </div>
          </div>

          {/* LISTA DE BANCAS DO DIA */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  {dataSelecionada
                    ? `Bancas em ${formatarDataCurtaBR(dataSelecionada)}`
                    : 'Todas as Bancas Agendadas'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toque nas bancas para marcar interesse e avançar para a inscrição.
                </p>
              </div>

              {bancasEscolhidasHome.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={irParaInscricaoComBancas}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 rounded-xl"
                >
                  Inscrever nas selecionadas ({bancasEscolhidasHome.length})
                </Button>
              )}
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm">Carregando programação...</p>
              </div>
            ) : bancasDoDiaSelecionado.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2 bg-slate-50/60">
                <p className="text-sm font-semibold text-slate-700">
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
                  const orientadorComTitulacao = formatarOrientadorComTitulacao(banca);

                  return (
                    <div
                      key={banca.id}
                      onClick={() => alternarSelecaoBancaHome(banca.id)}
                      className={`rounded-2xl border p-4 sm:p-5 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        marcada
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60 bg-white'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          {banca.horario_data && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              {formatarDataCurtaBR(banca.horario_data) || banca.horario_data}
                            </span>
                          )}
                          {(banca.hora_inicio || banca.horario_descricao) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700">
                              <Clock className="w-3.5 h-3.5" />
                              {banca.hora_inicio && banca.hora_fim
                                ? `${banca.hora_inicio.slice(0, 5)} – ${banca.hora_fim.slice(0, 5)}`
                                : banca.horario_descricao}
                            </span>
                          )}
                          {banca.sala_nome && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                              <MapPin className="w-3.5 h-3.5" />
                              {banca.sala_nome}
                            </span>
                          )}
                        </div>

                        <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                          {banca.titulo_tcc}
                        </p>

                        <div className="text-xs sm:text-sm text-slate-600 space-y-0.5">
                          <p>
                            Apresentador(a):{' '}
                            <strong className="text-slate-800">
                              {banca.apresentador_nome || 'A definir'}
                            </strong>
                          </p>
                          {orientadorComTitulacao && (
                            <p>
                              Orient.:{' '}
                              <strong className="text-indigo-900">{orientadorComTitulacao}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        <span className="text-xs font-medium text-slate-600 inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          {vagasRestantes} vaga(s)
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                            marcada
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-700'
                          }`}
                        >
                          {marcada && <Check className="w-3.5 h-3.5" />}
                          {marcada ? 'Marcado' : 'Marcar'}
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

      <PublicFooter />
    </div>
  );
}