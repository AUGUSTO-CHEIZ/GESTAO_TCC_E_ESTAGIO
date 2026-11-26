import { useState } from 'react';
import { Link } from 'react-router-dom';
import { consultarInscricao } from '@/lib/api';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import StatusBadge from '@/components/public/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Search, CheckCircle, XCircle, Calendar, MapPin, User, GraduationCap, Mail, FileText, Clock } from 'lucide-react';

export default function MinhaInscricao() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [inscricoes, setInscricoes] = useState(null);
  const [erro, setErro] = useState(null);
  const { toast } = useToast();

  async function handleConsultar(e) {
    e.preventDefault();
    if (!email) {
      toast({ title: 'E-mail obrigatório', description: 'Digite seu e-mail para consultar.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setErro(null);
    setInscricoes(null);
    try {
      const res = await consultarInscricao({ email });
      if (res.data?.error) {
        setErro(res.data.error);
      } else {
        setInscricoes(res.data.inscricoes || []);
      }
    } catch (e) {
      setErro(e.message || 'Erro ao consultar inscrição.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PublicHeader />
      <div className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Minha Inscrição</h1>
              <p className="text-slate-500 text-sm">Consulte sua inscrição usando seu e-mail — somente visualização</p>
            </div>
          </div>
          <form onSubmit={handleConsultar} className="flex gap-3 mb-6">
            <div className="flex-1">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Digite seu e-mail" />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Buscando...' : 'Consultar'}
            </Button>
          </form>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 text-sm">{erro}</p>
            </div>
          )}

          {inscricoes && inscricoes.length > 0 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-green-700 font-medium text-sm">
                  {inscricoes.length === 1 ? '1 inscrição encontrada' : `${inscricoes.length} inscrições encontradas`} para {email}
                </p>
              </div>
              {inscricoes.map((insc, idx) => (
                <InscricaoCard key={insc.id || idx} inscricao={insc} />
              ))}
            </div>
          )}

          {inscricoes && inscricoes.length === 0 && !erro && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-amber-700 text-sm">Nenhuma inscrição encontrada para este e-mail.</p>
            </div>
          )}

          {!inscricoes && !erro && !loading && (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Digite seu e-mail para consultar suas inscrições.</p>
            </div>
          )}
        </div>
        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-slate-500 hover:text-indigo-600">Voltar ao início</Link>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

function InscricaoCard({ inscricao }) {
  const isApresentador = inscricao.tipo === 'apresentador';
  const isAcademico = inscricao.tipo === 'academico';
  const isFamiliar = inscricao.tipo === 'familiar';
  const tipoLabel = isApresentador ? 'Apresentador' : isAcademico ? 'Acadêmico (Espectador)' : 'Familiar / Amigo';

  return (
    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
      <div className="p-4 bg-indigo-50 flex justify-between items-center">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tipo</span>
        <span className="font-semibold text-indigo-700">{tipoLabel}</span>
      </div>
      <InfoRow icon={User} label="Nome" value={inscricao.nome} />
      <InfoRow icon={Mail} label="E-mail" value={inscricao.email} />
      {(isApresentador || isAcademico) && inscricao.codigo_academico && (
        <InfoRow icon={GraduationCap} label="Código Acadêmico" value={inscricao.codigo_academico} />
      )}
      {isFamiliar && inscricao.parentesco && (
        <InfoRow icon={User} label="Grau de Parentesco" value={inscricao.parentesco} />
      )}
      {isApresentador ? (
        <>
          <InfoRow icon={FileText} label="Título do TCC" value={inscricao.titulo_tcc} />
          <InfoRow icon={User} label="Professor Orientador" value={inscricao.orientador_nome} />
          {inscricao.avaliador1_nome && <InfoRow icon={User} label="Avaliador 1" value={inscricao.avaliador1_nome} />}
          {inscricao.avaliador2_nome && <InfoRow icon={User} label="Avaliador 2" value={inscricao.avaliador2_nome} />}
          <InfoRow icon={Calendar} label="Data" value={inscricao.horario_data} />
          <InfoRow icon={Clock} label="Horário" value={inscricao.horario_descricao} />
          {inscricao.sala_nome && <InfoRow icon={MapPin} label="Sala" value={inscricao.sala_nome} />}
        </>
      ) : (
        <>
          <InfoRow icon={FileText} label="Banca / Título do TCC" value={inscricao.banca_titulo} />
          {inscricao.apresentador_nome && <InfoRow icon={User} label="Aluno que Apresentará" value={inscricao.apresentador_nome} />}
          <InfoRow icon={Calendar} label="Data" value={inscricao.horario_data} />
          <InfoRow icon={Clock} label="Horário" value={inscricao.horario_descricao} />
          {inscricao.sala_nome && <InfoRow icon={MapPin} label="Sala" value={inscricao.sala_nome} />}
          {inscricao.status && (
            <div className="p-4 flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status da Inscrição</span>
              <StatusBadge status={inscricao.status} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="p-4 flex justify-between items-center gap-4">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-sm text-slate-700 text-right">{value}</span>
    </div>
  );
}
