// Gravações no Supabase. Cada função lança o erro do banco (traduzido em
// erros.ts por quem chama); as regras e permissões ficam no próprio banco.

import type { SupabaseClient } from '@supabase/supabase-js';
import { SemPermissao } from './erros';
import { sairDesteAparelho } from './supabase';
import type {
  ConferenciaFantasia, Contratante, Despesa, DisponibilidadeSemanalDia, DocumentoProfissional, Evento, EscalaItem, Fantasia, FuncaoProfissional, Local, PagamentoProfissional, PerfilAcesso,
  AdicionalProdutor, Personagem, Profissional, Recebimento, ReservaVeiculo, SituacaoLogin, Usuario, Veiculo, VideoEvento,
} from './tipos';
import type { Notificacao } from './tipos';

type Cliente = SupabaseClient;
type Resposta<T> = { data: T; error: unknown };

export const DOCUMENTOS_ARTISTAS_BUCKET = 'documentos-artistas';
export const MAX_DOCUMENTO_ARTISTA_BYTES = 10 * 1024 * 1024;
export const TIPOS_DOCUMENTO_ARTISTA = ['Contrato', 'Documento de identificação', 'Comprovante', 'Outro'] as const;
export const VIDEOS_EVENTOS_BUCKET = 'videos-eventos';
export const MAX_VIDEO_EVENTO_BYTES = 50 * 1024 * 1024;

function ok<T>(r: Resposta<T>): T {
  if (r.error) throw r.error;
  return r.data;
}

/** Texto vazio vira nulo, para o banco não guardar "" no lugar de "sem valor" */
export const vazioParaNulo = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Insere e devolve o id; ou atualiza e confere que a linha foi mesmo alterada (RLS não dá erro, só ignora) */
async function salvar<T extends object>(c: Cliente, tabela: string, id: string | undefined, dados: T): Promise<string> {
  if (!id) {
    const linha = ok(await c.from(tabela).insert(dados).select('id').single()) as { id: string };
    return linha.id;
  }
  const linhas = ok(await c.from(tabela).update(dados).eq('id', id).select('id')) as unknown[];
  if (!linhas.length) throw new SemPermissao();
  return id;
}

async function salvarNota(c: Cliente, tabela: string, coluna: string, id: string, texto: string | null) {
  if (texto) {
    ok(await c.from(tabela).upsert({ [coluna]: id, observacoes: texto, atualizado_em: new Date().toISOString() }));
  } else {
    ok(await c.from(tabela).delete().eq(coluna, id));
  }
}

// ---------------------------------------------------------------------
// Cadastros
// ---------------------------------------------------------------------

export type DadosProfissional = Pick<Profissional, 'nome' | 'telefone' | 'email' | 'disponibilidade' | 'ativo'> & {
  funcoes: FuncaoProfissional[];
};

export async function salvarProfissional(
  c: Cliente, id: string | undefined, dados: DadosProfissional,
  personagens: { atuais: string[]; novos: string[] }, nota: string | null,
): Promise<string> {
  const profissionalId = await salvar(c, 'profissionais', id, dados);

  const novos = dados.funcoes.includes('artista') ? personagens.novos : [];
  const sair = personagens.atuais.filter((p) => !novos.includes(p));
  const entrar = novos.filter((p) => !personagens.atuais.includes(p));
  if (sair.length) {
    ok(await c.from('profissional_personagens').delete().eq('profissional_id', profissionalId).in('personagem_id', sair));
  }
  if (entrar.length) {
    ok(await c.from('profissional_personagens').insert(entrar.map((p) => ({ profissional_id: profissionalId, personagem_id: p }))));
  }

  await salvarNota(c, 'profissionais_notas', 'profissional_id', profissionalId, nota);
  return profissionalId;
}

export const salvarPersonagem = (c: Cliente, id: string | undefined, dados: Omit<Personagem, 'id'>) =>
  salvar(c, 'personagens', id, dados);

