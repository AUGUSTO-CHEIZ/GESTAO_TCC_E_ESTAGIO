import { supabase } from '@/lib/supabase';

const DOMINIOS_CORRETOS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'live.com',
  'unesc.net',
];

const CORRECOES_DIRETA_DOMINIO = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.com.br': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'htmail.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yaho.com.br': 'yahoo.com.br',
  'icoud.com': 'icloud.com',
  'iclod.com': 'icloud.com',
  'unesc.com': 'unesc.net',
};

function distanciaLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + custo
      );
    }
  }
  return dp[m][n];
}

// Detecta e sugere correção para erros comuns de digitação de e-mail
export function analisarEmailDigitado(emailRaw) {
  const original = String(emailRaw || '').trim();
  if (!original) {
    return { valido: true, email: original, sugestao: null, erro: null };
  }

  const normalizado = original.toLowerCase();
  const partes = normalizado.split('@');

  if (partes.length !== 2 || !partes[0] || !partes[1] || !partes[1].includes('.')) {
    return {
      valido: false,
      email: original,
      sugestao: null,
      erro: 'Digite um endereço de e-mail válido (ex.: nome@dominio.com).',
    };
  }

  const [usuario, dominio] = partes;

  if (CORRECOES_DIRETA_DOMINIO[dominio]) {
    const emailSugerido = `${usuario}@${CORRECOES_DIRETA_DOMINIO[dominio]}`;
    return {
      valido: false,
      email: original,
      sugestao: emailSugerido,
      erro: `Possível erro de digitação no domínio. Você quis dizer ${emailSugerido}?`,
    };
  }

  if (!DOMINIOS_CORRETOS.includes(dominio)) {
    let melhorDominio = null;
    let menorDist = Infinity;

    for (const candidato of DOMINIOS_CORRETOS) {
      const dist = distanciaLevenshtein(dominio, candidato);
      if (dist > 0 && dist <= 2 && dist < menorDist) {
        menorDist = dist;
        melhorDominio = candidato;
      }
    }

    if (melhorDominio) {
      const emailSugerido = `${usuario}@${melhorDominio}`;
      return {
        valido: false,
        email: original,
        sugestao: emailSugerido,
        erro: `Domínio incomum detectado. Você quis dizer ${emailSugerido}?`,
      };
    }
  }

  return { valido: true, email: normalizado, sugestao: null, erro: null };
}

export async function gerarHashSenha(senha) {
  const texto = String(senha || '');
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function enviarEmailConfirmacaoInscricao({ email, nome, inscricoes = [] }) {
  if (!email) {
    return { enviado: false, motivo: 'sem_email' };
  }

  const resumoBancas = inscricoes
    .map(
      (i) =>
        `• ${i.banca_titulo || i.titulo_tcc} (${i.horario_descricao || i.horario_data || 'Horário a confirmar'})`
    )
    .join('\n');

  try {
    const { error } = await supabase.functions.invoke('enviar-confirmacao-inscricao', {
      body: {
        to: email,
        nome,
        assunto: 'Confirmação de Inscrição — Bancas de TCC',
        resumoBancas,
        inscricoes,
      },
    });

    if (error) {
      return { enviado: false, motivo: error.message, resumoBancas };
    }
    return { enviado: true, resumoBancas };
  } catch (err) {
    return { enviado: false, motivo: err.message, resumoBancas };
  }
}

// Calcula se a banca está na trava de 15 minutos entre a 1ª chamada e a abertura da 2ª hora
export function avaliarTravaSegundaHora(banca, horario = null, agoraMs = Date.now()) {
  const rawData = String(banca?.horario_data || horario?.data || '').trim();
  const rawHora =
    String(horario?.hora_inicio || banca?.hora_inicio || '').trim() ||
    (String(banca?.horario_descricao || '').match(/(\d{1,2}:\d{2})/)?.[1] || '');

  if (!rawData || !rawHora) {
    return { bloqueada: false, horarioLiberacao: '', liberacaoMs: null };
  }

  let ano, mes, dia;
  if (/^\d{4}-\d{2}-\d{2}/.test(rawData)) {
    [ano, mes, dia] = rawData.slice(0, 10).split('-').map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(rawData)) {
    [dia, mes, ano] = rawData.slice(0, 10).split('/').map(Number);
  } else {
    return { bloqueada: false, horarioLiberacao: '', liberacaoMs: null };
  }

  const [hh, mm] = rawHora.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    return { bloqueada: false, horarioLiberacao: '', liberacaoMs: null };
  }

  const inicio = new Date(ano, mes - 1, dia, hh, mm, 0, 0);
  const liberacao = new Date(inicio.getTime() + 15 * 60 * 1000);
  const liberacaoMs = liberacao.getTime();
  const horarioLiberacao = `${String(liberacao.getHours()).padStart(2, '0')}:${String(
    liberacao.getMinutes()
  ).padStart(2, '0')}`;

  const bloqueada = Boolean(banca?.chamada1_concluida) && agoraMs < liberacaoMs;

  return { bloqueada, horarioLiberacao, liberacaoMs };
}

