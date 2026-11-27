import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { listarLogsAuditoria } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Download,
  Clock,
  User,
} from 'lucide-react';

function formatarDataHora(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getBadgeAcao(acao) {
  const norm = String(acao || '').toUpperCase();
  if (norm.includes('APROV')) {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  if (norm.includes('REPROV') || norm.includes('EXCLU') || norm.includes('REMOV')) {
    return 'bg-rose-100 text-rose-800 border-rose-200';
  }
  if (norm.includes('CRI') || norm.includes('IMPORT') || norm.includes('ADICION')) {
    return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  }
  if (norm.includes('EDIT') || norm.includes('ATUALIZ') || norm.includes('ALTER')) {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('todos');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const lista = await Promise.race([
        listarLogsAuditoria(500),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tempo limite ao carregar logs.')), 12000)
        ),
      ]);
      setLogs(lista);
    } catch (err) {
      console.error(err);
      setErro(err.message || 'Não foi possível carregar os logs de auditoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const usuariosUnicos = Array.from(
    new Set(logs.map((l) => l.usuario_nome).filter(Boolean))
  );

  const termo = busca.trim().toLowerCase();
  const logsFiltrados = logs.filter((item) => {
    const matchUsuario =
      filtroUsuario === 'todos' || item.usuario_nome === filtroUsuario;
    if (!matchUsuario) return false;
    if (!termo) return true;

    const texto = [
      item.usuario_nome,
      item.usuario_email,
      item.acao,
      item.entidade,
      item.detalhes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return texto.includes(termo);
  });

  function exportarExcel() {
    if (logsFiltrados.length === 0) return;
    const linhas = logsFiltrados.map((l) => ({
      'Data e Hora': formatarDataHora(l.created_at),
      Usuário: l.usuario_nome || '—',
      'E-mail': l.usuario_email || '—',
      Ação: l.acao || '—',
      Área: l.entidade || '—',
      Detalhes: l.detalhes || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Logs_Auditoria');
    XLSX.writeFile(wb, `Logs_Auditoria_TCC_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Logs de Auditoria</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900 text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Registro imutável
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Histórico permanente de todas as alterações realizadas no sistema. Nenhum registro pode ser editado ou apagado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={carregar}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={exportarExcel}
            disabled={logsFiltrados.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por ação, aluno, banca, horário ou detalhes..."
            className="pl-9"
          />
        </div>

        <div>
          <select
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todos">Todos os perfis ({logs.length})</option>
            {usuariosUnicos.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : erro ? (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center space-y-3">
          <p className="text-sm font-medium text-red-700">{erro}</p>
          <Button type="button" variant="outline" onClick={carregar} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      ) : logsFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-500">
            Nenhum registro de log encontrado para os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Perfil</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Área</th>
                  <th className="py-3 px-4">O que foi feito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {logsFiltrados.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatarDataHora(log.created_at)}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-xs">
                            {log.usuario_nome || 'Usuário'}
                          </p>
                          {log.usuario_email && (
                            <p className="text-[11px] text-slate-400">{log.usuario_email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeAcao(
                          log.acao
                        )}`}
                      >
                        {log.acao}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs font-medium text-slate-700">
                      {log.entidade}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-md">
                      {log.detalhes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}