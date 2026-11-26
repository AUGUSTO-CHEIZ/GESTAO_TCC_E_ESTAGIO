import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { vincularProfessorUsuario, confirmarPresenca } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import StatusBadge from '@/components/public/StatusBadge';
import ProfessorAddAluno from '@/components/professor/ProfessorAddAluno';
import { GraduationCap, LogOut, Users, UserPlus, CheckCircle, Circle, ChevronDown, ChevronUp, AlertCircle, Calendar, MapPin } from 'lucide-react';

export default function ProfessorDashboard() {
  const { user, logout } = useAuth();
  const [professor, setProfessor] = useState(null);
  const [bancas, setBancas] = useState([]);
  const [inscricoes, setInscricoes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bancaExpandida, setBancaExpandida] = useState(null);
  const [showAddForm, setShowAddForm] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    async function init() {
      try {
        const res = await vincularProfessorUsuario();
        if (res.data?.error) {
          setError(res.data.error);
          return;
        }
        setProfessor(res.data.professor);

        const { data: bancasData, error: bErr } = await supabase
          .from('bancas')
          .select('*')
          .or(`orientador_user_id.eq.${user.id},orientador_id.eq.${res.data.professor?.id || '00000000-0000-0000-0000-000000000000'}`)
          .order('horario_data', { ascending: true });

        if (bErr) throw bErr;
        const bancasList = bancasData || [];
        setBancas(bancasList);

        const inscMap = {};
        for (const banca of bancasList) {
          const { data: inscs } = await supabase
            .from('inscricoes')
            .select('*')
            .eq('banca_id', banca.id);
          inscMap[banca.id] = inscs || [];
        }
        setInscricoes(inscMap);
      } catch (e) {
        setError(e.message || 'Erro ao carregar dados do professor');
      } finally {
        setLoading(false);
      }
    }
    if (user?.id) {
      init();
    }
  }, [user?.id]);

  async function togglePresenca(inscricao) {
    try {
      const res = await confirmarPresenca({
        inscricao_id: inscricao.id,
        presente: !inscricao.presente,
      });
      if (res.data?.error) {
        toast({ title: 'Erro', description: res.data.error, variant: 'destructive' });
      } else {
        toast({ title: inscricao.presente ? 'Presença removida' : 'Presença confirmada' });
        setInscricoes((prev) => ({
          ...prev,
          [inscricao.banca_id]: (prev[inscricao.banca_id] || []).map((i) =>
            i.id === inscricao.id ? { ...i, presente: !i.presente } : i
          ),
        }));
      }
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  }

  async function refreshInscricoes(bancaId) {
    const { data: inscs } = await supabase
      .from('inscricoes')
      .select('*')
      .eq('banca_id', bancaId);
    setInscricoes((prev) => ({ ...prev, [bancaId]: inscs || [] }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso não autorizado</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={() => logout()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">Sair</button>
        </div>
      </div>
    );
  }

  const tipoLabels = { apresentador: 'Apresentador', academico: 'Acadêmico', familiar: 'Familiar' };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold">Minhas Bancas</p>
              <p className="text-xs text-slate-400">{professor?.nome || user?.full_name}</p>
            </div>
          </div>
          <button onClick={() => logout()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{bancas.length}</p>
            <p className="text-sm text-slate-500">Bancas</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {Object.values(inscricoes).flat().filter((i) => i.presente).length}
            </p>
            <p className="text-sm text-slate-500">Presenças confirmadas</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {Object.values(inscricoes).flat().length}
            </p>
            <p className="text-sm text-slate-500">Total de inscritos</p>
          </div>
        </div>

        {bancas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p>Nenhuma banca vinculada a você ainda.</p>
            <p className="text-sm">A organização do evento vinculará bancas ao seu perfil.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bancas.map((banca) => {
              const inscs = inscricoes[banca.id] || [];
              const presentes = inscs.filter((i) => i.presente).length;
              const expandida = bancaExpandida === banca.id;
              return (
                <div key={banca.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button onClick={() => setBancaExpandida(expandida ? null : banca.id)} className="w-full text-left p-5 hover:bg-slate-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{banca.titulo_tcc}</h3>
                          <StatusBadge status={banca.status} />
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                          {banca.horario_descricao && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {banca.horario_descricao}</span>}
                          {banca.horario_data && <span>{banca.horario_data}</span>}
                          {banca.sala_nome && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {banca.sala_nome}</span>}
                          {banca.apresentador_nome && <span>Apresentador: {banca.apresentador_nome}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{presentes}/{inscs.length} presentes</span>
                        {expandida ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </button>

                  {expandida && (
                    <div className="border-t border-slate-100 p-5">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium text-slate-700">Lista de Presença</h4>
                        <button
                          onClick={() => setShowAddForm(banca)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                        >
                          <UserPlus className="w-4 h-4" /> Adicionar Aluno
                        </button>
                      </div>
                      {inscs.length === 0 ? (
                        <p className="text-center text-slate-400 py-6 text-sm">Nenhuma inscrição para esta banca.</p>
                      ) : (
                        <div className="space-y-2">
                          {inscs.map((insc) => (
                            <div key={insc.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                              <div className="flex items-center gap-3">
                                <button onClick={() => togglePresenca(insc)} className="flex-shrink-0">
                                  {insc.presente ? <CheckCircle className="w-6 h-6 text-green-600" /> : <Circle className="w-6 h-6 text-slate-300" />}
                                </button>
                                <div>
                                  <p className="font-medium text-slate-900 text-sm">{insc.nome}</p>
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span className={`px-1.5 py-0.5 rounded ${
                                      insc.tipo === 'apresentador' ? 'bg-indigo-100 text-indigo-600'
                                      : insc.tipo === 'academico' ? 'bg-violet-100 text-violet-600'
                                      : 'bg-purple-100 text-purple-600'
                                    }`}>{tipoLabels[insc.tipo]}</span>
                                    {insc.inclusao_ultima_hora && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">Última hora</span>}
                                    <span>{insc.email}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showAddForm && (
        <ProfessorAddAluno
          banca={showAddForm}
          onClose={() => setShowAddForm(null)}
          onAdded={() => { refreshInscricoes(showAddForm.id); setShowAddForm(null); }}
        />
      )}
    </div>
  );
}