export const salvarFantasia = (c: Cliente, id: string | undefined, dados: Omit<Fantasia, 'id'>) =>
  salvar(c, 'fantasias', id, dados);

export async function salvarContratante(c: Cliente, id: string | undefined, dados: Omit<Contratante, 'id'>, nota: string | null) {
  const contratanteId = await salvar(c, 'contratantes', id, dados);
  await salvarNota(c, 'contratantes_notas', 'contratante_id', contratanteId, nota);
  return contratanteId;
}

export const salvarLocal = (c: Cliente, id: string | undefined, dados: Omit<Local, 'id'>) =>
  salvar(c, 'locais', id, dados);

export const salvarVeiculo = (c: Cliente, id: string | undefined, dados: Omit<Veiculo, 'id'>) =>
  salvar(c, 'veiculos', id, dados);

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------

export type DadosEvento = Pick<Evento,
  'titulo' | 'aniversariante' | 'idade' | 'contratante_id' | 'local_id' | 'inicio' | 'fim' | 'situacao'
  | 'tem_maquiagem' | 'maquiagem_pessoas' | 'orientacoes'>;

/**
 * Cria o evento ou atualiza os dados. Data e horário de um evento existente só
 * mudam pela remarcação (o banco recusa a alteração direta), por isso ficam de fora.
 */
export async function salvarEvento(
  c: Cliente, id: string | undefined, dados: DadosEvento, valorContratado: number | null,
): Promise<string> {
  const { inicio, fim, ...semHorario } = dados;
  const eventoId = await salvar(c, 'eventos', id, id ? semHorario : { ...semHorario, inicio, fim });
  if (valorContratado !== null) {
    ok(await c.from('evento_financeiro').upsert({
      evento_id: eventoId, valor_contratado: valorContratado, atualizado_em: new Date().toISOString(),
    }));
  }
  return eventoId;
}

export async function adicionarOrientacaoEvento(c: Cliente, id: string, atuais: string | null, nova: string) {
  const orientacao = nova.trim();
  const existentes = (atuais ?? '').split('\n').map((linha) => linha.trim()).filter(Boolean);
  const linhas = ok(await c.from('eventos').update({ orientacoes: [...existentes, orientacao].join('\n') }).eq('id', id).select('id')) as unknown[];
  if (!linhas.length) throw new SemPermissao();
}

export async function remarcarEvento(c: Cliente, id: string, inicio: string, fim: string, motivo: string) {
  ok(await c.rpc('remarcar_evento', { p_evento_id: id, p_inicio: inicio, p_fim: fim, p_motivo: motivo }));
}

export async function cancelarEvento(c: Cliente, id: string, motivo: string) {
  ok(await c.rpc('cancelar_evento', { p_evento_id: id, p_motivo: motivo }));
}

export type DadosEscala = Pick<EscalaItem,
  'evento_id' | 'profissional_id' | 'funcao' | 'personagem_id' | 'fantasia_id' | 'maquiar' | 'horario_maquiagem'>;

export async function escalar(c: Cliente, dados: DadosEscala) {
  ok(await c.from('evento_escala').insert(dados));
}

export async function salvarDisponibilidadeSemanal(
  c: Cliente,
  semanaInicio: string,
  dias: Pick<DisponibilidadeSemanalDia, 'dia' | 'disponivel' | 'hora_inicio' | 'hora_fim' | 'observacoes'>[],
) {
  ok(await c.rpc('salvar_disponibilidade_semanal', {
    p_semana_inicio: semanaInicio,
    p_dias: dias,
  }));
}

/** Ninguém sai da tabela: a vaga fica inativa e o histórico guarda quem estava */
export async function tirarDaEscala(c: Cliente, escalaId: string) {
  const linhas = ok(await c.from('evento_escala').update({ ativo: false }).eq('id', escalaId).select('id')) as unknown[];
  if (!linhas.length) throw new SemPermissao();
}

