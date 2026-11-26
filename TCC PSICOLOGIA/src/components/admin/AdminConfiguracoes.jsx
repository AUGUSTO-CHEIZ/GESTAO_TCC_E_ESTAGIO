import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

const defaultConfig = {
  nome_evento: '',
  descricao: '',
  data_inicio: '',
  data_fim: '',
  local: '',
  max_bancas_por_horario: 2,
  vagas_espectadores_padrao: 20,
  email_confirmacao_template: '',
};

export default function AdminConfiguracoes() {
  const [config, setConfig] = useState(defaultConfig);
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.from('configuracao_evento').select('*').limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
          setConfig({ ...defaultConfig, ...data[0] });
          setConfigId(data[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function update(field, value) { setConfig((c) => ({ ...c, [field]: value })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (configId) {
        const { error } = await supabase.from('configuracao_evento').update(config).eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('configuracao_evento').insert(config).select().single();
        if (error) throw error;
        if (data) setConfigId(data.id);
      }
      toast({ title: 'Configurações salvas com sucesso' });
    } catch (err) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Configurações do Evento</h1>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Informações Gerais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label>Nome do Evento</Label><Input value={config.nome_evento || ''} onChange={(e) => update('nome_evento', e.target.value)} placeholder="Ex: Bancas TCC 2025 - Psicologia" /></div>
            <div className="sm:col-span-2"><Label>Descrição</Label><Textarea value={config.descricao || ''} onChange={(e) => update('descricao', e.target.value)} rows={3} /></div>
            <div><Label>Data Início</Label><Input type="date" value={config.data_inicio || ''} onChange={(e) => update('data_inicio', e.target.value)} /></div>
            <div><Label>Data Fim</Label><Input type="date" value={config.data_fim || ''} onChange={(e) => update('data_fim', e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Local</Label><Input value={config.local || ''} onChange={(e) => update('local', e.target.value)} placeholder="Ex: UNESC - Bloco Administrativo" /></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Configurações de Capacidade</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Máx. Bancas por Horário</Label><Input type="number" value={config.max_bancas_por_horario || 2} onChange={(e) => update('max_bancas_por_horario', parseInt(e.target.value) || 2)} min={1} /></div>
            <div><Label>Vagas Espectadores (padrão)</Label><Input type="number" value={config.vagas_espectadores_padrao || 20} onChange={(e) => update('vagas_espectadores_padrao', parseInt(e.target.value) || 20)} min={0} /></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Template de E-mail de Confirmação</h2>
          <Textarea value={config.email_confirmacao_template || ''} onChange={(e) => update('email_confirmacao_template', e.target.value)} rows={6} placeholder="Olá {nome}, sua inscrição foi confirmada..." />
          <p className="text-xs text-slate-400 mt-2">Variáveis: {'{nome}'}, {'{email}'}, {'{tipo}'}, {'{banca_titulo}'}, {'{horario}'}, {'{sala}'}</p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
