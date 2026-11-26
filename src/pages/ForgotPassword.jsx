import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast({
        title: 'Erro ao enviar e-mail',
        description: err.message,
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
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o login
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">E-mail enviado!</h2>
              <p className="text-sm text-slate-600">
                Enviamos um link de redefinição de senha para <strong>{email}</strong>. Verifique
                sua caixa de entrada e a pasta de spam.
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full mt-2">
                  Voltar ao Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Recuperar Senha</h1>
                  <p className="text-xs text-slate-500">
                    Para Administração e Professores cadastrados
                  </p>
                </div>
              </div>

              <div>
                <Label>E-mail cadastrado *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@unesc.net"
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Enviando link...' : 'Enviar link de recuperação'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}