// ---------------------------------------------------------------------
// Veículo
// ---------------------------------------------------------------------

export type DadosReserva = Pick<ReservaVeiculo,
  'veiculo_id' | 'evento_id' | 'responsavel_id' | 'retirada' | 'devolucao_prevista' | 'observacoes'>;

export const salvarReserva = (c: Cliente, id: string | undefined, dados: DadosReserva) =>
  salvar(c, 'reservas_veiculo', id, dados);

/** A reserva não é apagada: fica inativa e libera o horário do veículo */
export async function cancelarReserva(c: Cliente, id: string) {
  await salvar(c, 'reservas_veiculo', id, { ativo: false });
}

export async function registrarDevolucao(c: Cliente, id: string, quando: string) {
  await salvar(c, 'reservas_veiculo', id, { devolvido_em: quando });
}

// ---------------------------------------------------------------------
// Valores (recebimentos e pagamentos: só gestão; despesas: gestão e equipe do evento)
// ---------------------------------------------------------------------

export const salvarRecebimento = (c: Cliente, id: string | undefined, dados: Omit<Recebimento, 'id'>) =>
  salvar(c, 'recebimentos', id, dados);

export type DadosPagamento = Pick<PagamentoProfissional, 'profissional_id' | 'valor_combinado' | 'situacao' | 'pago_em'>;

/** Grava o valor combinado de cada profissional do evento (uma linha por pessoa) */
export async function salvarPagamentos(c: Cliente, eventoId: string, linhas: DadosPagamento[]) {
  if (!linhas.length) return;
  ok(await c.from('pagamentos_profissionais')
    .upsert(linhas.map((l) => ({ ...l, evento_id: eventoId, cancelado_em: null })), { onConflict: 'evento_id,profissional_id' }));
}

export type DadosDespesa = Pick<Despesa, 'evento_id' | 'tipo' | 'descricao' | 'valor' | 'responsavel_id' | 'comprovante' | 'observacoes'>;

export const DESPESAS_COMPROVANTES_BUCKET = 'despesas-comprovantes';
export const MAX_DESPESA_COMPROVANTE_BYTES = 10 * 1024 * 1024;
const TIPOS_DESPESA_COMPROVANTE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function caminhoComprovanteDespesa(eventoId: string | null, usuarioId: string, arquivo: File) {
  const nome = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'comprovante';
  return `${eventoId ?? 'geral'}/${usuarioId}/${crypto.randomUUID()}-${nome}`;
}

export async function salvarDespesa(
  c: Cliente, id: string | undefined, dados: DadosDespesa, arquivo?: File | null, comprovanteAnterior?: string | null,
) {
  let novoCaminho: string | null = null;
  if (arquivo) {
    if (!TIPOS_DESPESA_COMPROVANTE.includes(arquivo.type)) throw new Error('Envie uma imagem JPG, PNG, WEBP ou um PDF.');
    if (arquivo.size > MAX_DESPESA_COMPROVANTE_BYTES) throw new Error('O comprovante precisa ter no máximo 10 MB.');
    const respostaUsuario = await c.auth.getUser();
    if (respostaUsuario.error) throw respostaUsuario.error;
    const usuario = respostaUsuario.data.user;
    if (!usuario) throw new SemPermissao();
    novoCaminho = caminhoComprovanteDespesa(dados.evento_id, usuario.id, arquivo);
    ok(await c.storage.from(DESPESAS_COMPROVANTES_BUCKET).upload(novoCaminho, arquivo, {
      cacheControl: '3600', upsert: false, contentType: arquivo.type,
    }));
  }

  try {
    const metadados = arquivo && novoCaminho ? {
      comprovante_path: novoCaminho,
      comprovante_nome: arquivo.name,
      comprovante_mime: arquivo.type,
      comprovante_tamanho: arquivo.size,
    } : {};
    const payload = { ...dados, ...metadados };
    if (!id) {
      const linha = ok(await c.from('despesas').insert(payload).select('id').single()) as { id: string };
      return linha.id;
    }
    const linhas = ok(await c.from('despesas').update(payload).eq('id', id).select('id')) as unknown[];
    if (!linhas.length) throw new SemPermissao();
    if (novoCaminho && comprovanteAnterior) {
      await c.storage.from(DESPESAS_COMPROVANTES_BUCKET).remove([comprovanteAnterior]);
    }
    return id;
  } catch (erro) {
    if (novoCaminho) await c.storage.from(DESPESAS_COMPROVANTES_BUCKET).remove([novoCaminho]);
    throw erro;
  }
}

