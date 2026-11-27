import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { registrarLog } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  CalendarClock,
  CheckCircle2,
  Lock,
  Save,
  RotateCcw,
  Clock,
  GraduationCap,
  Users,
  HeartHandshake,
} from 'lucide-react';

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

function avaliarJanela(abertura, fechamento, sistemaAberto, nomePublico) {
  if (!sistemaAberto) {
    return { aberto: false, texto: 'Pausado manualmente' };
  }
  const agora = new Date();
  if (abertura) {
    const dtAbertura = new Date(abertura);
    if (!Number.isNaN(dtAbertura.getTime()) && agora < dtAbertura) {
      return {
        aberto: false,
        texto: `Abre em ${formatarDataHoraBR(abertura)}`,
      };
    }
  }
  if (fechamento) {
    const dtFechamento = new Date(fechamento);
    if (!Number.isNaN(dtFechamento.getTime()) && agora > dtFechamento) {
      return {
        aberto: false,
        texto: `Encerrado em ${formatarDataHoraBR(fechamento)}`,
      };
    }
  }
  return {
    aberto: true,
    texto:
      abertura || fechamento
        ? `${abertura ? formatarDataHoraBR(abertura) : 'Imediato'} até ${
            fechamento ? formatarDataHoraBR(fechamento) : 'sem limite'
          }`
        : `Liberado para ${nomePublico}`,
  };
}

