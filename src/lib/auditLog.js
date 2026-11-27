import { supabase } from '@/lib/supabase';

/**
 * Grava uma ação imutável na tabela public.logs_auditoria.
 * Nunca lança exceção para não interromper o fluxo principal do sistema.
 */
export async function registrarLog({ acao, entidade, detalhes = '' }) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    let usuarioNome =
      user.user_metadata?.nome ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'Usuário';

    const { data: perfil } = await supabase
      .from('perfis')
      .select('nome')
      .eq('id', user.id)
      .maybeSingle();

    if (perfil?.nome) {
      usuarioNome = perfil.nome;
    }

    const { error } = await supabase.from('logs_auditoria').insert({
      usuario_id: user.id,
      usuario_nome: usuarioNome,
      usuario_email: user.email || '',
      acao: String(acao || 'AÇÃO').toUpperCase(),
      entidade: String(entidade || 'SISTEMA'),
      detalhes: String(detalhes || ''),
    });

    if (error) {
      console.warn('Não foi possível gravar log de auditoria:', error.message);
    }
  } catch (err) {
    console.warn('Erro inesperado ao gravar log de auditoria:', err);
  }
}

/**
 * Lista os registros de auditoria mais recentes (somente leitura).
 */
export async function listarLogsAuditoria(limite = 500) {
  const { data, error } = await supabase
    .from('logs_auditoria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data || [];
}