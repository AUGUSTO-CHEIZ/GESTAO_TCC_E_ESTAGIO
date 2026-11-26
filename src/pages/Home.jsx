import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listarAgendaPublica } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import StatusBadge from '@/components/public/StatusBadge';
import { Calendar, MapPin, Users, GraduationCap, ArrowRight } from 'lucide-react';

const STATUS_BLOQUEADOS = [
  'realizada',
  'realizado',
  'cancelada',
  'cancelado',
  'pendente',
  'aguardando',
  'encerrada',
  'encerrado',
];

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

function formatarDataComDia(rawData) {
  const str = String(rawData || '').trim();
  if (!str) return '';

  let dia, mes, ano;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    [ano, mes, dia] = str.slice(0, 10).split('-').map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    [dia, mes, ano] = str.slice(0, 10).split('/').map(Number);
  } else {
    return str;
  }

  const dataLocal = new Date(ano, mes - 1, dia);
  if (Number.isNaN(dataLocal.getTime())) return str;

  const dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
  const diaSemana = DIAS_SEMANA[dataLocal.getDay()];
  return `${dataFormatada} / ${diaSemana}`;
}

function formatarHoraCurta(rawHora) {
  const str = String(rawHora || '').trim();
  if (!str) return '';
  return str.slice(0, 5);
}

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role === 'organizadora' ? 'admin' : user.role;
      if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (role === 'professor') {
        navigate('/professor', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await listarAgendaPublica();
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const evento = data?.evento;
  const horarios = data?.horarios || [];
  const todasBancas = data?.bancas || [];

  const bancasSelecionaveis = todasBancas.filter((b) => {
    const statusNorm = String(b.status || '').trim().toLowerCase();
    const bloqueado = STATUS_BLOQUEADOS.includes(statusNorm);
    const vagasRestantes = Number(b.vagas_restantes ?? 0);
    return !bloqueado && vagasRestantes > 0;
  });

  const bancasPorHorario = horarios
    .map((h) => ({
      ...h,
      bancas: bancasSelecionaveis.filter((b) => b.horario_id === h.id),
    }))
    .filter((h) => h.bancas.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />

      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <GraduationCap className="w-4 h-4" />
              <span className="text-sm font-medium">Curso de Psicologia</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {evento?.nome_evento || "Psicologia Unesc"}
            </h1>
            <p className="text-lg text-indigo-100 mb-8">
              {evento?.descricao || "Plataforma de gestão e acompanhamento das bancas de TCC e Estágios. Inscreva-se, acompanhe a agenda e consulte sua inscrição."}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/inscricao/apresentador" className="px-6 py-3 rounded-xl bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition shadow-lg">
                Inscrever como Apresentador
              </Link>
              <Link to="/inscricao/espectador" className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold hover:bg-white/20 transition">
                Inscrever como Espectador
              </Link>
              <Link to="/minha-inscricao" className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold hover:bg-white/20 transition">
                Minha Inscrição
              </Link>
            </div>
          </div>
          {evento && (evento.data_inicio || evento.local) && (
            <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm">
              {evento.data_inicio && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span>{evento.data_inicio}{evento.data_fim ? ` a ${evento.data_fim}` : ''}</span>
                </div>
              )}
              {evento.local && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <span>{evento.local}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Agenda das Bancas</h2>
          <p className="text-slate-500">Confira os horários e participe como espectador</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : bancasPorHorario.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400">Nenhuma banca disponível para inscrição no momento.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {bancasPorHorario.map((horario) => (
              <div key={horario.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatarDataComDia(horario.data) || horario.descricao}
                      </p>
                      <p className="text-sm text-slate-500">
                        {horario.hora_inicio && horario.hora_fim
                          ? `${formatarHoraCurta(horario.hora_inicio)} às ${formatarHoraCurta(horario.hora_fim)}`
                          : horario.descricao}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {horario.bancas.map((banca) => (
                    <div key={banca.id} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-slate-900 flex-1">{banca.titulo_tcc}</h3>
                        <StatusBadge status={banca.status} />
                      </div>
                      <div className="space-y-1.5 text-sm text-slate-600">
                        {banca.apresentador_nome && <p><span className="text-slate-400">Apresentador:</span> {banca.apresentador_nome}</p>}
                        {banca.orientador_nome && <p><span className="text-slate-400">Orientador:</span> {banca.orientador_nome}</p>}
                        {banca.sala_nome && <p><span className="text-slate-400">Sala:</span> {banca.sala_nome}</p>}
                        <p className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-slate-400" />
                          {banca.vagas_restantes} vagas restantes
                        </p>
                      </div>
                      <Link to={`/inscricao/espectador?banca=${banca.id}`} className="mt-4 inline-flex items-center gap-1 text-indigo-600 font-medium text-sm hover:text-indigo-700">
                        Inscrever-se <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <PublicFooter />
    </div>
  );
}