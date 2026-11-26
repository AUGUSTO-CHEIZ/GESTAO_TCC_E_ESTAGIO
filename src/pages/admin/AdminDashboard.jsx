import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { verificarEAtualizarSemestre } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminProfessores from '@/components/admin/AdminProfessores';
import AdminBancas from '@/components/admin/AdminBancas';
import AdminHorarios from '@/components/admin/AdminHorarios';
import AdminPeriodoInscricao from '@/components/admin/AdminPeriodoInscricao';
import AdminSalas from '@/components/admin/AdminSalas';
import AdminInscricoes from '@/components/admin/AdminInscricoes';
import AdminHistoricoSemestres from '@/components/admin/AdminHistoricoSemestres';
import AdminConfiguracoes from '@/components/admin/AdminConfiguracoes';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  CalendarClock,
  DoorOpen,
  ClipboardList,
  Archive,
  Settings,
  LogOut,
  GraduationCap,
  Menu,
} from 'lucide-react';

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    async function checarViradaSemestre() {
      const res = await verificarEAtualizarSemestre();
      if (res.data?.resetado) {
        toast({
          title: `Novo semestre iniciado (${res.data.semestre_atual})`,
          description: `Os dados de ${res.data.semestre_anterior} foram salvos na aba Histórico Semestral.`,
        });
      }
    }
    checarViradaSemestre();
  }, [toast]);

  const tabs = [
    { id: 'overview', label: 'Painel', icon: LayoutDashboard },
    { id: 'professores', label: 'Professores', icon: Users },
    { id: 'bancas', label: 'Bancas', icon: FileText },
    { id: 'horarios', label: 'Horários', icon: Calendar },
    { id: 'periodo', label: 'Período de Inscrição', icon: CalendarClock },
    { id: 'salas', label: 'Salas', icon: DoorOpen },
    { id: 'inscricoes', label: 'Pessoas', icon: ClipboardList },
    { id: 'historico', label: 'Histórico Semestral', icon: Archive },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col transform transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Psicologia Unesc</p>
            <p className="text-xs text-slate-400">Administração</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">
              {(user?.full_name || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{user?.full_name || 'Administrador'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-slate-900">Painel Admin</span>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {tab === 'overview' && <AdminOverview />}
          {tab === 'professores' && <AdminProfessores />}
          {tab === 'bancas' && <AdminBancas />}
          {tab === 'horarios' && <AdminHorarios />}
          {tab === 'periodo' && <AdminPeriodoInscricao />}
          {tab === 'salas' && <AdminSalas />}
          {tab === 'inscricoes' && <AdminInscricoes />}
          {tab === 'historico' && <AdminHistoricoSemestres />}
          {tab === 'configuracoes' && <AdminConfiguracoes />}
        </main>
      </div>
    </div>
  );
}