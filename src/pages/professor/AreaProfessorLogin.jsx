import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { verificarPrimeiroAcessoProfessor } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GraduationCap, Mail, Lock, ArrowLeft, KeyRound, Loader2 } from 'lucide-react';

export default function AreaProfessorLogin() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState('email'); // 'email' | 'primeiro_acesso' | 'login'
  const [email, setEmail] = useState('');
  const [nomeProfessor, setNomeProfessor] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (isAuthenticated && user?.role === 'professor') {
      navigate('/professor', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  async function handleVerificarEmail(e) {
    e.preventDefault();
    setErro('');
    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo) return;

    setLoading(true);
    try {
      const res = await verificarPrimeiroAcessoProfessor(emailLimpo);
      if (res.data?.error) throw new Error(res.data.error);

      if (!res.data?.cadastrado) {
        setErro('E-mail não encontrado no pré-cadastro de professores. Solicite à coordenação o cadastro do seu e-mail.');
        return;
      }
      if (res.data?.inativo) {
        setErro('Seu cadastro de professor está inativo. Entre em contato com a coordenação.');
        return;
      }

      setNomeProfessor(res.data.nome || 'Professor(a)');
      setEtapa(res.data.ja_possui_senha ? 'login' : 'primeiro_acesso');
    } catch (err) {
      setErro(err.message || 'Erro ao verificar e-mail.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDefinirSenha(e) {
    e.preventDefault();
    setErro('');
    if (password.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const emailLimpo = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: emailLimpo,
        password,
        options: {
          data: { full_name: nomeProfessor, role: 'professor' },
        },
      });
      if (error) throw error;

      if (!data.session) {
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: emailLimpo,
          password,
        });
        if (loginErr) throw loginErr;
      }

      window.location.href = '/professor';
    } catch (err) {
      setErro(err.message || 'Erro ao definir senha de primeiro acesso.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEntrar(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error('E-mail ou senha incorretos.');

      window.location.href = '/professor';
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-12">
      <div className="max-w-md w-full mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao início
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Área do Professor</h1>
              <p className="text-xs text-slate-500">Consulta de bancas e chamada em 2 etapas</p>
            </div>
          </div>

          {erro && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {erro}
            </div>
          )}

          {etapa === 'email' && (
            <form onSubmit={handleVerificarEmail} className="space-y-4">
              <div>
                <Label htmlFor="prof-email">E-mail cadastrado pela coordenação</Label>
                <div className="relative mt-1">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    id="prof-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="professor@instituicao.edu.br"
                    className="pl-9"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</> : 'Continuar'}
              </Button>
            </form>
          )}

          {etapa === 'primeiro_acesso' && (
            <form onSubmit={handleDefinirSenha} className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> Primeiro Acesso — Olá, {nomeProfessor}!
                </p>
                <p>Defina uma senha pessoal para acessar suas bancas e realizar as chamadas.</p>
              </div>

              <div>
                <Label>Nova Senha (mínimo 6 caracteres)</Label>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    type="password"
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label>Confirmar Senha</Label>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando senha...</> : 'Definir Senha e Entrar'}
              </Button>

              <button
                type="button"
                onClick={() => { setEtapa('email'); setPassword(''); setConfirmPassword(''); setErro(''); }}
                className="w-full text-xs text-slate-500 hover:text-indigo-600"
              >
                Usar outro e-mail
              </button>
            </form>
          )}

          {etapa === 'login' && (
            <form onSubmit={handleEntrar} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                Olá, <strong>{nomeProfessor}</strong> ({email})
              </div>

              <div>
                <Label>Sua Senha</Label>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    type="password"
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...</> : 'Entrar no Painel'}
              </Button>

              <button
                type="button"
                onClick={() => { setEtapa('email'); setPassword(''); setErro(''); }}
                className="w-full text-xs text-slate-500 hover:text-indigo-600"
              >
                Trocar e-mail
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}