export async function urlComprovanteDespesa(c: Cliente, caminho: string) {
  const resposta = await c.storage.from(DESPESAS_COMPROVANTES_BUCKET).createSignedUrl(caminho, 300);
  if (resposta.error) throw resposta.error;
  if (!resposta.data?.signedUrl) throw new Error('Não foi possível abrir o comprovante. Tente novamente.');
  return resposta.data.signedUrl;
}

export async function abrirComprovanteDespesa(c: Cliente, caminho: string) {
  const novaAba = window.open('', '_blank');
  try {
    const url = await urlComprovanteDespesa(c, caminho);
    if (novaAba) {
      novaAba.opener = null;
      novaAba.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (erro) {
    novaAba?.close();
    throw erro;
  }
}

export async function decidirDespesa(c: Cliente, id: string, aprova: boolean) {
  await salvar(c, 'despesas', id, { aprovacao: aprova ? 'aprovada' : 'recusada' });
}

export const ADICIONAIS_PRODUTORES_BUCKET = 'adicionais-produtores';
export const MAX_ADICIONAL_PRODUTOR_BYTES = 10 * 1024 * 1024;

function validarFotoAdicional(arquivo: File) {
  const tiposAceitos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tiposAceitos.includes(arquivo.type)) throw new Error('Envie uma foto JPG, PNG ou WEBP.');
  if (arquivo.size > MAX_ADICIONAL_PRODUTOR_BYTES) throw new Error('A foto precisa ter no máximo 10 MB.');
}

function caminhoFotoAdicional(produtorId: string, arquivo: File) {
  const nome = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'comprovante';
  return `${produtorId}/${crypto.randomUUID()}-${nome}`;
}

export type DadosAdicionalProdutor = Pick<AdicionalProdutor, 'produtor_id' | 'valor' | 'data' | 'descricao'>;

export async function salvarAdicionalProdutor(
  c: Cliente, id: string | undefined, dados: DadosAdicionalProdutor, arquivo: File | null, fotoAnterior?: string,
) {
  if (!id && !arquivo) throw new Error('Escolha uma foto ou comprovante.');
  const foto = arquivo ? (() => {
    validarFotoAdicional(arquivo);
    return { caminho: caminhoFotoAdicional(dados.produtor_id, arquivo), nome: arquivo.name, mime: arquivo.type, tamanho: arquivo.size };
  })() : null;
  if (foto && arquivo) {
    ok(await c.storage.from(ADICIONAIS_PRODUTORES_BUCKET).upload(foto.caminho, arquivo, {
      cacheControl: '3600', upsert: false, contentType: arquivo.type,
    }));
  }
  try {
    const payload = {
      ...dados,
      ...(foto ? { foto_path: foto.caminho, foto_nome: foto.nome, foto_mime: foto.mime, foto_tamanho: foto.tamanho } : {}),
      atualizado_em: new Date().toISOString(),
    };
    const salvo = id
      ? ok(await c.from('adicionais_produtores').update(payload).eq('id', id).select('id')) as unknown[]
      : [ok(await c.from('adicionais_produtores').insert({ ...payload, foto_path: foto!.caminho, foto_nome: foto!.nome, foto_mime: foto!.mime, foto_tamanho: foto!.tamanho }).select('id').single())];
    if (!salvo.length) throw new SemPermissao();
    if (foto && fotoAnterior) await c.storage.from(ADICIONAIS_PRODUTORES_BUCKET).remove([fotoAnterior]);
    return id ?? (salvo[0] as { id: string }).id;
  } catch (erro) {
    if (foto) await c.storage.from(ADICIONAIS_PRODUTORES_BUCKET).remove([foto.caminho]);
    throw erro;
  }
}

export async function cancelarAdicionalProdutor(c: Cliente, id: string) {
  const linhas = ok(await c.from('adicionais_produtores').update({
    cancelado_em: new Date().toISOString(), cancelado_por: (await c.auth.getUser()).data.user?.id ?? null,
    atualizado_em: new Date().toISOString(),
  }).eq('id', id).is('cancelado_em', null).select('id')) as unknown[];
  if (!linhas.length) throw new SemPermissao();
}

// ---------------------------------------------------------------------
// Conferência das fantasias depois do evento
// ---------------------------------------------------------------------

export type DadosConferencia = Pick<ConferenciaFantasia,
  'fantasia_id' | 'devolvida' | 'condicao' | 'precisa_limpeza' | 'precisa_reparo' | 'pendencias'>;

/**
 * Grava a conferência de cada fantasia do evento. O banco muda a situação da
 * fantasia sozinho (limpeza ou manutenção); aqui só entra a previsão de volta.
 */
export async function salvarConferencias(
  c: Cliente, eventoId: string, linhas: DadosConferencia[], previsoes: { fantasia_id: string; previsao: string }[],
) {
  if (!linhas.length) return;
  ok(await c.from('conferencias_fantasia').upsert(
    linhas.map((l) => ({ ...l, evento_id: eventoId, conferido_em: new Date().toISOString() })),
    { onConflict: 'evento_id,fantasia_id' },
  ));
  for (const p of previsoes) {
    await salvar(c, 'fantasias', p.fantasia_id, { previsao_disponivel: p.previsao });
  }
}

export async function marcarRealizado(c: Cliente, eventoId: string) {
  await salvar(c, 'eventos', eventoId, { situacao: 'realizado' });
}

// ---------------------------------------------------------------------
// Minha conta
// ---------------------------------------------------------------------

export async function atualizarMinhaConta(c: Cliente, dados: {
  nome: string; telefone: string | null; disponibilidade: string | null;
}) {
  ok(await c.rpc('atualizar_minha_conta', {
    p_nome: dados.nome, p_telefone: dados.telefone, p_disponibilidade: dados.disponibilidade,
  }));
}

export async function atualizarAbasMobile(c: Cliente, abas: string[]) {
  ok(await c.rpc('atualizar_abas_mobile', { p_abas: abas }));
}

export async function atualizarMeuEmail(c: Cliente, email: string) {
  const { error } = await c.auth.updateUser({ email });
  if (error) throw error;
}

export async function enviarFotoPerfil(c: Cliente, usuarioId: string, arquivo: File, caminhoAnterior: string | null) {
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() || 'jpg';
  const caminho = `${usuarioId}/avatar-${Date.now()}.${extensao}`;
  ok(await c.storage.from('avatares').upload(caminho, arquivo, { cacheControl: '3600', upsert: false }));
  try {
    ok(await c.rpc('atualizar_foto_minha_conta', { p_foto_path: caminho }));
  } catch (erro) {
    await c.storage.from('avatares').remove([caminho]);
    throw erro;
  }
  if (caminhoAnterior) await c.storage.from('avatares').remove([caminhoAnterior]);
}

export async function removerFotoPerfil(c: Cliente, caminho: string) {
  ok(await c.rpc('atualizar_foto_minha_conta', { p_foto_path: null }));
  await c.storage.from('avatares').remove([caminho]);
}

function validarDocumentoProfissional(arquivo: File) {
  const tiposAceitos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!tiposAceitos.includes(arquivo.type)) throw new Error('Envie um PDF, JPG, PNG ou WEBP.');
  if (arquivo.size > MAX_DOCUMENTO_ARTISTA_BYTES) throw new Error('O documento precisa ter no máximo 10 MB.');
}

