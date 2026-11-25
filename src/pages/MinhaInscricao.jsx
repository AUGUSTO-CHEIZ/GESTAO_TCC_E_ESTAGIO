import { useState } from 'react';
import { Link } from 'react-router-dom';
import { consultarInscricao } from '@/lib/api';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import StatusBadge from '@/components/public/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, ArrowLeft, Calendar, MapPin, User, Users, CheckCircle2, Clock } from 'lucide-react';

const tipoLabel = {
  apresentador: 'Apresentador(a)',
  academico: 'Espectador Acadêmico',
  familiar: 'Familiar / Amigo',
};

function formatarData(iso) {
  if (!iso) return '';
  return iso.includes('-') ? iso.split('-').reverse().join('/') : iso;
}

export default function MinhaInscricao() {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [resultados, setResultados] = useState([]);

  async function handleConsultar(e) {
    e.preventDefault();
    setErro('');
    setResultados([]);
    if (!codigo.trim()) {
      setErro('Informe seu código acadêmico.');
      return;
    }

    setLoading(true);
    try {
      const res = await consultarInscricao({ codigo });
      if (res.data?.error) {
        setErro(res.data.error);
      } else {
        setResultados(res.data?.inscricoes || []);
      }
    } catch (err) {
      setErro(err.message || 'Erro ao consultar inscrição.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <div className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Consultar Minha Inscrição</h1>
          <p className="text-slate-500 text-sm mb-6">
            Digite seu código do aluno para visualizar suas apresentações ou bancas inscritas.
          </p>

          <form onSubmit={handleConsultar} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="codigo" className="sr-only">Código do Aluno</Label>
              <Input
                id="codigo"
                type="text"
                autoComplete="off"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Digite seu código do aluno"
              />
            </div>
            <Button type="submit" disabled={loading} className="gap-2">
              <Search className="w-4 h-4" />
              {loading ? 'Buscando...' : 'Consultar'}
            </Button>
          </form>

          {erro && (
            <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {erro}
            </div>
          )}

          {resultados.length > 0 && (
            <div className="mt-6 space-y-4">
              <p className="text-sm font-medium text-slate-600">
                {resultados.length} inscrição(ões) encontrada(s) para o código <strong>{codigo.trim()}</strong>:
              </p>

              {resultados.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                      {tipoLabel[item.tipo] || item.tipo}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.presente ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Presença confirmada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-200/70 px-2.5 py-0.5 rounded-full">
                          <Clock className="w-3.5 h-3.5" /> Aguardando chamada
                        </span>
                      )}
                      {item.status && <StatusBadge status={item.status} />}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">{item.titulo_tcc || item.banca_titulo}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Inscrito(a): <strong>{item.nome}</strong></p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                    {item.horario_data && (
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{formatarData(item.horario_data)} • {item.horario_descricao}</span>
                      </p>
                    )}
                    {item.sala_nome && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{item.sala_nome}</span>
                      </p>
                    )}
                    {item.apresentador_nome && item.tipo !== 'apresentador' && (
                      <p className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Apresentador(a): {item.apresentador_nome}</span>
                      </p>
                    )}
                    {item.orientador_nome && (
                      <p className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Orientador(a): {item.orientador_nome}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}