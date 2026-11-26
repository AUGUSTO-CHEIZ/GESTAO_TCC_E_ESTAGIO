import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { verificarPrazoApresentador } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { CalendarClock, CheckCircle2, Lock, Save, RotateCcw } from 'lucide-react';

export default function AdminPeriodoInscricao() {
  const [configId, setConfigId] = useState(null);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [inscricoesAbertas, setInscricoesAbertas] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function load() {
    try {
      const { data, error } = await supabase
        .from('configuracao_evento')
        .select('*')
        .limit(1);

      if (error) throw error;
      const cfg = data?.[0];
      if (cfg) {
        setConfigId(cfg.id);
        setInicio(cfg.inscricao_apresentador_inicio || '');
        setFim(cfg.inscricao_apresentador_fim || '');
        setInscricoesAbertas(cfg.inscricoes_abertas !== false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (inicio && fim && inicio > fim) {
      toast({
        title: 'Datas inválidas',
        description: 'A data inicial não pode ser maior que a data final.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        inscricao_apresentador_inicio: inicio || null,
        inscricao_apresentador_fim: fim || null,
        inscricoes_abertas: inscricoesAbertas,
      };

      if (configId) {
        const { error } = await supabase
          .from('configuracao_evento')
          .update(payload)
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('configuracao_evento')
          .insert({
            nome_evento: 'Bancas de TCC - Psicologia Unesc',
            ...payload,
          })
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }

      toast({
        title: 'Período atualizado!',
        description: 'As regras de data para apresentadores e espectadores já estão valendo.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar período',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const statusAtual = verificarPrazoApresentador({
    inscricoes_abertas: inscricoesAbertas,
    inscricao_apresentador_inicio: inicio,
    inscricao_apresentador_fim: fim,
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Período de Inscrição</h1>
        <p className="text-sm text-slate-500">
          Defina os dias em que os apresentadores podem escolher horário. Fora desse intervalo, o
          sistema fica aberto apenas para inscrição de espectadores.
        </p>
      </div>

      {/* Cartão de Status Atual */}
      <div
        className={`rounded-2xl border p-4 flex items-start gap-3 ${
          statusAtual.aberto
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        {statusAtual.aberto ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="text-sm">
          <p className="font-semibold">
            {statusAtual.aberto
              ? 'Apresentadores: Inscrições Liberadas Hoje'
              : 'Apresentadores: Bloqueado (Apenas Espectadores)'}
          </p>
          <p className="text-xs mt-0.5 opacity-90">
            {statusAtual.aberto
              ? inicio || fim
                ? `Janela configurada: ${inicio ? inicio.split('-').reverse().join('/') : 'início imediato'} até ${fim ? fim.split('-').reverse().join('/') : 'sem data limite'}.`
                : 'Nenhuma restrição de data definida — apresentadores podem escolher horários normalmente.'
              : statusAtual.motivo}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5"
      >
        <div className="flex items-center gap-2 text-slate-900 font-semibold border-b border-slate-100 pb-3">
          <CalendarClock className="w-5 h-5 text-indigo-600" />
          <span>Janela de Escolha de Horários (Apresentadores)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Data de Início (Apresentadores)</Label>
            <Input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              Primeiro dia em que os alunos podem agendar o TCC.
            </p>
          </div>

          <div>
            <Label>Data Final (Apresentadores)</Label>
            <Input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              Após este dia, apenas espectadores poderão se inscrever.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inscricoesAbertas}
              onChange={(e) => setInscricoesAbertas(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-800">
              Sistema aberto para inscrições (Apresentadores dentro do prazo e Espectadores)
            </span>
          </label>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setInicio('');
              setFim('');
            }}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Limpar Datas
          </Button>

          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Período'}
          </Button>
        </div>
      </form>
    </div>
  );
}