function caminhoDocumentoProfissional(profissionalId: string, arquivo: File) {
  const nome = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'documento';
  return `${profissionalId}/${crypto.randomUUID()}-${nome}`;
}

export async function enviarDocumentoProfissional(c: Cliente, profissionalId: string, tipo: string, arquivo: File) {
  validarDocumentoProfissional(arquivo);
  const caminho = caminhoDocumentoProfissional(profissionalId, arquivo);
  ok(await c.storage.from(DOCUMENTOS_ARTISTAS_BUCKET).upload(caminho, arquivo, {
    cacheControl: '3600', upsert: false, contentType: arquivo.type,
  }));
  try {
    const documento = ok(await c.from('documentos_artistas').insert({
      profissional_id: profissionalId, tipo: tipo.trim(), nome: arquivo.name,
      storage_path: caminho, mime_type: arquivo.type, tamanho_bytes: arquivo.size,
    }).select('id').single()) as { id: string };
    return documento.id;
  } catch (erro) {
    await c.storage.from(DOCUMENTOS_ARTISTAS_BUCKET).remove([caminho]);
    throw erro;
  }
}

export async function removerDocumentoProfissional(c: Cliente, documento: DocumentoProfissional) {
  ok(await c.storage.from(DOCUMENTOS_ARTISTAS_BUCKET).remove([documento.storage_path]));
  const linhas = ok(await c.from('documentos_artistas').delete().eq('id', documento.id).select('id')) as unknown[];
  if (!linhas.length) throw new SemPermissao();
}

