import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 1. Autentica no Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;

      if (!data?.user) {
        throw new Error("Usuário não retornado após autenticação.");
      }

      // 2. Busca o papel (role) diretamente em public.perfis
      let userRole = data.user.user_metadata?.role || "user";
      try {
        const { data: profile } = await supabase
          .from("perfis")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.role) {
          userRole = profile.role;
        }
      } catch (err) {
        console.warn("Não foi possível consultar perfil imediatamente:", err);
      }

      // Unifica 'organizadora' para 'admin'
      if (userRole === "organizadora") userRole = "admin";

      // 3. Determina o redirecionamento prioritário sem recarregar a página
      let targetUrl = "/";
      if (returnTo && returnTo !== "/") {
        targetUrl = returnTo;
      } else if (userRole === "admin") {
        targetUrl = "/admin";
      } else if (userRole === "professor") {
        targetUrl = "/professor";
      }

      navigate(targetUrl, { replace: true });
    } catch (err) {
      setError(err.message || "E-mail ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + (returnTo && returnTo !== "/" ? returnTo : "/admin"),
      },
    });
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Bem-vindo"
      subtitle="Acesso restrito à organização e professores"
      footer={<Link to="/" className="text-primary font-medium hover:underline">Voltar ao início</Link>}
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" /> Continuar com Google
      </Button>
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">ou</span>
        </div>
      </div>
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueceu a senha?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</> : "Entrar"}
        </Button>
      </form>
    </AuthLayout>
  );
}