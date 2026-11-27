import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { registrarLog } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { CalendarClock, CheckCircle2, Lock, Save, RotateCcw, Clock } from 'lucide-react';

function toLocalDateTimeInput(valor) {
  if (!valor) return '';
  const str = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return `${str}T00:00`;
  }
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function formatarDataHoraBR(localStr) {
  if (!localStr) return '';
  const [dataPart, horaPart] = localStr.split('T');
  const [y, m, d] = (dataPart || '').split('-');
  if (!y || !m || !d) return localStr;
  return `${d}/${m}/${y} às ${horaPart || '00:00'}`;
}

export default function AdminPeriodoInscricao() {
  const [configId, setConfigId] = useState(null);
  const [abertura, setAbertura] = useState('');
  const [fechamento, setFechamento] = useState('');
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
        setAbertura(
          toLocalDateTimeInput(cfg.inscricao_abertura || cfg.inscricao_apresentador_inicio)
        );
        setFechamento(
          toLocalDateTimeInput(cfg.inscricao_fechamento || cfg.inscricao_apresentador_fim)
        );
        setInscricoesAbertas(cfg.inscricoes_abertas !== false);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Erro ao carregar período',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();

    if (abertura && fechamento && new Date(abertura) >= new Date(fechamento)) {
      toast({
        title: 'Datas inválidas',
        description: 'A data/hora de abertura deve ser anterior à de encerramento.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        inscricao_abertura: abertura ? new Date(abertura).toISOString() : null,
        inscricao_fechamento: fechamento ? new Date(fechamento).toISOString() : null,
        inscricao_apresentador_inicio: abertura ? abertura.slice(0, 10) : null,
        inscricao_apresentador_fim: fechamento ? fechamento.slice(0, 10) : null,
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

      await registrarLog({
        acao: 'ATUALIZAR',
        entidade: 'PERIODO_INSCRICAO',
        detalhes: `Inscrições ${inscricoesAbertas ? 'ativas' : 'pausadas'} | Abertura: ${
          abertura ? formatarDataHoraBR(abertura) : 'imediata'
        } | Encerramento: ${fechamento ? formatarDataHoraBR(fechamento) : 'sem limite'}`,
      });

      toast({
        title: 'Período atualizado!',
        description: 'As regras de abertura e encerramento já estão valendo no sistema.',
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

  function calcularStatusAtual() {
    if (!inscricoesAbertas) {
      return {
        aberto: false,
        titulo: 'Inscrições Pausadas Manualmente',
        descricao: 'O bloqueio manual está ativado. Nenhum novo agendamento está liberado.',
      };
    }

    const agora = new Date();
    if (abertura) {
      const dtAbertura = new Date(abertura);
      if (!Number.isNaN(dtAbertura.getTime()) && agora < dtAbertura) {
        return {
          aberto: false,
          titulo: 'Aguardando Abertura do Prazo',
          descricao: `As inscrições de apresentadores abrirão em ${formatarDataHoraBR(abertura)}.`,
        };
      }
    }

    if (fechamento) {
      const dtFechamento = new Date(fechamento);
      if (!Number.isNaN(dtFechamento.getTime()) && agora > dtFechamento) {
        return {
          aberto: false,
          titulo: 'Prazo de Apresentadores Encerrado (Apenas Espectadores)',
          descricao: `O agendamento de apresentadores encerrou em ${formatarDataHoraBR(fechamento)}.`,
        };
      }
    }

    return {
      aberto: true,
      titulo: 'Inscrições Liberadas Agora',
      descricao:
        abertura || fechamento
          ? `Janela ativa: ${
              abertura ? formatarDataHoraBR(abertura) : 'início imediato'
            } até ${fechamento ? formatarDataHoraBR(fechamento) : 'sem data limite'}.`
          : 'Nenhuma restrição de data definida — apresentadores e espectadores podem se inscrever.',
    };
  }

  const statusAtual = calcularStatusAtual();

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
          Defina a data e o horário de abertura e encerramento para agendamento de apresentadores.
          Fora desse prazo, apenas espectadores poderão se inscrever nas bancas aprovadas.
        </p>
      </div>

      {/* Cartão de Status em Tempo Real */}
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
          <p className="font-semibold">{statusAtual.titulo}</p>
          <p className="text-xs mt-0.5 opacity-90">{statusAtual.descricao}</p>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm"
      >
        <div className="flex items-center gap-2 text-slate-900 font-semibold border-b border-slate-100 pb-3">
          <CalendarClock className="w-5 h-5 text-indigo-600" />
          <span>Prazo de Abertura e Encerramento</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Abertura das Inscrições
            </Label>
            <Input
              type="datetime-local"
              value={abertura}
              onChange={(e) => setAbertura(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              Data e hora em que os alunos começam a escolher horários.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Encerramento das Inscrições
            </Label>
            <Input
              type="datetime-local"
              value={fechamento}
              onChange={(e) => setFechamento(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              Após este momento, apenas espectadores podem se inscrever.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inscricoesAbertas}
              onChange={(e) => setInscricoesAbertas(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-800">
              Manter sistema aberto para inscrições (respeitando o prazo acima)
            </span>
          </label>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAbertura('');
              setFechamento('');
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