export async function substituirDocumentoProfissional(c: Cliente, documento: DocumentoProfissional, tipo: string, arquivo: File) {
  const novoId = await enviarDocumentoProfissional(c, documento.profissional_id, tipo, arquivo);
  try {
    await removerDocumentoProfissional(c, documento);
  } catch (erro) {
    const novo = ok(await c.from('documentos_artistas').select('storage_path').eq('id', novoId).single()) as { storage_path: string };
    await c.storage.from(DOCUMENTOS_ARTISTAS_BUCKET).remove([novo.storage_path]);
    await c.from('documentos_artistas').delete().eq('id', novoId);
    throw erro;
  }
}

const TIPOS_VIDEO_EVENTO = ['video/mp4', 'video/webm', 'video/quicktime'];

export async function enviarVideoEvento(c: Cliente, eventoId: string, arquivo: File) {
  if (!TIPOS_VIDEO_EVENTO.includes(arquivo.type)) throw new Error('Envie um vídeo MP4, WEBM ou MOV.');
  if (arquivo.size > MAX_VIDEO_EVENTO_BYTES) throw new Error('O vídeo precisa ter no máximo 50 MB. Reduza o tamanho e tente novamente.');
  const respostaUsuario = await c.auth.getUser();
  if (respostaUsuario.error) throw respostaUsuario.error;
  const usuario = respostaUsuario.data.user;
  if (!usuario) throw new SemPermissao();

  const anterior = ok(await c.from('videos_eventos').select('storage_path').eq('evento_id', eventoId).maybeSingle()) as { storage_path: string } | null;
  const nome = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'video';
  const caminho = `${eventoId}/${usuario.id}/${crypto.randomUUID()}-${nome}`;
  ok(await c.storage.from(VIDEOS_EVENTOS_BUCKET).upload(caminho, arquivo, {
    cacheControl: '3600', upsert: false, contentType: arquivo.type,
  }));
  try {
    ok(await c.from('videos_eventos').upsert({
      evento_id: eventoId, storage_path: caminho, nome: arquivo.name,
      mime_type: arquivo.type, tamanho_bytes: arquivo.size, enviado_por: usuario.id,
      enviado_em: new Date().toISOString(),
    }, { onConflict: 'evento_id' }));
  } catch (erro) {
    await c.storage.from(VIDEOS_EVENTOS_BUCKET).remove([caminho]);
    throw erro;
  }
  if (anterior?.storage_path) await c.storage.from(VIDEOS_EVENTOS_BUCKET).remove([anterior.storage_path]);
}