export default function AdminPeriodoInscricao() {
  const [configId, setConfigId] = useState(null);

  // 1. Apresentadores
  const [apresentadorAbertura, setApresentadorAbertura] = useState('');
  const [apresentadorFechamento, setApresentadorFechamento] = useState('');

  // 2. Espectador - Aluno (Acadêmico)
  const [alunoAbertura, setAlunoAbertura] = useState('');
  const [alunoFechamento, setAlunoFechamento] = useState('');

  // 3. Espectador - Família / Amigo
  const [familiarAbertura, setFamiliarAbertura] = useState('');
  const [familiarFechamento, setFamiliarFechamento] = useState('');

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
        setApresentadorAbertura(
          toLocalDateTimeInput(cfg.inscricao_abertura || cfg.inscricao_apresentador_inicio)
        );
        setApresentadorFechamento(
          toLocalDateTimeInput(cfg.inscricao_fechamento || cfg.inscricao_apresentador_fim)
        );
        setAlunoAbertura(toLocalDateTimeInput(cfg.inscricao_espectador_aluno_abertura));
        setAlunoFechamento(toLocalDateTimeInput(cfg.inscricao_espectador_aluno_fechamento));
        setFamiliarAbertura(toLocalDateTimeInput(cfg.inscricao_espectador_familiar_abertura));
        setFamiliarFechamento(
          toLocalDateTimeInput(cfg.inscricao_espectador_familiar_fechamento)
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

  function validarIntervalo(ini, fim, label) {
    if (ini && fim && new Date(ini) >= new Date(fim)) {
      toast({
        title: `Datas inválidas (${label})`,
        description: 'A data/hora de abertura deve ser anterior à de encerramento.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }

  async function handleSave(e) {
    e.preventDefault();

    if (
      !validarIntervalo(apresentadorAbertura, apresentadorFechamento, 'Apresentadores') ||
      !validarIntervalo(alunoAbertura, alunoFechamento, 'Espectador — Aluno') ||
      !validarIntervalo(familiarAbertura, familiarFechamento, 'Espectador — Família/Amigo')
    ) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        inscricao_abertura: apresentadorAbertura
          ? new Date(apresentadorAbertura).toISOString()
          : null,
        inscricao_fechamento: apresentadorFechamento
          ? new Date(apresentadorFechamento).toISOString()
          : null,
        inscricao_apresentador_inicio: apresentadorAbertura
          ? apresentadorAbertura.slice(0, 10)
          : null,
        inscricao_apresentador_fim: apresentadorFechamento
          ? apresentadorFechamento.slice(0, 10)
          : null,
        inscricao_espectador_aluno_abertura: alunoAbertura
          ? new Date(alunoAbertura).toISOString()
          : null,
        inscricao_espectador_aluno_fechamento: alunoFechamento
          ? new Date(alunoFechamento).toISOString()
          : null,
        inscricao_espectador_familiar_abertura: familiarAbertura
          ? new Date(familiarAbertura).toISOString()
          : null,
        inscricao_espectador_familiar_fechamento: familiarFechamento
          ? new Date(familiarFechamento).toISOString()
          : null,
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
        detalhes: `Sistema ${inscricoesAbertas ? 'ativo' : 'pausado'} | Apresentadores: ${
          apresentadorAbertura ? formatarDataHoraBR(apresentadorAbertura) : 'imediato'
        } a ${
          apresentadorFechamento ? formatarDataHoraBR(apresentadorFechamento) : 'sem limite'
        } | Espectador Aluno: ${
          alunoAbertura ? formatarDataHoraBR(alunoAbertura) : 'imediato'
        } a ${
          alunoFechamento ? formatarDataHoraBR(alunoFechamento) : 'sem limite'
        } | Família/Amigo: ${
          familiarAbertura ? formatarDataHoraBR(familiarAbertura) : 'imediato'
        } a ${familiarFechamento ? formatarDataHoraBR(familiarFechamento) : 'sem limite'}`,
      });

      toast({
        title: 'Períodos atualizados!',
        description: 'As janelas de inscrição de apresentadores e espectadores já estão ativas.',
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const statusApresentador = avaliarJanela(
    apresentadorAbertura,
    apresentadorFechamento,
    inscricoesAbertas,
    'Apresentadores'
  );
  const statusAluno = avaliarJanela(
    alunoAbertura,
    alunoFechamento,
    inscricoesAbertas,
    'Alunos'
  );
  const statusFamiliar = avaliarJanela(
    familiarAbertura,
    familiarFechamento,
    inscricoesAbertas,
    'Família/Amigos'
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Período de Inscrição</h1>
        <p className="text-sm text-slate-500">
          Configure separadamente a abertura e o encerramento para apresentadores de TCC,
          espectadores acadêmicos (alunos) e espectadores convidados (família/amigo).
        </p>
      </div>

      {/* Resumo de Status em Tempo Real */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { titulo: 'Apresentadores', status: statusApresentador },
          { titulo: 'Espectador — Aluno', status: statusAluno },
          { titulo: 'Espectador — Família/Amigo', status: statusFamiliar },
        ].map((item) => (
          <div
            key={item.titulo}
            className={`rounded-xl border p-3.5 flex items-start gap-2.5 ${
              item.status.aberto
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {item.status.aberto ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-xs">{item.titulo}</p>
              <p className="text-[11px] mt-0.5 opacity-90 leading-snug">{item.status.texto}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* BLOCO 1: APRESENTADORES */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900 font-semibold border-b border-slate-100 pb-3">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <span>1. Apresentadores de TCC</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Abertura (Apresentadores)
              </Label>
              <Input
                type="datetime-local"
                value={apresentadorAbertura}
                onChange={(e) => setApresentadorAbertura(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Encerramento (Apresentadores)
              </Label>
              <Input
                type="datetime-local"
                value={apresentadorFechamento}
                onChange={(e) => setApresentadorFechamento(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* BLOCO 2: ESPECTADORES — ALUNO (ACADÊMICO) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900 font-semibold border-b border-slate-100 pb-3">
            <Users className="w-5 h-5 text-sky-600" />
            <span>2. Espectadores — Aluno (Acadêmico)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Abertura (Alunos)
              </Label>
              <Input
                type="datetime-local"
                value={alunoAbertura}
                onChange={(e) => setAlunoAbertura(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                Quando estudantes podem começar a reservar vagas para assistir.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Encerramento (Alunos)
              </Label>
              <Input
                type="datetime-local"
                value={alunoFechamento}
                onChange={(e) => setAlunoFechamento(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                Prazo limite para inscrição de espectadores acadêmicos.
              </p>
            </div>
          </div>
        </div>

        {/* BLOCO 3: ESPECTADORES — FAMÍLIA / AMIGO */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900 font-semibold border-b border-slate-100 pb-3">
            <HeartHandshake className="w-5 h-5 text-emerald-600" />
            <span>3. Espectadores — Família / Amigo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Abertura (Família / Amigo)
              </Label>
              <Input
                type="datetime-local"
                value={familiarAbertura}
                onChange={(e) => setFamiliarAbertura(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                Quando familiares e convidados externos podem se inscrever.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Encerramento (Família / Amigo)
              </Label>
              <Input
                type="datetime-local"
                value={familiarFechamento}
                onChange={(e) => setFamiliarFechamento(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                Prazo limite para inscrição de familiares e amigos.
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLE GERAL E AÇÕES */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inscricoesAbertas}
              onChange={(e) => setInscricoesAbertas(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-800">
              Manter sistema aberto para inscrições (respeitando os prazos configurados acima)
            </span>
          </label>

          <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setApresentadorAbertura('');
                setApresentadorFechamento('');
                setAlunoAbertura('');
                setAlunoFechamento('');
                setFamiliarAbertura('');
                setFamiliarFechamento('');
              }}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Limpar Todas as Datas
            </Button>

            <Button type="submit" disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Períodos'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}