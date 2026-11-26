import { supabase } from '@/lib/supabase';

/**
 * Serviço centralizado de operações do banco de dados (Supabase)
 */

// 1. Listar Agenda Pública (Evento, Horários e Bancas com contagem de vagas)
export async function listarAgendaPublica() {
  try {
    const [eventoRes, horariosRes, bancasRes, inscricoesRes] = await Promise.all([
      supabase.from('configuracao_evento').select('*').limit(1),
      supabase.from('horarios').select('*').eq('ativo', true).order('data', { ascending: true }).order('hora_inicio', { ascending: true }),
      supabase.from('bancas').select('*').neq('status', 'cancelada'),
      supabase.from('inscricoes').select('id, banca_id, tipo'),
    ]);

    const evento = eventoRes.data && eventoRes.data.length > 0 ? eventoRes.data[0] : null;
    const horarios = horariosRes.data || [];
    const bancas = bancasRes.data || [];
    const inscricoes = inscricoesRes.data || [];

    const bancasComVagas = bancas.map((banca) => {
      const inscricoesBanca = inscricoes.filter((i) => i.banca_id === banca.id);
      const espectadores = inscricoesBanca.filter((i) => i.tipo === 'academico' || i.tipo === 'familiar');
      const totalVagas = banca.vagas_espectadores || 30;
      const vagasOcupadas = espectadores.length;

      return {
        id: banca.id,
        titulo_tcc: banca.titulo_tcc,
        horario_id: banca.horario_id,
        horario_descricao: banca.horario_descricao,
        horario_data: banca.horario_data,
        sala_id: banca.sala_id,
        sala_nome: banca.sala_nome,
        orientador_id: banca.orientador_id,
        orientador_nome: banca.orientador_nome,
        apresentador_nome: banca.apresentador_nome,
        status: banca.status,
        vagas_espectadores: totalVagas,
        vagas_ocupadas: vagasOcupadas,
        vagas_restantes: Math.max(0, totalVagas - vagasOcupadas),
        total_inscricoes: inscricoesBanca.length,
      };
    });

    const horariosComContagem = horarios.map((h) => ({
      id: h.id,
      data: h.data,
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
      descricao: h.descricao,
      bancas_count: bancasComVagas.filter((b) => b.horario_id === h.id).length,
    }));

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
              max_bancas_por_horario: evento.max_bancas_por_horario || 2,
            }
          : null,
        horarios: horariosComContagem,
        bancas: bancasComVagas,
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 2. Criar Inscrição (Apresentador ou Espectador)
export async function criarInscricao(body) {
  try {
    if (!body.tipo || !body.nome || !body.email) {
      return { data: { error: 'Campos obrigatórios não preenchidos' } };
    }

    const { data: eventos } = await supabase.from('configuracao_evento').select('*').limit(1);
    const evento = eventos && eventos.length > 0 ? eventos[0] : null;

    if (evento && evento.inscricoes_abertas === false) {
      return { data: { error: 'As inscrições estão fechadas' } };
    }

    const maxBancas = evento?.max_bancas_por_horario || 2;

    if (body.tipo === 'apresentador') {
      if (!body.titulo_tcc || !body.horario_id) {
        return { data: { error: 'Título do TCC e horário são obrigatórios para apresentadores' } };
      }
      if (!body.orientador_id || !body.avaliador1_id || !body.avaliador2_id) {
        return { data: { error: 'Os três professores (orientador, avaliador 1 e avaliador 2) são obrigatórios' } };
      }

      const profIds = [body.orientador_id, body.avaliador1_id, body.avaliador2_id];
      const uniqueIds = new Set(profIds);
      if (uniqueIds.size !== 3) {
        return { data: { error: 'O orientador, avaliador 1 e avaliador 2 devem ser professores diferentes' } };
      }

      const [orientadorRes, avaliador1Res, avaliador2Res, horarioRes] = await Promise.all([
        supabase.from('professores').select('*').eq('id', body.orientador_id).single(),
        supabase.from('professores').select('*').eq('id', body.avaliador1_id).single(),
        supabase.from('professores').select('*').eq('id', body.avaliador2_id).single(),
        supabase.from('horarios').select('*').eq('id', body.horario_id).single(),
      ]);

      const orientador = orientadorRes.data;
      const avaliador1 = avaliador1Res.data;
      const avaliador2 = avaliador2Res.data;
      const horario = horarioRes.data;

      if (!orientador || !avaliador1 || !avaliador2) {
        return { data: { error: 'Professor não encontrado no cadastro' } };
      }
      if (!horario) {
        return { data: { error: 'Horário não encontrado' } };
      }

      const { data: bancasNoHorario } = await supabase.from('bancas').select('*').eq('horario_id', body.horario_id);
      if (bancasNoHorario && bancasNoHorario.length >= maxBancas) {
        return { data: { error: `Máximo de ${maxBancas} apresentações por horário atingido` } };
      }

      if (bancasNoHorario) {
        for (const other of bancasNoHorario) {
          const otherProfIds = [other.orientador_id, other.avaliador1_id, other.avaliador2_id].filter(Boolean);
          for (const pid of profIds) {
            if (otherProfIds.includes(pid)) {
              const conflictProf = pid === body.orientador_id ? orientador : (pid === body.avaliador1_id ? avaliador1 : avaliador2);
              return {
                data: {
                  error: `Este professor (${conflictProf.nome}) já está vinculado a outra banca neste mesmo dia e horário. Selecione outro professor.`
                }
              };
            }
          }
        }
      }

      const horarioDesc = horario.descricao || `${horario.data} • ${horario.hora_inicio} às ${horario.hora_fim}`;

      const { data: novaBanca, error: bancaErr } = await supabase.from('bancas').insert({
        titulo_tcc: body.titulo_tcc,
        horario_id: body.horario_id,
        horario_descricao: horarioDesc,
        horario_data: horario.data,
        orientador_id: body.orientador_id,
        orientador_nome: orientador.nome,
        orientador_user_id: orientador.user_id || null,
        avaliador1_id: body.avaliador1_id,
        avaliador1_nome: avaliador1.nome,
        avaliador2_id: body.avaliador2_id,
        avaliador2_nome: avaliador2.nome,
        apresentador_nome: body.nome,
        apresentador_email: body.email,
        status: 'pendente',
        vagas_espectadores: 30,
      }).select().single();

      if (bancaErr) throw bancaErr;

      const { data: novaInscricao, error: inscErr } = await supabase.from('inscricoes').insert({
        banca_id: novaBanca.id,
        banca_titulo: body.titulo_tcc,
        horario_descricao: horarioDesc,
        horario_data: horario.data,
        orientador_user_id: orientador.user_id || null,
        tipo: 'apresentador',
        nome: body.nome,
        email: body.email,
        cpf: body.cpf || '',
        codigo_academico: body.codigo_academico || '',
        curso: body.curso || 'Psicologia',
        titulo_tcc: body.titulo_tcc,
        orientador_nome: orientador.nome,
        presente: false,
        inclusao_ultima_hora: false,
        email_enviado: true,
        email_status: 'confirmado',
      }).select().single();

      if (inscErr) throw inscErr;

      return { data: { success: true, inscricao_id: novaInscricao.id, banca_id: novaBanca.id } };
    } else {
      if (!body.banca_id) {
        return { data: { error: 'Banca é obrigatória para espectadores' } };
      }

      const { data: banca, error: bancaErr } = await supabase.from('bancas').select('*').eq('id', body.banca_id).single();
      if (bancaErr || !banca) {
        return { data: { error: 'Banca não encontrada' } };
      }

      const { data: todasInscricoes } = await supabase.from('inscricoes').select('id, tipo').eq('banca_id', body.banca_id);
      const espectadores = (todasInscricoes || []).filter((i) => i.tipo === 'academico' || i.tipo === 'familiar');
      if (espectadores.length >= (banca.vagas_espectadores || 30)) {
        return { data: { error: 'Vagas esgotadas para esta banca' } };
      }

      const { data: novaInscricao, error: inscErr } = await supabase.from('inscricoes').insert({
        banca_id: body.banca_id,
        banca_titulo: banca.titulo_tcc,
        horario_descricao: banca.horario_descricao || '',
        horario_data: banca.horario_data || '',
        sala_nome: banca.sala_nome || '',
        orientador_user_id: banca.orientador_user_id || null,
        tipo: body.tipo,
        nome: body.nome,
        email: body.email,
        cpf: body.cpf || '',
        codigo_academico: body.codigo_academico || '',
        curso: body.curso || 'Psicologia',
        semestre: body.semestre || '',
        parentesco: body.parentesco || '',
        presente: false,
        inclusao_ultima_hora: false,
        email_enviado: true,
        email_status: 'confirmado',
      }).select().single();

      if (inscErr) throw inscErr;

      return { data: { success: true, inscricao_id: novaInscricao.id } };
    }
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 3. Consultar Inscrições por E-mail
export async function consultarInscricao({ email }) {
  try {
    if (!email) {
      return { data: { error: 'E-mail é obrigatório' } };
    }

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
        let banca = null;
        if (insc.banca_id) {
          const { data: b } = await supabase.from('bancas').select('*').eq('id', insc.banca_id).maybeSingle();
          banca = b;
        }

        return {
          id: insc.id,
          tipo: insc.tipo,
          nome: insc.nome,
          email: insc.email,
          cpf: insc.cpf,
          codigo_academico: insc.codigo_academico,
          curso: insc.curso,
          semestre: insc.semestre,
          parentesco: insc.parentesco,
          titulo_tcc: insc.titulo_tcc || insc.banca_titulo || banca?.titulo_tcc || '',
          banca_titulo: insc.banca_titulo || banca?.titulo_tcc || '',
          orientador_nome: insc.orientador_nome || banca?.orientador_nome || '',
          avaliador1_nome: banca?.avaliador1_nome || '',
          avaliador2_nome: banca?.avaliador2_nome || '',
          apresentador_nome: banca?.apresentador_nome || '',
          horario_descricao: insc.horario_descricao || banca?.horario_descricao || '',
          horario_data: insc.horario_data || banca?.horario_data || '',
          sala_nome: insc.sala_nome || banca?.sala_nome || '',
          status: banca?.status || null,
          presente: insc.presente,
          inclusao_ultima_hora: insc.inclusao_ultima_hora,
        };
      })
    );

    return { data: { success: true, inscricoes: enriched } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 4. Vincular Usuário Logado ao Cadastro de Professor
export async function vincularProfessorUsuario() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: { error: 'Acesso negado: faça login' } };
    }

    const { data: professores, error } = await supabase
      .from('professores')
      .select('*')
      .ilike('email', user.email);

    if (error || !professores || professores.length === 0) {
      return { data: { error: 'Professor não encontrado no cadastro. Contate a organização do evento.' } };
    }

    const professor = professores[0];
    if (!professor.ativo) {
      return { data: { error: 'Seu cadastro está inativo. Contate a organização do evento.' } };
    }

    if (!professor.user_id || professor.user_id !== user.id) {
      await supabase.from('professores').update({ user_id: user.id }).eq('id', professor.id);
      await supabase.from('perfis').update({ role: 'professor' }).eq('id', user.id);
    }

    return {
      data: {
        success: true,
        professor: {
          id: professor.id,
          nome: professor.nome,
          email: professor.email,
          telefone: professor.telefone,
          ativo: professor.ativo,
          user_id: user.id,
        },
      },
    };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 5. Confirmar / Alternar Presença de Aluno
export async function confirmarPresenca({ inscricao_id, presente }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Não autorizado' } };

    const { data: inscricao, error: inscErr } = await supabase
      .from('inscricoes')
      .select('*')
      .eq('id', inscricao_id)
      .single();

    if (inscErr || !inscricao) return { data: { error: 'Inscrição não encontrada' } };

    await supabase.from('inscricoes').update({ presente }).eq('id', inscricao_id);

    // Grava registro de presença
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

// 6. Professor Adicionar Aluno de Última Hora
export async function adicionarAlunoUltimaHora(body) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: { error: 'Não autorizado' } };

    const { banca_id, tipo, nome, email, cpf, codigo_academico, curso, semestre, parentesco } = body;
    if (!banca_id || !tipo || !nome || !email) {
      return { data: { error: 'Campos obrigatórios não preenchidos' } };
    }

    const { data: banca } = await supabase.from('bancas').select('*').eq('id', banca_id).single();
    if (!banca) return { data: { error: 'Banca não encontrada' } };

    const { data: novaInscricao, error: err } = await supabase.from('inscricoes').insert({
      banca_id,
      banca_titulo: banca.titulo_tcc,
      horario_descricao: banca.horario_descricao || '',
      horario_data: banca.horario_data || '',
      sala_nome: banca.sala_nome || '',
      orientador_user_id: banca.orientador_user_id || null,
      tipo,
      nome,
      email,
      cpf: cpf || '',
      codigo_academico: codigo_academico || '',
      curso: curso || 'Psicologia',
      semestre: semestre || '',
      parentesco: parentesco || '',
      presente: true,
      inclusao_ultima_hora: true,
      added_by_professor_id: user.id,
      added_by_professor_nome: user.user_metadata?.full_name || user.email,
      email_enviado: true,
      email_status: 'confirmado',
    }).select().single();

    if (err) throw err;

    return { data: { success: true, inscricao_id: novaInscricao.id } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}

// 7. Admin Atualizar Professores da Banca com Verificação de Conflitos
export async function atualizarProfessoresBanca(body) {
  try {
    const { banca_id, orientador_id, avaliador1_id, avaliador2_id } = body;
    const { data: banca } = await supabase.from('bancas').select('*').eq('id', banca_id).single();
    if (!banca) return { data: { error: 'Banca não encontrada' } };

    const finalOrientador = orientador_id !== undefined ? orientador_id : banca.orientador_id;
    const finalAvaliador1 = avaliador1_id !== undefined ? avaliador1_id : banca.avaliador1_id;
    const finalAvaliador2 = avaliador2_id !== undefined ? avaliador2_id : banca.avaliador2_id;
    const profIds = [finalOrientador, finalAvaliador1, finalAvaliador2].filter(Boolean);

    if (profIds.length === 3) {
      if (new Set(profIds).size !== 3) {
        return { data: { error: 'O orientador, avaliador 1 e avaliador 2 devem ser professores diferentes.' } };
      }
    }

    if (banca.horario_id) {
      const { data: otherBancas } = await supabase.from('bancas').select('*').eq('horario_id', banca.horario_id).neq('id', banca_id);
      if (otherBancas) {
        for (const other of otherBancas) {
          const otherProfIds = [other.orientador_id, other.avaliador1_id, other.avaliador2_id].filter(Boolean);
          for (const pid of profIds) {
            if (otherProfIds.includes(pid)) {
              const { data: prof } = await supabase.from('professores').select('nome').eq('id', pid).maybeSingle();
              return { data: { error: `Este professor (${prof?.nome || pid}) já está vinculado a outra banca neste mesmo dia e horário.` } };
            }
          }
        }
      }
    }

    const updates = {};
    if (orientador_id !== undefined) {
      if (!orientador_id) {
        updates.orientador_id = null;
        updates.orientador_nome = '';
        updates.orientador_user_id = null;
      } else {
        const { data: p } = await supabase.from('professores').select('*').eq('id', orientador_id).single();
        updates.orientador_id = orientador_id;
        updates.orientador_nome = p?.nome || '';
        updates.orientador_user_id = p?.user_id || null;
      }
    }

    if (avaliador1_id !== undefined) {
      if (!avaliador1_id) {
        updates.avaliador1_id = null;
        updates.avaliador1_nome = '';
      } else {
        const { data: p } = await supabase.from('professores').select('*').eq('id', avaliador1_id).single();
        updates.avaliador1_id = avaliador1_id;
        updates.avaliador1_nome = p?.nome || '';
      }
    }

    if (avaliador2_id !== undefined) {
      if (!avaliador2_id) {
        updates.avaliador2_id = null;
        updates.avaliador2_nome = '';
      } else {
        const { data: p } = await supabase.from('professores').select('*').eq('id', avaliador2_id).single();
        updates.avaliador2_id = avaliador2_id;
        updates.avaliador2_nome = p?.nome || '';
      }
    }

    await supabase.from('bancas').update(updates).eq('id', banca_id);

    if (updates.orientador_user_id !== undefined) {
      await supabase.from('inscricoes').update({ orientador_user_id: updates.orientador_user_id }).eq('banca_id', banca_id);
    }

    return { data: { success: true } };
  } catch (error) {
    return { data: { error: error.message } };
  }
}
