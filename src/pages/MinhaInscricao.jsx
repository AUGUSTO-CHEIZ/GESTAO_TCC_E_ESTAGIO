import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  consultarInscricaoComSenha,
  solicitarRecuperacaoSenha,
  redefinirSenhaInscricao,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  Search,
  Lock,
  KeyRound,
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function MinhaInscricao() {
  const [modo, setModo] = useState('consulta'); // 'consulta' | 'recuperar'
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [inscricoes, setInscricoes] = useState([]);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState('');

  // Estados de recuperação de senha
  const [recIdentificador, setRecIdentificador] = useState('');
  const [tokenRecuperacao, setTokenRecuperacao] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [codigoSolicitado, setCodigoSolicitado] = useState(false);
  const [avisoRecuperacao, setAvisoRecuperacao] = useState('');
  const [loadingRec, setLoadingRec] = useState(false);

  const { toast } = useToast();

  async function handleConsultar(e) {
    e.preventDefault();
    setErro('');
    setBuscou(false);

    const idLimpo = identificador.trim();
    const senhaLimpa = senha.trim();

    if (!idLimpo) {
      setErro('Informe seu e-mail ou código do aluno.');
      return;
    }

    if (!senhaLimpa) {
      setErro('Informe a senha definida no momento da inscrição.');
      return;
    }

    setLoading(true);
    try {
      const isEmail = idLimpo.includes('@');
      const res = await consultarInscricaoComSenha({
        email: isEmail ? idLimpo : '',
        codigo: !isEmail ? idLimpo : '',
        senha: senhaLimpa,
      });

      if (res?.data?.error) {
        setInscricoes([]);
        setErro(res.data.error);
        setBuscou(true);
        return;
      }

      setInscricoes(res?.data?.inscricoes || []);
      setBuscou(true);
    } catch (err) {
      setErro(err.message || 'Erro ao consultar inscrição.');
      setBuscou(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSolicitarCodigo(e) {
    e.preventDefault();
    setAvisoRecuperacao('');
    setErro('');

    const idLimpo = (recIdentificador || identificador).trim();
    if (!idLimpo) {
      setErro('Informe seu e-mail ou código cadastrado para receber o código de recuperação.');
      return;
    }

    setLoadingRec(true);
    try {
      const isEmail = idLimpo.includes('@');
      const res = await solicitarRecuperacaoSenha({
        email: isEmail ? idLimpo : '',
        codigo: !isEmail ? idLimpo : '',
      });

      if (res?.data?.error) {
        setErro(res.data.error);
        return;
      }

      setCodigoSolicitado(true);
      if (res?.data?.codigo_recuperacao) {
        setTokenRecuperacao(res.data.codigo_recuperacao);
      }
      setAvisoRecuperacao(
        res?.data?.mensagem ||
          'Código de recuperação gerado. Informe o código e defina sua nova senha abaixo.'
      );
      toast({
        title: 'Recuperação iniciada',
        description: res?.data?.mensagem || 'Verifique o código de recuperação.',
      });
    } catch (err) {
      setErro(err.message || 'Erro ao solicitar recuperação de senha.');
    } finally {
      setLoadingRec(false);
    }
  }

  async function handleRedefinirSenha(e) {
    e.preventDefault();
    setAvisoRecuperacao('');
    setErro('');

    const idLimpo = (recIdentificador || identificador).trim();
    if (!idLimpo) {
      setErro('Informe o e-mail ou código da inscrição.');
      return;
    }

    if (!novaSenha || novaSenha.trim().length < 4) {
      setErro('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setErro('A nova senha e a confirmação não coincidem.');
      return;
    }

    setLoadingRec(true);
    try {
      const isEmail = idLimpo.includes('@');
      const res = await redefinirSenhaInscricao({
        email: isEmail ? idLimpo : '',
        codigo: !isEmail ? idLimpo : '',
        token: tokenRecuperacao.trim(),
        novaSenha: novaSenha.trim(),
      });

      if (res?.data?.error) {
        setErro(res.data.error);
        return;
      }

      toast({
        title: 'Senha redefinida!',
        description: 'Agora você já pode consultar sua inscrição com a nova senha.',
      });

      setIdentificador(idLimpo);
      setSenha(novaSenha.trim());
      setNovaSenha('');
      setConfirmarNovaSenha('');
      setTokenRecuperacao('');
      setCodigoSolicitado(false);
      setAvisoRecuperacao('');
      setModo('consulta');
    } catch (err) {
      setErro(err.message || 'Erro ao redefinir senha.');
    } finally {
      setLoadingRec(false);
    }
  }
return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para a tela inicial
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Minha Inscrição</h1>
              <p className="text-sm text-slate-500 mt-1">
                Consulte suas apresentações e horários confirmados usando seu e-mail ou código e
                senha.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={modo === 'consulta' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setModo('consulta');
                  setErro('');
                }}
              >
                Consultar
              </Button>
              <Button
                type="button"
                variant={modo === 'recuperar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setModo('recuperar');
                  setErro('');
                  setAvisoRecuperacao('');
                  if (!recIdentificador && identificador) {
                    setRecIdentificador(identificador);
                  }
                }}
              >
                Recuperar senha
              </Button>
            </div>
          </div>

          {modo === 'consulta' ? (
            <form onSubmit={handleConsultar} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>E-mail ou Código do Aluno *</Label>
                  <Input
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="seu.email@unesc.net ou código"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="inline-flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-slate-500" /> Senha *
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setModo('recuperar');
                        setErro('');
                        if (!recIdentificador && identificador) {
                          setRecIdentificador(identificador);
                        }
                      }}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="gap-2">
                <Search className="w-4 h-4" />
                {loading ? 'Consultando...' : 'Consultar Inscrição'}
              </Button>
            </form>
          ) : (
            <div className="space-y-5 rounded-xl bg-slate-50 border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Recuperação de Senha</span>
              </div>

              <form onSubmit={handleSolicitarCodigo} className="space-y-3">
                <div>
                  <Label>E-mail ou Código cadastrado *</Label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Input
                      value={recIdentificador}
                      onChange={(e) => setRecIdentificador(e.target.value)}
                      placeholder="seu.email@unesc.net ou código"
                      required
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={loadingRec}
                      className="shrink-0"
                    >
                      {loadingRec ? 'Gerando...' : 'Enviar / Gerar código'}
                    </Button>
                  </div>
                </div>
              </form>

              {avisoRecuperacao && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{avisoRecuperacao}</span>
                </div>
              )}

              <form onSubmit={handleRedefinirSenha} className="space-y-3 pt-2 border-t border-slate-200">
                {codigoSolicitado && (
                  <div>
                    <Label>Código de recuperação (se recebido/exibido)</Label>
                    <Input
                      value={tokenRecuperacao}
                      onChange={(e) => setTokenRecuperacao(e.target.value)}
                      placeholder="Ex.: A1B2C3"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Nova senha *</Label>
                    <Input
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      required
                    />
                  </div>

                  <div>
                    <Label>Confirmar nova senha *</Label>
                    <Input
                      type="password"
                      value={confirmarNovaSenha}
                      onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loadingRec} className="gap-2">
                  <Lock className="w-4 h-4" />
                  {loadingRec ? 'Salvando nova senha...' : 'Salvar nova senha'}
                </Button>
              </form>
            </div>
          )}

          {erro && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {buscou && !erro && inscricoes.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma inscrição encontrada.</p>
          )}

          {inscricoes.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Inscrições Encontradas ({inscricoes.length})
              </h2>

              <div className="space-y-3">
                {inscricoes.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4 bg-white space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {item.titulo_tcc || item.banca_titulo || 'Apresentação de TCC'}
                      </p>
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        {item.tipo === 'apresentador'
                          ? 'Apresentador(a)'
                          : item.tipo === 'familiar'
                          ? 'Familiar / Amigo'
                          : 'Acadêmico(a)'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">
                      Participante: <strong>{item.nome}</strong>
                      {item.apresentador_nome ? ` • Apresentador(a): ${item.apresentador_nome}` : ''}
                    </p>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-1">
                      {item.horario_data && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          {item.horario_data}
                        </span>
                      )}
                      {item.horario_descricao && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          {item.horario_descricao}
                        </span>
                      )}
                      {item.sala_nome && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                          {item.sala_nome}
                        </span>
                      )}
                      {item.orientador_nome && (
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                          Orient.: {item.orientador_nome}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}