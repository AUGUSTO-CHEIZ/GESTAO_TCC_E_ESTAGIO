import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminProfessores from '@/components/admin/AdminProfessores';
import AdminBancas from '@/components/admin/AdminBancas';
import AdminHorarios from '@/components/admin/AdminHorarios';
import AdminSalas from '@/components/admin/AdminSalas';
import AdminInscricoes from '@/components/admin/AdminInscricoes';
import AdminConfiguracoes from '@/components/admin/AdminConfiguracoes';
import { LayoutDashboard, Users, FileText, Calendar, DoorOpen, ClipboardList, Settings, LogOut, GraduationCap, Menu } from 'lucide-react';

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const tabs = [
    { id: 'overview', label: 'Painel', icon: LayoutDashboard },
    { id: 'professores', label: 'Professores', icon: Users },
    { id: 'bancas', label: 'Bancas', icon: FileText },
    { id: 'horarios', label: 'Horários', icon: Calendar },
    { id: 'salas', label: 'Salas', icon: DoorOpen },
    { id: 'inscricoes', label: 'Inscrições', icon: ClipboardList },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform`}>
        <div className="p-6 flex-1">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Bancas TCC</p>
              <p className="text-xs text-slate-400">Painel Administrativo</p>
            </div>
          </div>
          <nav className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-medium">
              {(user?.full_name || 'A')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{user?.full_name || 'Admin'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={() => logout()} className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}><Menu className="w-6 h-6" /></button>
          <span className="font-bold text-slate-900">Painel Admin</span>
        </header>
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {tab === 'overview' && <AdminOverview />}
          {tab === 'professores' && <AdminProfessores />}
          {tab === 'bancas' && <AdminBancas />}
          {tab === 'horarios' && <AdminHorarios />}
          {tab === 'salas' && <AdminSalas />}
          {tab === 'inscricoes' && <AdminInscricoes />}
          {tab === 'configuracoes' && <AdminConfiguracoes />}
        </main>
      </div>
    </div>
  );
}
