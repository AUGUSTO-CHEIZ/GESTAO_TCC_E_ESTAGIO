import { supabase } from '@/lib/supabase';

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

    // --- FLUXO APRESENTADOR ---
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
          data: { error: 'Selecione o Avaliador 2 do curso ou preencha os dados do avaliador externo.' },
        };
      }
      if (
        isExterno &&
        (!body.avaliador2_externo_titulacao ||
          !body.avaliador2_externo_nome ||
          !body.avaliador2_externo_email)
      ) {
        return {
          data: { error: 'Preencha titulação, nome completo e e-mail do avaliador externo.' },
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

    // --- FLUXO ESPECTADOR (SUPORTA 1 OU VÁRIAS BANCAS) ---
    if (body.tipo === 'academico' && !body.email) {
      return { data: { error: 'E-mail é obrigatório para acadêmicos.' } };
    }

    const bancaIds =
      Array.isArray(body.banca_ids) && body.banca_ids.length > 0
        ? body.banca_ids
        : body.banca_id
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

    // Bloqueia choque de mesmo dia e horário entre as bancas selecionadas
    const chavesHorario = new Set();
    for (const b of bancasAlvo) {
      const chave = b.horario_id || `${b.horario_data}_${b.horario_descricao}`;
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

    // Valida trava de 15 minutos da 2ª hora e disponibilidade de vagas
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

    const registros = bancasAlvo.map((b) => ({
      banca_id: b.id,
      banca_titulo: b.titulo_tcc,
      horario_descricao: b.horario_descricao || '',
      horario_data: b.horario_data || '',
      sala_nome: b.sala_nome || '',
      orientador_user_id: b.orientador_user_id || null,
      tipo: body.tipo,
      nome: body.nome,
      email: body.email || '',
      cpf: body.cpf || '',
      codigo_academico: body.codigo_academico || '',
      curso: body.curso || 'Psicologia',
      semestre: body.semestre || '',
      parentesco: body.parentesco || '',
      etapa_chamada: b.chamada1_concluida ? 2 : 1,
      presente: false,
      inclusao_ultima_hora: false,
      email_enviado: Boolean(body.email),
      email_status: body.email ? 'confirmado' : 'sem_email',
    }));

    const { error: insertErr } = await supabase.from('inscricoes').insert(registros);
    if (insertErr) throw insertErr;

    return { data: { success: true, total: registros.length } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 4. Consultar Inscrições por E-mail
export async function consultarInscricao({ email }) {
  try {
    if (!email) return { data: { error: 'E-mail é obrigatório' } };

    const { data: inscricoes, error } = await supabase
      .from('inscricoes')
      .select('*')
      .ilike('email', email.trim());

    if (error) throw error;
    if (!inscricoes || inscricoes.length === 0) {
      return { data: { error: 'Nenhuma inscrição encontrada para este e-mail.' } };
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

// 5. Vincular Usuário Logado ao Cadastro de Professor
export async function vincularProfessorUsuario() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Acesso negado: faça login' } };

    const { data: professores, error } = await supabase
      .from('professores')
      .select('*')
      .ilike('email', user.email);

    if (error || !professores || professores.length === 0) {
      return {
        data: { error: 'Professor não encontrado no cadastro. Contate a organização do evento.' },
      };
    }

    const professor = professores[0];
    if (!professor.ativo) {
      return {
        data: { error: 'Seu cadastro está inativo. Contate a organização do evento.' },
      };
    }

    if (!professor.user_id || professor.user_id !== user.id) {
      await supabase.from('professores').update({ user_id: user.id }).eq('id', professor.id);
      await supabase.from('perfis').update({ role: 'professor' }).eq('id', user.id);
    }

    return { data: { success: true, professor: { ...professor, user_id: user.id } } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 6. Confirmar Presença (1ª ou 2ª Chamada)
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

    await supabase.from('inscricoes').update(updates).eq('id', inscricao_id);

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

    return { data: { success: true } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 7. Concluir 1ª Chamada: move ausentes para histórico e libera vagas para 2ª hora
export async function finalizarPrimeiraChamada({ banca_id, horario_chamada }) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Não autorizado' } };

    const { data: banca } = await supabase.from('bancas').select('*').eq('id', banca_id).single();
    if (!banca) return { data: { error: 'Banca não encontrada' } };

    const { data: inscricoes } = await supabase
      .from('inscricoes')
      .select('*')
      .eq('banca_id', banca_id);

    const ausentes = (inscricoes || []).filter(
      (i) => i.tipo !== 'apresentador' && !i.presente_chamada1 && !i.presente
    );

    if (ausentes.length > 0) {
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
      await supabase
        .from('inscricoes')
        .delete()
        .in(
          'id',
          ausentes.map((a) => a.id)
        );
    }

    await supabase
      .from('bancas')
      .update({
        chamada1_concluida: true,
        chamada1_horario: horario_chamada || new Date().toTimeString().slice(0, 5),
      })
      .eq('id', banca_id);

    return { data: { success: true, vagas_liberadas: ausentes.length } };
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

    const { data: novaInscricao, error: err } = await supabase
      .from('inscricoes')
      .insert({
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
      })
      .select()
      .single();

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
    const email = emailRaw.trim();

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