export async function abrirVideoEvento(c: Cliente, video: VideoEvento) {
  const novaAba = window.open('', '_blank');
  try {
    const resposta = await c.storage.from(VIDEOS_EVENTOS_BUCKET).createSignedUrl(video.storage_path, 3600);
    if (resposta.error) throw resposta.error;
    if (!resposta.data?.signedUrl) throw new Error('Não foi possível abrir o vídeo. Tente novamente.');
    if (novaAba) {
      novaAba.opener = null;
      novaAba.location.href = resposta.data.signedUrl;
    } else {
      window.location.href = resposta.data.signedUrl;
    }
  } catch (erro) {
    novaAba?.close();
    throw erro;
  }
}

// ---------------------------------------------------------------------
// Troca de artista (pedido, resposta do indicado e desistência)
// ---------------------------------------------------------------------

/** Artistas que fazem o personagem e estão livres no horário */
export async function buscarSubstitutos(c: Cliente, escalaId: string): Promise<{ profissional_id: string; nome: string }[]> {
  return ok(await c.rpc('substitutos_disponiveis', { p_escala_id: escalaId })) as { profissional_id: string; nome: string }[];
}

export async function pedirTroca(c: Cliente, escalaId: string, substitutoId: string, motivo: string | null) {
  ok(await c.rpc('solicitar_substituicao', { p_escala_id: escalaId, p_substituto_id: substitutoId, p_motivo: motivo }));
}

export async function responderTroca(c: Cliente, substituicaoId: string, aceita: boolean) {
  ok(await c.rpc('responder_substituicao', { p_substituicao_id: substituicaoId, p_aceita: aceita }));
}

export async function desistirDaTroca(c: Cliente, substituicaoId: string) {
  ok(await c.rpc('cancelar_substituicao', { p_substituicao_id: substituicaoId }));
}

// ---------------------------------------------------------------------
// Configurações e usuários (só a gestão altera)
// ---------------------------------------------------------------------

/** Grava só as chaves que mudaram. A tabela não tem id: a chave é o nome da configuração. */
export async function salvarConfiguracoes(c: Cliente, mudancas: Record<string, string>) {
  for (const [chave, valor] of Object.entries(mudancas)) {
    const linhas = ok(await c.from('configuracoes').update({ valor }).eq('chave', chave).select('chave')) as unknown[];
    if (!linhas.length) throw new SemPermissao();
  }
}

export async function salvarPreferenciasNotificacao(
  c: Cliente,
  usuarioId: string,
  preferencias: Pick<Notificacao, 'tipo'>[] | { tipo: Notificacao['tipo']; ativa: boolean }[],
) {
  ok(await c.from('notificacao_preferencias').upsert(
    preferencias.map((p) => ({ usuario_id: usuarioId, tipo: p.tipo, ativa: 'ativa' in p ? p.ativa : true, atualizado_em: new Date().toISOString() })),
    { onConflict: 'usuario_id,tipo' },
  ));
}

export async function marcarNotificacaoLida(c: Cliente, id: string) {
  ok(await c.from('notificacoes').update({ lida_em: new Date().toISOString() }).eq('id', id));
}

export async function salvarInscricaoPush(c: Cliente, inscricao: PushSubscriptionJSON) {
  if (!inscricao.endpoint || !inscricao.keys?.p256dh || !inscricao.keys.auth) throw new Error('Inscrição do navegador inválida.');
  const { data: sessao } = await c.auth.getUser();
  if (!sessao.user) throw new Error('Sua sessão expirou. Entre novamente para ativar as notificações.');
  ok(await c.from('push_inscricoes').upsert({
    usuario_id: sessao.user.id,
    endpoint: inscricao.endpoint,
    p256dh: inscricao.keys.p256dh,
    auth: inscricao.keys.auth,
  }, { onConflict: 'endpoint' }));
}

