import { supabase } from '@/lib/supabase';

export const FAIXAS_PADRAO = [
  { hora_inicio: '08:00', hora_fim: '10:00', descricao: '08:00 às 10:00' },
  { hora_inicio: '10:00', hora_fim: '12:00', descricao: '10:00 às 12:00' },
  { hora_inicio: '14:00', hora_fim: '16:00', descricao: '14:00 às 16:00' },
  { hora_inicio: '16:00', hora_fim: '18:00', descricao: '16:00 às 18:00' },
  { hora_inicio: '18:00', hora_fim: '20:00', descricao: '18:00 às 20:00' },
  { hora_inicio: '20:00', hora_fim: '22:00', descricao: '20:00 às 22:00' },
];

export async function criarHorariosAutomaticos({ dataInicio, dataFim, pularFimDeSemana = true }) {
  const inicio = new Date(`${dataInicio}T12:00:00`);
  const fim = new Date(`${dataFim || dataInicio}T12:00:00`);
  const datas = [];

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay();
    if (pularFimDeSemana && (diaSemana === 0 || diaSemana === 6)) continue;
    datas.push(d.toISOString().split('T')[0]);
  }

  const { data: existentes } = await supabase
    .from('horarios')
    .select('data, hora_inicio')
    .in('data', datas);

  const chavesExistentes = new Set((existentes || []).map((h) => `${h.data}_${h.hora_inicio}`));
  const novos = [];

  for (const data of datas) {
    for (const faixa of FAIXAS_PADRAO) {
      if (!chavesExistentes.has(`${data}_${faixa.hora_inicio}`)) {
        novos.push({ data, ...faixa, ativo: true });
      }
    }
  }

  if (novos.length === 0) return { criados: 0 };
  const { error } = await supabase.from('horarios').insert(novos);
  if (error) throw error;
  return { criados: novos.length };
}

export async function buscarAgendaCompleta() {
  const [horariosRes, bancasRes] = await Promise.all([
    supabase.from('horarios').select('*').order('data').order('hora_inicio'),
    supabase.from('bancas').select('*').neq('status', 'cancelada'),
  ]);
  if (horariosRes.error) throw horariosRes.error;
  if (bancasRes.error) throw bancasRes.error;
  return { horarios: horariosRes.data || [], bancas: bancasRes.data || [] };
}