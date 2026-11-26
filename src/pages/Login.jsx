import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { GraduationCap, ArrowLeft, Lock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (userId) {
        const { data: perfil } = await supabase
          .from('perfis')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (perfil?.role === 'admin') {
          navigate('/admin');
          return;
        }

        const { data: prof } = await supabase
          .from('professores')
          .select('id')
          .ilike('email', email.trim())
          .maybeSingle();

        if (perfil?.role === 'professor' || prof) {
          navigate('/professor');
          return;
        }
      }

      navigate('/');
    } catch (err) {
      toast({
        title: 'Falha no login',
        description:
          err.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos.'
            : err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao início
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Acesso Restrito</h1>
              <p className="text-xs text-slate-500">Coordenação e Professores</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@unesc.net"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Senha</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2">
              <Lock className="w-4 h-4" />
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}