// ---------------------------------------------------------------------
// Logins (Edge Function "usuarios": a chave de administrador fica no servidor)
// ---------------------------------------------------------------------

async function chamarUsuarios<T>(c: Cliente, corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await c.functions.invoke('usuarios', { body: corpo });
  if (!error) return data as T;
  const resposta = (error as { context?: Response }).context;
  if (resposta instanceof Response) {
    // Sessão encerrada no servidor (ex.: saiu em outro aparelho): volta para a tela de login
    if (resposta.status === 401) {
      await sairDesteAparelho(c);
      throw new Error('Sua sessão terminou. Entre de novo.');
    }
    const json = await resposta.json().catch(() => null) as { erro?: string } | null;
    if (json?.erro) throw new Error(json.erro);
    if (resposta.status === 404) throw new Error('O serviço de acessos ainda não está no ar. Fale com quem cuida do sistema.');
  }
  throw new Error('Não foi possível falar com o servidor de acessos. Confira a internet e tente de novo.');
}

export const listarLogins = (c: Cliente) => chamarUsuarios<{ logins: SituacaoLogin[] }>(c, { acao: 'listar' });

export interface NovoAcesso {
  email: string;
  nome: string;
  perfil: PerfilAcesso;
  profissional_id: string | null;
  /** senha: provisória definida aqui; convite: e-mail com link */
  modo: 'senha' | 'convite';
  senha?: string;
  /** Equipe: profissional cadastrado junto com o acesso (em vez de ligar um já cadastrado) */
  profissional_novo?: DadosEquipe;
}

/** O que a pessoa da equipe vai ser e os dados do cadastro de profissional */
export interface DadosEquipe {
  funcoes: FuncaoProfissional[];
  telefone: string | null;
  personagens: string[];
  disponibilidade: string | null;
}

export const criarAcesso = (c: Cliente, novo: NovoAcesso) =>
  chamarUsuarios(c, { acao: 'criar', ...novo, voltar_para: window.location.origin });

export interface EdicaoAcesso extends Pick<Usuario, 'id' | 'nome' | 'email' | 'perfil' | 'ativo'> {
  profissional_id: string | null;
  /** Nova senha provisória; vazio mantém a atual */
  senha?: string;
  /** Telas escolhidas (null volta ao padrão do perfil) */
  telas?: string[] | null;
}

/** Nome, e-mail, perfil, profissional, senha e situação: tudo no servidor, com as travas da gestão */
export const editarAcesso = (c: Cliente, edicao: EdicaoAcesso) => chamarUsuarios(c, { acao: 'editar', ...edicao });

/** Apaga o login; o servidor recusa se a pessoa já tem histórico (aí o certo é desativar) */
export const excluirAcesso = (c: Cliente, id: string) => chamarUsuarios(c, { acao: 'excluir', id });

/** Retira o cadastro das novas operações e mantém os vínculos históricos. */
export async function excluirProfissional(c: Cliente, id: string) {
  const r = await c.rpc('excluir_profissional', { p_profissional_id: id });
  if (r.error && ['PGRST202', '42883'].includes(r.error.code)) {
    throw new Error('A exclusão de profissionais ainda precisa ser ativada por quem cuida do sistema.');
  }
  ok(r);
}

/** A própria pessoa troca a senha (primeiro acesso, link de recuperação ou "Trocar minha senha") */
export async function trocarMinhaSenha(c: Cliente, senha: string) {
  const { error } = await c.auth.updateUser({ password: senha, data: { trocar_senha: false } });
  if (error) throw error;
}

/** Envia o e-mail de "esqueci minha senha"; o link volta para o site */
export async function pedirNovaSenha(c: Cliente, email: string) {
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw error;
}