// 1. Listar Agenda Pública (Evento, Horários, Salas e Bancas com vagas e trava de 15 min)
export async function listarAgendaPublica() {
  try {
    const [eventoRes, horariosRes, bancasRes, inscricoesRes, salasRes] = await Promise.all([
      supabase.from('configuracao_evento').select('*').limit(1),
      supabase
        .from('horarios')
        .select('*')
        .eq('ativo', true)
        .order('data', { ascending: true })
        .order('hora_inicio', { ascending: true }),
      supabase.from('bancas').select('*').neq('status', 'cancelada'),
      supabase.from('inscricoes').select('id, banca_id, tipo'),
      supabase.from('salas').select('*').eq('ativa', true).order('nome', { ascending: true }),
    ]);

    const evento = eventoRes.data?.[0] || null;
    const horarios = horariosRes.data || [];
    const bancas = bancasRes.data || [];
    const inscricoes = inscricoesRes.data || [];
    const salas = salasRes.data || [];
    const maxBancas = evento?.max_bancas_por_horario || 2;
    const agoraMs = Date.now();

    const horarioMap = Object.fromEntries(horarios.map((h) => [h.id, h]));

    const bancasComVagas = bancas.map((banca) => {
      const h = horarioMap[banca.horario_id];
      const inscs = inscricoes.filter((i) => i.banca_id === banca.id);
      const espectadores = inscs.filter((i) => i.tipo === 'academico' || i.tipo === 'familiar');
      const totalVagas = banca.vagas_espectadores || 30;
      const ocupadas = espectadores.length;
      const trava = avaliarTravaSegundaHora(banca, h, agoraMs);

      return {
        ...banca,
        hora_inicio: h?.hora_inicio || '',
        hora_fim: h?.hora_fim || '',
        horario_data: banca.horario_data || h?.data || '',
        vagas_espectadores: totalVagas,
        vagas_ocupadas: ocupadas,
        vagas_restantes: Math.max(0, totalVagas - ocupadas),
        total_inscricoes: inscs.length,
        segunda_hora_bloqueada: trava.bloqueada,
        horario_liberacao_2hora: trava.horarioLiberacao,
        liberacao_2hora_ms: trava.liberacaoMs,
      };
    });

    const horariosComContagem = horarios.map((h) => {
      const bancasDoHorario = bancasComVagas.filter((b) => b.horario_id === h.id);
      const count = bancasDoHorario.length;
      return {
        id: h.id,
        data: h.data,
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
        descricao: h.descricao,
        bancas_count: count,
        vagas_apresentacao: Math.max(0, maxBancas - count),
        disponivel: count < maxBancas,
        salas_ocupadas: bancasDoHorario.map((b) => b.sala_id).filter(Boolean),
      };
    });

    return {
      data: {
        evento: evento
          ? {
              nome_evento: evento.nome_evento,
              data_inicio: evento.data_inicio,
              data_fim: evento.data_fim,
              local: evento.local,
              descricao: evento.descricao,
              inscricoes_abertas: evento.inscricoes_abertas,
              max_bancas_por_horario: maxBancas,
            }
          : null,
        horarios: horariosComContagem,
        bancas: bancasComVagas,
        salas,
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 2. Buscar pré-cadastro de aluno pelo código exato
export async function buscarAlunoPorCodigo(codigo) {
  try {
    const cleanCode = String(codigo || '').trim();
    if (!cleanCode) {
      return { data: { error: 'Digite o código do aluno.' } };
    }

    const { data: aluno, error } = await supabase
      .from('alunos_precadastro')
      .select('*')
      .ilike('codigo_aluno', cleanCode)
      .maybeSingle();

    if (error) throw error;
    if (!aluno) {
      return { data: { error: 'Código de aluno não encontrado no pré-cadastro.' } };
    }

    const { data: professores } = await supabase
      .from('professores')
      .select('id, nome')
      .eq('ativo', true);

    const profMatch =
      (professores || []).find(
        (p) => p.nome.trim().toLowerCase() === aluno.orientador_nome.trim().toLowerCase()
      ) ||
      (professores || []).find((p) =>
        p.nome.trim().toLowerCase().includes(aluno.orientador_nome.trim().toLowerCase())
      );

    return {
      data: {
        success: true,
        aluno: {
          ...aluno,
          orientador_id: profMatch?.id || '',
        },
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 3. Criar Inscrição (Apresentador ou Espectador Multi-Bancas com trava de 15 min)
export async function criarInscricao(body) {
  try {
    if (!body.tipo || !body.nome) {
      return { data: { error: 'Nome e tipo de inscrição são obrigatórios.' } };
    }

    const { data: eventos } = await supabase.from('configuracao_evento').select('*').limit(1);
    const evento = eventos?.[0] || null;
    if (evento && evento.inscricoes_abertas === false) {
      return { data: { error: 'As inscrições estão encerradas no momento.' } };
    }

    const maxBancas = evento?.max_bancas_por_horario || 2;

    if (body.tipo === 'apresentador') {
      const isExterno = body.avaliador2_tipo === 'externo';

      if (!body.codigo_academico || !body.email || !body.horario_id || !body.titulo_tcc) {
        return { data: { error: 'Preencha código, e-mail, horário e título do TCC.' } };
      }
      if (!body.orientador_id || !body.avaliador1_id) {
        return { data: { error: 'Orientador e Avaliador 1 são obrigatórios.' } };
      }
      if (!isExterno && !body.avaliador2_id) {
        return {
          data: {
            error: 'Selecione o Avaliador 2 do curso ou preencha os dados do avaliador externo.',
          },
        };
      }
      if (
        isExterno &&
        (!body.avaliador2_externo_titulacao ||
          !body.avaliador2_externo_nome ||
          !body.avaliador2_externo_email)
      ) {
        return {
          data: {
            error: 'Preencha titulação, nome completo e e-mail do avaliador externo.',
          },
        };
      }

      const profIds = [
        body.orientador_id,
        body.avaliador1_id,
        ...(isExterno ? [] : [body.avaliador2_id]),
      ];
      if (new Set(profIds).size !== profIds.length) {
        return { data: { error: 'Orientador e avaliadores devem ser professores diferentes.' } };
      }

      const [orientadorRes, avaliador1Res, avaliador2Res, horarioRes, salasRes] = await Promise.all([
        supabase.from('professores').select('*').eq('id', body.orientador_id).single(),
        supabase.from('professores').select('*').eq('id', body.avaliador1_id).single(),
        isExterno
          ? Promise.resolve({ data: null })
          : supabase.from('professores').select('*').eq('id', body.avaliador2_id).single(),
        supabase.from('horarios').select('*').eq('id', body.horario_id).single(),
        supabase.from('salas').select('*').eq('ativa', true).order('nome', { ascending: true }),
      ]);

      const orientador = orientadorRes.data;
      const avaliador1 = avaliador1Res.data;
      const avaliador2 = avaliador2Res.data;
      const horario = horarioRes.data;
      const salas = salasRes.data || [];

      if (!orientador || !avaliador1 || (!isExterno && !avaliador2)) {
        return { data: { error: 'Professor não encontrado no cadastro.' } };
      }
      if (!horario) {
        return { data: { error: 'Horário selecionado não encontrado.' } };
      }

      const { data: bancasNoHorario } = await supabase
        .from('bancas')
        .select('*')
        .eq('horario_id', body.horario_id)
        .neq('status', 'cancelada');

      if ((bancasNoHorario || []).length >= maxBancas) {
        return { data: { error: 'Este horário já atingiu o limite de 2 apresentações.' } };
      }

      for (const other of bancasNoHorario || []) {
        const ocupados = [other.orientador_id, other.avaliador1_id, other.avaliador2_id].filter(
          Boolean
        );
        for (const pid of profIds) {
          if (ocupados.includes(pid)) {
            const profConflito =
              pid === orientador.id ? orientador : pid === avaliador1.id ? avaliador1 : avaliador2;
            return {
              data: {
                error: `O(A) professor(a) ${profConflito.nome} já está em outra banca neste horário.`,
              },
            };
          }
        }
      }

      const salasUsadasIds = (bancasNoHorario || []).map((b) => b.sala_id).filter(Boolean);
      const salaLivre = salas.find((s) => !salasUsadasIds.includes(s.id)) || null;

      const avaliador2NomeFinal = isExterno
        ? `${body.avaliador2_externo_titulacao} ${body.avaliador2_externo_nome}`.trim()
        : avaliador2.nome;

      const horarioDesc = `${horario.data} • ${horario.hora_inicio?.slice(0, 5)} às ${horario.hora_fim?.slice(0, 5)}`;

      const { data: novaBanca, error: bancaErr } = await supabase
        .from('bancas')
        .insert({
          titulo_tcc: body.titulo_tcc,
          horario_id: body.horario_id,
          horario_descricao: horarioDesc,
          horario_data: horario.data,
          sala_id: salaLivre?.id || null,
          sala_nome: salaLivre?.nome || '',
          orientador_id: orientador.id,
          orientador_nome: orientador.nome,
          orientador_user_id: orientador.user_id || null,
          avaliador1_id: avaliador1.id,
          avaliador1_nome: avaliador1.nome,
          avaliador2_id: isExterno ? null : avaliador2.id,
          avaliador2_nome: avaliador2NomeFinal,
          avaliador2_tipo: isExterno ? 'externo' : 'curso',
          avaliador2_externo_nome: isExterno ? body.avaliador2_externo_nome : null,
          avaliador2_externo_titulacao: isExterno ? body.avaliador2_externo_titulacao : null,
          avaliador2_externo_email: isExterno ? body.avaliador2_externo_email : null,
          apresentador_nome: body.nome,
          apresentador_email: body.email,
          apresentador_codigo: body.codigo_academico,
          status: 'agendada',
          vagas_espectadores: 30,
        })
        .select()
        .single();

      if (bancaErr) throw bancaErr;

      const { data: novaInscricao, error: inscErr } = await supabase
        .from('inscricoes')
        .insert({
          banca_id: novaBanca.id,
          banca_titulo: body.titulo_tcc,
          horario_descricao: horarioDesc,
          horario_data: horario.data,
          sala_nome: salaLivre?.nome || '',
          orientador_user_id: orientador.user_id || null,
          tipo: 'apresentador',
          nome: body.nome,
          email: body.email,
          codigo_academico: body.codigo_academico,
          titulo_tcc: body.titulo_tcc,
          orientador_nome: orientador.nome,
          presente: false,
          inclusao_ultima_hora: false,
          email_enviado: true,
          email_status: 'confirmado',
        })
        .select()
        .single();

      if (inscErr) throw inscErr;

      return { data: { success: true, inscricao_id: novaInscricao.id, banca_id: novaBanca.id } };
    }

    return await criarInscricaoEspectador(body);
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// --- FLUXO ESPECTADOR (SUPORTA 1 OU VÁRIAS BANCAS + SENHA + E-MAIL OPCIONAL PARA FAMILIAR) ---
export async function criarInscricaoEspectador(body) {
  try {
    const tipo = body?.tipo || 'academico';
    const nome = String(body?.nome || '').trim();
    const emailRaw = String(body?.email || '').trim();
    const senha = String(body?.senha || body?.password || '').trim();

    if (!nome) {
      return { data: { error: 'Nome completo é obrigatório.' } };
    }

    if (tipo === 'academico' && !emailRaw) {
      return { data: { error: 'E-mail é obrigatório para acadêmicos.' } };
    }

    if (emailRaw) {
      const analiseEmail = analisarEmailDigitado(emailRaw);
      if (!analiseEmail.valido) {
        return {
          data: {
            error: analiseEmail.erro || 'Verifique o endereço de e-mail informado.',
            sugestao_email: analiseEmail.sugestao || null,
          },
        };
      }
    }

    if (!senha || senha.length < 4) {
      return {
        data: { error: 'Defina uma senha (mínimo de 4 caracteres) para consultar sua inscrição depois.' },
      };
    }

    const { data: eventos } = await supabase.from('configuracao_evento').select('*').limit(1);
    const evento = eventos?.[0] || null;
    if (evento && evento.inscricoes_abertas === false) {
      return { data: { error: 'As inscrições estão encerradas no momento.' } };
    }

    const bancaIds =
      Array.isArray(body?.banca_ids) && body.banca_ids.length > 0
        ? body.banca_ids
        : body?.banca_id
        ? [body.banca_id]
        : [];

    if (bancaIds.length === 0) {
      return { data: { error: 'Selecione pelo menos uma banca para assistir.' } };
    }

    const { data: bancasAlvo, error: bErr } = await supabase
      .from('bancas')
      .select('*')
      .in('id', bancaIds);

    if (bErr || !bancasAlvo || bancasAlvo.length === 0) {
      return { data: { error: 'Bancas selecionadas não encontradas.' } };
    }

    const horarioIds = bancasAlvo.map((b) => b.horario_id).filter(Boolean);
    const { data: horariosRel } = horarioIds.length
      ? await supabase.from('horarios').select('*').in('id', horarioIds)
      : { data: [] };
    const horarioMap = Object.fromEntries((horariosRel || []).map((h) => [h.id, h]));

    const chavesHorario = new Set();
    for (const b of bancasAlvo) {
      const chave = b.horario_id || `${b.horario_data || ''}_${b.horario_descricao || ''}`;
      if (chavesHorario.has(chave)) {
        return {
          data: {
            error:
              'Você selecionou duas apresentações no mesmo dia e horário. Escolha apenas uma por horário.',
          },
        };
      }
      chavesHorario.add(chave);
    }

    const agoraMs = Date.now();
    for (const b of bancasAlvo) {
      if (b.status === 'realizada' || b.status === 'cancelada' || b.chamada2_concluida) {
        return { data: { error: `A apresentação "${b.titulo_tcc}" já foi encerrada.` } };
      }

      const trava = avaliarTravaSegundaHora(b, horarioMap[b.horario_id], agoraMs);
      if (trava.bloqueada) {
        return {
          data: {
            error: `As vagas da 2ª hora para "${b.titulo_tcc}" abrem somente às ${trava.horarioLiberacao}.`,
          },
        };
      }

      const { data: inscs } = await supabase
        .from('inscricoes')
        .select('id, tipo')
        .eq('banca_id', b.id);
      const ocupadas = (inscs || []).filter(
        (i) => i.tipo === 'academico' || i.tipo === 'familiar'
      ).length;
      if (ocupadas >= (b.vagas_espectadores || 30)) {
        return { data: { error: `As vagas para "${b.titulo_tcc}" já estão esgotadas.` } };
      }
    }

    const senhaHash = await gerarHashSenha(senha);
    const emailLimpo = emailRaw.toLowerCase();

    const registros = bancasAlvo.map((b) => ({
      banca_id: b.id,
      banca_titulo: b.titulo_tcc,
      horario_descricao: b.horario_descricao || '',
      horario_data: b.horario_data || '',
      sala_nome: b.sala_nome || '',
      orientador_user_id: b.orientador_user_id || null,
      tipo,
      nome,
      email: emailLimpo,
      cpf: body?.cpf || '',
      codigo_academico: body?.codigo_academico || '',
      senha_hash: senhaHash,
      parentesco: body?.parentesco || '',
      etapa_chamada: b.chamada1_concluida ? 2 : 1,
      presente: false,
      inclusao_ultima_hora: false,
      email_enviado: Boolean(emailLimpo),
      email_status: emailLimpo ? 'confirmado' : 'sem_email',
    }));

    const { data: inseridas, error: insertErr } = await supabase
      .from('inscricoes')
      .insert(registros)
      .select();

    if (insertErr) throw insertErr;

    const confirmacaoEmail = emailLimpo
      ? await enviarEmailConfirmacaoInscricao({
          email: emailLimpo,
          nome,
          inscricoes: inseridas || registros,
        })
      : { enviado: false, motivo: 'sem_email' };

    return {
      data: {
        success: true,
        total: registros.length,
        inscricoes: inseridas || registros,
        email_confirmacao: confirmacaoEmail,
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 4. Consultar Inscrições por Código do Aluno ou E-mail
export async function consultarInscricao({ codigo, email }) {
  try {
    const termo = String(codigo || email || '').trim();
    if (!termo) {
      return { data: { error: 'Informe seu código do aluno ou e-mail.' } };
    }

    let query = supabase.from('inscricoes').select('*');
    if (termo.includes('@')) {
      query = query.ilike('email', termo);
    } else {
      query = query.or(`codigo_academico.ilike.${termo},email.ilike.${termo}`);
    }

    const { data: inscricoes, error } = await query;
    if (error) throw error;
    if (!inscricoes || inscricoes.length === 0) {
      return { data: { error: 'Nenhuma inscrição encontrada para este código ou e-mail.' } };
    }

    const enriched = await Promise.all(
      inscricoes.map(async (insc) => {
        const { data: banca } = insc.banca_id
          ? await supabase.from('bancas').select('*').eq('id', insc.banca_id).maybeSingle()
          : { data: null };

        return {
          ...insc,
          titulo_tcc: insc.titulo_tcc || insc.banca_titulo || banca?.titulo_tcc || '',
          orientador_nome: insc.orientador_nome || banca?.orientador_nome || '',
          avaliador1_nome: banca?.avaliador1_nome || '',
          avaliador2_nome: banca?.avaliador2_nome || '',
          apresentador_nome: banca?.apresentador_nome || '',
          horario_descricao: insc.horario_descricao || banca?.horario_descricao || '',
          horario_data: insc.horario_data || banca?.horario_data || '',
          sala_nome: insc.sala_nome || banca?.sala_nome || '',
          status: banca?.status || null,
        };
      })
    );

    return { data: { success: true, inscricoes: enriched } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// Consultar inscrições exigindo E-mail ou Código + Senha
export async function consultarInscricaoComSenha({ codigo, email, senha }) {
  try {
    const identificador = String(email || codigo || '').trim();
    const senhaInformada = String(senha || '').trim();

    if (!identificador) {
      return { data: { error: 'Informe seu e-mail ou código do aluno.' } };
    }

    if (!senhaInformada) {
      return { data: { error: 'Informe sua senha para consultar a inscrição.' } };
    }

    let query = supabase.from('inscricoes').select('*');
    if (identificador.includes('@')) {
      query = query.ilike('email', identificador);
    } else {
      query = query.or(`codigo_academico.ilike.${identificador},email.ilike.${identificador}`);
    }

    const { data: inscricoes, error } = await query;
    if (error) throw error;

    if (!inscricoes || inscricoes.length === 0) {
      return { data: { error: 'Nenhuma inscrição encontrada para este e-mail ou código.' } };
    }

    const hashInformado = await gerarHashSenha(senhaInformada);
    const validadas = inscricoes.filter(
      (i) =>
        (i.senha_hash && i.senha_hash === hashInformado) ||
        (i.senha && String(i.senha) === senhaInformada)
    );

    if (validadas.length === 0) {
      return {
        data: {
          error: 'Senha incorreta ou inscrição sem senha cadastrada. Use "Esqueci minha senha".',
        },
      };
    }

    const enriched = await Promise.all(
      validadas.map(async (insc) => {
        const { data: banca } = insc.banca_id
          ? await supabase.from('bancas').select('*').eq('id', insc.banca_id).maybeSingle()
          : { data: null };

        return {
          ...insc,
          titulo_tcc: insc.titulo_tcc || insc.banca_titulo || banca?.titulo_tcc || '',
          orientador_nome: insc.orientador_nome || banca?.orientador_nome || '',
          avaliador1_nome: banca?.avaliador1_nome || '',
          avaliador2_nome: banca?.avaliador2_nome || '',
          apresentador_nome: banca?.apresentador_nome || '',
          horario_descricao: insc.horario_descricao || banca?.horario_descricao || '',
          horario_data: insc.horario_data || banca?.horario_data || '',
          sala_nome: insc.sala_nome || banca?.sala_nome || '',
          status: banca?.status || null,
        };
      })
    );

    return { data: { success: true, inscricoes: enriched } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 5. Vincular Usuário Logado ao Cadastro de Professor
export async function vincularProfessorUsuario() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Acesso negado: faça login' } };

    const emailLimpo = String(user.email || '').trim();

    const { data: professores, error } = await supabase
      .from('professores')
      .select('*')
      .ilike('email', emailLimpo);

    if (error) {
      return { data: { error: error.message } };
    }

    if (!professores || professores.length === 0) {
      const roleMeta = user.user_metadata?.role || '';
      if (roleMeta === 'admin' || roleMeta === 'organizadora') {
        return {
          data: {
            success: true,
            professor: {
              id: user.id,
              nome: user.user_metadata?.nome || user.user_metadata?.full_name || emailLimpo,
              email: emailLimpo,
              ativo: true,
              user_id: user.id,
            },
          },
        };
      }
      return {
        data: { error: 'Professor não encontrado no cadastro. Contate a organização do evento.' },
      };
    }

    const professor = professores[0];
    if (professor.ativo === false) {
      return {
        data: { error: 'Seu cadastro está inativo. Contate a organização do evento.' },
      };
    }

    if (!professor.user_id || professor.user_id !== user.id) {
      await supabase.from('professores').update({ user_id: user.id }).eq('id', professor.id);
      const { data: perfil } = await supabase
        .from('perfis')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (perfil?.role !== 'admin' && perfil?.role !== 'organizadora') {
        await supabase.from('perfis').update({ role: 'professor' }).eq('id', user.id);
      }
    }

    return { data: { success: true, professor: { ...professor, user_id: user.id } } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 6. Confirmar Presença (1ª ou 2ª Chamada) com fallback e validação de erro
export async function confirmarPresenca({ inscricao_id, presente, etapa = 1 }) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Não autorizado' } };

    const { data: inscricao, error: inscErr } = await supabase
      .from('inscricoes')
      .select('*')
      .eq('id', inscricao_id)
      .single();

    if (inscErr || !inscricao) return { data: { error: 'Inscrição não encontrada' } };

    const updates =
      etapa === 2
        ? { presente_chamada2: presente, presente }
        : { presente_chamada1: presente, presente };

    let { error: updErr } = await supabase
      .from('inscricoes')
      .update(updates)
      .eq('id', inscricao_id);

    if (updErr && /presente_chamada/i.test(updErr.message || '')) {
      const retry = await supabase
        .from('inscricoes')
        .update({ presente })
        .eq('id', inscricao_id);
      updErr = retry.error;
    }

    if (updErr) {
      return { data: { error: `Não foi possível salvar presença: ${updErr.message}` } };
    }

    try {
      await supabase.from('presencas').upsert({
        inscricao_id,
        inscricao_nome: inscricao.nome,
        inscricao_tipo: inscricao.tipo,
        banca_id: inscricao.banca_id,
        banca_titulo: inscricao.banca_titulo,
        orientador_user_id: inscricao.orientador_user_id,
        presente,
        confirmado_por_professor_id: user.id,
        confirmado_por_nome: user.user_metadata?.full_name || user.email,
        data_confirmacao: new Date().toISOString(),
      });
    } catch (_) {
      // Ignora erro secundário na tabela auxiliar de log
    }

    return { data: { success: true } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 7. Concluir 1ª Chamada: mantém os presentes e libera vagas SOMENTE pelos ausentes
export async function finalizarPrimeiraChamada({
  banca_id,
  horario_chamada,
  presentes_ids = null,
}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Não autorizado' } };

    const { data: banca } = await supabase.from('bancas').select('*').eq('id', banca_id).single();
    if (!banca) return { data: { error: 'Banca não encontrada' } };

    const { data: inscricoes, error: listErr } = await supabase
      .from('inscricoes')
      .select('*')
      .eq('banca_id', banca_id);

    if (listErr) throw listErr;

    const espectadores = (inscricoes || []).filter((i) => i.tipo !== 'apresentador');
    const usarListaTela = Array.isArray(presentes_ids);

    if (usarListaTela && presentes_ids.length > 0) {
      let { error: syncErr } = await supabase
        .from('inscricoes')
        .update({ presente: true, presente_chamada1: true })
        .in('id', presentes_ids);

      if (syncErr && /presente_chamada/i.test(syncErr.message || '')) {
        const retrySync = await supabase
          .from('inscricoes')
          .update({ presente: true })
          .in('id', presentes_ids);
        syncErr = retrySync.error;
      }
      if (syncErr) throw syncErr;
    }

    const ausentes = espectadores.filter((i) =>
      usarListaTela ? !presentes_ids.includes(i.id) : !i.presente_chamada1 && !i.presente
    );

    if (ausentes.length > 0) {
      try {
        const historicoRows = ausentes.map((a) => ({
          banca_id,
          banca_titulo: banca.titulo_tcc,
          horario_descricao: banca.horario_descricao || '',
          horario_data: banca.horario_data || '',
          nome: a.nome,
          email: a.email || '',
          codigo_academico: a.codigo_academico || '',
          tipo: a.tipo,
          etapa_falta: '1ª Chamada',
          registrado_por: user.user_metadata?.full_name || user.email,
        }));
        await supabase.from('inscricoes_ausentes').insert(historicoRows);
      } catch (_) {
        // Prossegue com a liberação das vagas mesmo se a tabela de histórico não existir
      }

      const { error: delErr } = await supabase
        .from('inscricoes')
        .delete()
        .in(
          'id',
          ausentes.map((a) => a.id)
        );

      if (delErr) {
        return { data: { error: `Erro ao liberar vagas dos ausentes: ${delErr.message}` } };
      }
    }

    const { error: bancaUpdErr } = await supabase
      .from('bancas')
      .update({
        chamada1_concluida: true,
        chamada1_horario: horario_chamada || new Date().toTimeString().slice(0, 5),
      })
      .eq('id', banca_id);

    if (bancaUpdErr) throw bancaUpdErr;

    const totalVagas = banca.vagas_espectadores || 30;
    const presentesMantidos = espectadores.length - ausentes.length;
    const vagasDisponiveis = Math.max(0, totalVagas - presentesMantidos);

    return {
      data: {
        success: true,
        vagas_liberadas: ausentes.length,
        vagas_disponiveis: vagasDisponiveis,
        presentes_mantidos: presentesMantidos,
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 8. Concluir 2ª Chamada (Encerramento da Apresentação)
export async function finalizarSegundaChamada({ banca_id, horario_chamada }) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Não autorizado' } };

    await supabase
      .from('bancas')
      .update({
        chamada2_concluida: true,
        chamada2_horario: horario_chamada || new Date().toTimeString().slice(0, 5),
        status: 'realizada',
      })
      .eq('id', banca_id);

    return { data: { success: true } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 9. Professor Adicionar Aluno de Última Hora
export async function adicionarAlunoUltimaHora(body) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Não autorizado' } };

    const { banca_id, tipo, nome, email, cpf, codigo_academico, curso, semestre, parentesco } =
      body;
    if (!banca_id || !tipo || !nome) {
      return { data: { error: 'Campos obrigatórios não preenchidos' } };
    }

    const { data: banca } = await supabase.from('bancas').select('*').eq('id', banca_id).single();
    if (!banca) return { data: { error: 'Banca não encontrada' } };

    let payload = {
      banca_id,
      banca_titulo: banca.titulo_tcc,
      horario_descricao: banca.horario_descricao || '',
      horario_data: banca.horario_data || '',
      sala_nome: banca.sala_nome || '',
      orientador_user_id: banca.orientador_user_id || null,
      tipo,
      nome,
      email: email || '',
      cpf: cpf || '',
      codigo_academico: codigo_academico || '',
      curso: curso || 'Psicologia',
      semestre: semestre || '',
      parentesco: parentesco || '',
      etapa_chamada: banca.chamada1_concluida ? 2 : 1,
      presente: true,
      presente_chamada1: !banca.chamada1_concluida,
      presente_chamada2: true,
      inclusao_ultima_hora: true,
      added_by_professor_id: user.id,
      added_by_professor_nome: user.user_metadata?.full_name || user.email,
      email_enviado: Boolean(email),
      email_status: email ? 'confirmado' : 'sem_email',
    };

    let { data: novaInscricao, error: err } = await supabase
      .from('inscricoes')
      .insert(payload)
      .select()
      .single();

    if (err && /presente_chamada/i.test(err.message || '')) {
      const { presente_chamada1, presente_chamada2, ...payloadSemChamada } = payload;
      const retry = await supabase
        .from('inscricoes')
        .insert(payloadSemChamada)
        .select()
        .single();
      novaInscricao = retry.data;
      err = retry.error;
    }

    if (err) throw err;

    return { data: { success: true, inscricao_id: novaInscricao.id } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 10. Admin Atualizar Professores da Banca
export async function atualizarProfessoresBanca(body) {
  try {
    const { banca_id, orientador_id, avaliador1_id, avaliador2_id } = body;
    const { data: banca } = await supabase.from('bancas').select('*').eq('id', banca_id).single();
    if (!banca) return { data: { error: 'Banca não encontrada' } };

    const updates = {};
    if (orientador_id !== undefined) {
      const { data: p } = orientador_id
        ? await supabase.from('professores').select('*').eq('id', orientador_id).single()
        : { data: null };
      updates.orientador_id = orientador_id || null;
      updates.orientador_nome = p?.nome || '';
      updates.orientador_user_id = p?.user_id || null;
    }
    if (avaliador1_id !== undefined) {
      const { data: p } = avaliador1_id
        ? await supabase.from('professores').select('*').eq('id', avaliador1_id).single()
        : { data: null };
      updates.avaliador1_id = avaliador1_id || null;
      updates.avaliador1_nome = p?.nome || '';
    }
    if (avaliador2_id !== undefined) {
      const { data: p } = avaliador2_id
        ? await supabase.from('professores').select('*').eq('id', avaliador2_id).single()
        : { data: null };
      updates.avaliador2_id = avaliador2_id || null;
      updates.avaliador2_nome = p?.nome || '';
    }

    await supabase.from('bancas').update(updates).eq('id', banca_id);
    return { data: { success: true } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 11. Verificar Prazo de Inscrição do Apresentador
export async function verificarPrazoApresentador() {
  try {
    const { data: eventos, error } = await supabase
      .from('configuracao_evento')
      .select('*')
      .limit(1);

    if (error) throw error;

    const evento = eventos?.[0] || null;
    if (!evento) {
      return {
        data: {
          aberto: true,
          permitido: true,
          dentro_do_prazo: true,
          evento: null,
        },
      };
    }

    const agora = new Date();
    const inicioRaw =
      evento.data_inicio_apresentador || evento.inicio_inscricao_apresentador || null;
    const fimRaw =
      evento.prazo_apresentador ||
      evento.data_limite_apresentador ||
      evento.data_fim_apresentador ||
      evento.prazo_inscricao_apresentador ||
      null;

    let dentroDoPrazo = evento.inscricoes_abertas !== false;
    let motivo = '';

    if (!dentroDoPrazo) {
      motivo = 'As inscrições estão encerradas no momento.';
    }

    if (dentroDoPrazo && inicioRaw) {
      const dtInicio = new Date(inicioRaw);
      if (!Number.isNaN(dtInicio.getTime()) && agora < dtInicio) {
        dentroDoPrazo = false;
        motivo = 'O período de inscrição para apresentadores ainda não iniciou.';
      }
    }

    if (dentroDoPrazo && fimRaw) {
      const dtFim = new Date(fimRaw);
      if (!Number.isNaN(dtFim.getTime()) && agora > dtFim) {
        dentroDoPrazo = false;
        motivo = 'O prazo de inscrição para apresentadores já foi encerrado.';
      }
    }

    return {
      data: {
        aberto: dentroDoPrazo,
        permitido: dentroDoPrazo,
        dentro_do_prazo: dentroDoPrazo,
        motivo,
        mensagem: motivo,
        evento,
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 12. Obter semestre (ex: "2026/1" ou "2026/2") a partir de uma data
export function obterSemestrePorData(dataInput) {
  const raw = String(dataInput || '').trim();
  if (!raw) {
    const now = new Date();
    return `${now.getFullYear()}/${now.getMonth() < 6 ? 1 : 2}`;
  }

  let year;
  let month;

  if (/^\d{4}-\d{2}/.test(raw)) {
    [year, month] = raw.split('-').map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const parts = raw.split('/').map(Number);
    month = parts[1];
    year = parts[2];
  } else {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    year = d.getFullYear();
    month = d.getMonth() + 1;
  }

  return `${year}/${month <= 6 ? 1 : 2}`;
}

// 13. Arquivar semestre atual no histórico
export async function arquivarSemestreAtual(params = {}) {
  try {
    const semestre =
      typeof params === 'string'
        ? params
        : params.semestre || obterSemestrePorData(new Date());

    const [bancasRes, inscricoesRes, horariosRes] = await Promise.all([
      supabase.from('bancas').select('*'),
      supabase.from('inscricoes').select('*'),
      supabase.from('horarios').select('*'),
    ]);

    const bancas = bancasRes.data || [];
    const inscricoes = inscricoesRes.data || [];
    const horarios = horariosRes.data || [];

    const { error } = await supabase.from('historico_semestres').insert({
      semestre,
      dados_bancas: bancas,
      dados_inscricoes: inscricoes,
      dados_horarios: horarios,
      total_bancas: bancas.length,
      total_inscricoes: inscricoes.length,
      arquivado_em: new Date().toISOString(),
    });

    if (error) throw error;

    return { data: { success: true, semestre } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 14. Verificar e atualizar o semestre ativo na configuração do evento
export async function verificarEAtualizarSemestre() {
  try {
    const semestreAtual = obterSemestrePorData(new Date());
    const { data: eventos } = await supabase
      .from('configuracao_evento')
      .select('*')
      .limit(1);

    const evento = eventos?.[0] || null;
    if (evento && 'semestre_atual' in evento && evento.semestre_atual !== semestreAtual) {
      await supabase
        .from('configuracao_evento')
        .update({ semestre_atual: semestreAtual })
        .eq('id', evento.id);

      return {
        data: {
          success: true,
          atualizado: true,
          semestre: semestreAtual,
          semestre_anterior: evento.semestre_atual,
        },
      };
    }

    return {
      data: {
        success: true,
        atualizado: false,
        semestre: semestreAtual,
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 15. Verificar se o e-mail pertence a um professor cadastrado e se é primeiro acesso
export async function verificarPrimeiroAcessoProfessor(params) {
  try {
    const emailRaw = typeof params === 'string' ? params : params?.email || '';
    const email = String(emailRaw).trim();

    if (!email) {
      return { data: { error: 'Informe o e-mail institucional.' } };
    }

    const { data: professores, error } = await supabase
      .from('professores')
      .select('*')
      .ilike('email', email);

    if (error) throw error;

    if (!professores || professores.length === 0) {
      return {
        data: {
          error: 'E-mail não encontrado no cadastro de professores. Contate a coordenação.',
        },
      };
    }

    const professor = professores[0];
    if (professor.ativo === false) {
      return {
        data: {
          error: 'Seu cadastro de professor está inativo. Contate a coordenação.',
        },
      };
    }

    const primeiroAcesso = !professor.user_id;

    return {
      data: {
        success: true,
        primeiro_acesso: primeiroAcesso,
        primeiroAcesso,
        ja_cadastrado: !primeiroAcesso,
        professor,
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 16. Solicitar código/token de recuperação de senha para o espectador
export async function solicitarRecuperacaoSenha({ email, codigo }) {
  try {
    const identificador = String(email || codigo || '').trim();
    if (!identificador) {
      return { data: { error: 'Informe o e-mail ou código cadastrado na inscrição.' } };
    }

    let query = supabase.from('inscricoes').select('id, nome, email, codigo_academico');
    if (identificador.includes('@')) {
      query = query.ilike('email', identificador);
    } else {
      query = query.or(`codigo_academico.ilike.${identificador},email.ilike.${identificador}`);
    }

    const { data: registros, error } = await query;
    if (error) throw error;

    if (!registros || registros.length === 0) {
      return { data: { error: 'Nenhuma inscrição encontrada com esse dado.' } };
    }

    const tokenRecuperacao = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiracao = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const ids = registros.map((r) => r.id);

    await supabase
      .from('inscricoes')
      .update({
        token_recuperacao: tokenRecuperacao,
        token_recuperacao_expira: expiracao,
      })
      .in('id', ids);

    const destinoEmail = registros.find((r) => r.email)?.email || '';

    if (destinoEmail) {
      try {
        await supabase.functions.invoke('enviar-recuperacao-senha', {
          body: {
            to: destinoEmail,
            codigo_recuperacao: tokenRecuperacao,
            nome: registros[0].nome,
          },
        });
      } catch (_) {
        // Fallback caso a Edge Function não esteja configurada
      }
    }

    return {
      data: {
        success: true,
        email_mascarado: destinoEmail || null,
        codigo_recuperacao: destinoEmail ? undefined : tokenRecuperacao,
        mensagem: destinoEmail
          ? `Código de recuperação gerado para ${destinoEmail}.`
          : `Código de recuperação gerado: ${tokenRecuperacao}`,
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 17. Redefinir senha da inscrição usando código de recuperação (ou e-mail/código + nova senha)
export async function redefinirSenhaInscricao({ email, codigo, token, novaSenha }) {
  try {
    const identificador = String(email || codigo || '').trim();
    const tokenInformado = String(token || '').trim().toUpperCase();
    const novaSenhaLimpa = String(novaSenha || '').trim();

    if (!identificador || !novaSenhaLimpa || novaSenhaLimpa.length < 4) {
      return {
        data: { error: 'Informe o e-mail/código e a nova senha (mínimo de 4 caracteres).' },
      };
    }

    let query = supabase.from('inscricoes').select('*');
    if (identificador.includes('@')) {
      query = query.ilike('email', identificador);
    } else {
      query = query.or(`codigo_academico.ilike.${identificador},email.ilike.${identificador}`);
    }

    const { data: registros, error } = await query;
    if (error) throw error;

    if (!registros || registros.length === 0) {
      return { data: { error: 'Inscrição não encontrada.' } };
    }

    if (tokenInformado) {
      const valido = registros.some(
        (r) =>
          String(r.token_recuperacao || '').toUpperCase() === tokenInformado &&
          (!r.token_recuperacao_expira || new Date(r.token_recuperacao_expira) > new Date())
      );
      if (!valido) {
        return { data: { error: 'Código de recuperação inválido ou expirado.' } };
      }
    }

    const novoHash = await gerarHashSenha(novaSenhaLimpa);
    const ids = registros.map((r) => r.id);

    const { error: updErr } = await supabase
      .from('inscricoes')
      .update({
        senha_hash: novoHash,
        token_recuperacao: null,
        token_recuperacao_expira: null,
      })
      .in('id', ids);

    if (updErr) throw updErr;

    return { data: { success: true, mensagem: 'Senha atualizada com sucesso!' } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}