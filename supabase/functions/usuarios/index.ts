// Mundinho Kids — gestão de logins pelo próprio site.
//
// Criar login, trocar e-mail, definir senha e bloquear acesso exigem a chave
// de administrador do Supabase. Ela só existe aqui no servidor (variável
// SUPABASE_SERVICE_ROLE_KEY, preenchida pelo próprio Supabase) e nunca vai
// para o navegador. Só Direção e Gerente (ativos) podem chamar esta função,
// e só a Direção mexe em logins de Direção.
//
// Ações (POST com JSON { acao, ... }):
//   listar  situação de cada login (último acesso, convite, bloqueio)
//   criar   cria o login (senha provisória ou convite por e-mail),
//           ou dá perfil a um login que já existe sem perfil
//   editar  nome, e-mail, perfil, profissional, nova senha, telas e ativo/inativo
//   excluir apaga o login de quem não tem histórico (com histórico: desativar)

import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PERFIS = ['diretora', 'gerente', 'supervisora', 'produtor', 'artista', 'maquiador', 'fantasias'] as const;
type Perfil = (typeof PERFIS)[number];
const PERFIS_EQUIPE: Perfil[] = ['produtor', 'artista', 'maquiador', 'fantasias'];
const PERFIS_GESTAO: Perfil[] = ['diretora', 'gerente'];
const PERFIS_OPERACAO: Perfil[] = ['diretora', 'gerente', 'supervisora'];

const TELAS = ['painel', 'eventos', 'profissionais', 'personagens', 'fantasias', 'veiculos', 'financeiro', 'cadastros', 'usuarios', 'configuracoes'];

/**
 * Telas escolhidas para o login (null = padrão do perfil). Liberar a tela não
 * libera os dados: por isso Financeiro só vale para a gestão, e Usuários e
 * Configurações só para a operação. A gestão nunca perde a tela de Usuários.
 */
function validarTelas(valor: unknown, perfil: Perfil): string[] | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  if (!Array.isArray(valor) || valor.some((t) => typeof t !== 'string' || !TELAS.includes(t))) throw new Recusa('Telas inválidas.');
  const telas = [...new Set(valor as string[])];
  if (!telas.length) throw new Recusa('Marque pelo menos uma tela.');
  if (telas.includes('financeiro') && !PERFIS_GESTAO.includes(perfil)) throw new Recusa('Financeiro só pode ser liberado para Direção e Gerente.');
  if (telas.some((t) => t === 'usuarios' || t === 'configuracoes') && !PERFIS_OPERACAO.includes(perfil)) {
    throw new Recusa('Usuários e Configurações só podem ser liberados para Direção, Gerente e Assistente.');
  }
  if (PERFIS_GESTAO.includes(perfil) && !telas.includes('usuarios')) throw new Recusa('Direção e Gerente precisam da tela de Usuários.');
  return telas;
}

interface Chamador { id: string; perfil: Perfil }

/** Erro com mensagem para mostrar na tela */
class Recusa extends Error {
  constructor(mensagem: string, readonly status = 400) {
    super(mensagem);
  }
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function validarEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Recusa('Informe um e-mail válido.');
}

function validarSenha(senha: string) {
  if (senha.length < 6) throw new Recusa('A senha precisa ter pelo menos 6 caracteres.');
}

function validarPerfil(perfil: Perfil, profissionalId: string | null, quem: Chamador) {
  if (!PERFIS.includes(perfil)) throw new Recusa('Escolha o perfil.');
  if (perfil === 'diretora' && quem.perfil !== 'diretora') throw new Recusa('Só a Direção pode dar o perfil de Direção.', 403);
  if (PERFIS_EQUIPE.includes(perfil) && !profissionalId) {
    throw new Recusa('Ligue este login ao profissional do cadastro: é assim que ele vê os próprios eventos.');
  }
}

/** Procura o login pelo e-mail (a API de administrador não busca por e-mail direto) */
async function loginPorEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const logins = await todosOsLogins(admin);
  return logins.find((u) => u.email?.toLowerCase() === email) ?? null;
}

async function todosOsLogins(admin: SupabaseClient): Promise<User[]> {
  const todos: User[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;
    todos.push(...data.users);
    if (data.users.length < 1000) return todos;
  }
}

/** A API devolve banned_until, mas o tipo User da biblioteca não declara o campo */
const bloqueado = (u: User) => {
  const ate = (u as User & { banned_until?: string | null }).banned_until;
  return !!ate && new Date(ate) > new Date();
};

/** Confere se o profissional existe e está livre (ou já é deste login) */
async function conferirProfissional(admin: SupabaseClient, profissionalId: string, loginId?: string) {
  const { data: prof } = await admin.from('profissionais').select('id, usuario_id, ativo').eq('id', profissionalId).maybeSingle();
  if (!prof) throw new Recusa('Profissional não encontrado.');
  if (prof.usuario_id && prof.usuario_id !== loginId) throw new Recusa('Este profissional já está ligado a outro login.');
  if (!prof.ativo && prof.usuario_id !== loginId) throw new Recusa('Este profissional está inativo e não pode receber um novo vínculo.');
}

async function listar(admin: SupabaseClient) {
  const logins = await todosOsLogins(admin);
  return {
    logins: logins.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      criado_em: u.created_at,
      ultimo_acesso: u.last_sign_in_at ?? null,
      convite_pendente: !!u.invited_at && !u.last_sign_in_at,
      trocar_senha: u.user_metadata?.trocar_senha === true,
      bloqueado: bloqueado(u),
    })),
  };
}

async function criar(admin: SupabaseClient, corpo: Record<string, unknown>, quem: Chamador) {
  const email = texto(corpo.email).toLowerCase();
  const nome = texto(corpo.nome);
  const perfil = texto(corpo.perfil) as Perfil;
  const profissionalId = texto(corpo.profissional_id) || null;
  const modo = texto(corpo.modo);
  const senha = texto(corpo.senha);
  const voltarPara = texto(corpo.voltar_para) || undefined;
  const novoProfissional = lerNovoProfissional(corpo.profissional_novo, perfil);

  validarEmail(email);
  if (!nome) throw new Recusa('Informe o nome.');
  if (profissionalId && novoProfissional) throw new Recusa('Escolha um profissional já cadastrado ou cadastre um novo, não os dois.');
  validarPerfil(perfil, profissionalId ?? (novoProfissional ? 'novo' : null), quem);
  if (modo === 'senha') validarSenha(senha);
  else if (modo !== 'convite' && modo !== 'manter') {
    throw new Recusa('Escolha como a pessoa vai entrar: senha provisória ou convite por e-mail.');
  }
  if (profissionalId) await conferirProfissional(admin, profissionalId);

  // O login pode já existir sem perfil (criado antes do site cuidar dos acessos)
  let login = await loginPorEmail(admin, email);
  let criadoAgora = false;
  if (login) {
    const { data: jaTem } = await admin.from('usuarios').select('id').eq('id', login.id).maybeSingle();
    if (jaTem) throw new Recusa('Já existe um acesso com esse e-mail.');
    if (modo === 'convite') throw new Recusa('Esse e-mail já tem login. Crie o acesso com senha provisória.');
    if (modo === 'senha') {
      const { error } = await admin.auth.admin.updateUserById(login.id, {
        password: senha, email_confirm: true, ban_duration: 'none',
        user_metadata: { ...login.user_metadata, nome, trocar_senha: true },
      });
      if (error) throw error;
    }
  } else if (modo === 'manter') {
    throw new Recusa('Não existe login com esse e-mail. Defina uma senha provisória ou envie um convite.');
  } else if (modo === 'senha') {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { nome, trocar_senha: true },
    });
    if (error) throw error;
    login = data.user;
    criadoAgora = true;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, trocar_senha: true }, redirectTo: voltarPara,
    });
    if (error) throw new Recusa(`Não foi possível enviar o convite: ${error.message}`);
    login = data.user;
    criadoAgora = true;
  }

  // Perfil, profissional (novo ou já cadastrado) e ligação entre eles.
  // Se qualquer passo falhar, desfaz o que foi criado agora.
  const loginId = login.id;
  let profissionalCriado: string | null = null;
  const desfazer = async () => {
    if (profissionalCriado) {
      await admin.from('profissional_personagens').delete().eq('profissional_id', profissionalCriado);
      await admin.from('profissionais').delete().eq('id', profissionalCriado);
    }
    await admin.from('usuarios').delete().eq('id', loginId);
    if (criadoAgora) await admin.auth.admin.deleteUser(loginId);
  };
  try {
    const { error: erroPerfil } = await admin.from('usuarios').insert({ id: loginId, nome, email, perfil, ativo: true });
    if (erroPerfil) throw erroPerfil;
    if (novoProfissional) {
      const { data: prof, error } = await admin.from('profissionais').insert({
        nome, email, usuario_id: loginId, telefone: novoProfissional.telefone, funcoes: novoProfissional.funcoes,
        disponibilidade: novoProfissional.disponibilidade,
      }).select('id').single();
      if (error) throw error;
      profissionalCriado = prof.id;
      if (novoProfissional.personagens.length) {
        const { error: erroPers } = await admin.from('profissional_personagens')
          .insert(novoProfissional.personagens.map((p) => ({ profissional_id: prof.id, personagem_id: p })));
        if (erroPers) throw erroPers;
      }
    } else if (profissionalId) {
      const { error } = await admin.from('profissionais').update({ usuario_id: loginId }).eq('id', profissionalId).is('usuario_id', null);
      if (error) throw error;
    }
  } catch (e) {
    await desfazer();
    throw e;
  }
  return { id: loginId };
}

const FUNCOES = ['artista', 'produtor', 'maquiador', 'fantasias'];

interface NovoProfissional { telefone: string | null; funcoes: string[]; personagens: string[]; disponibilidade: string | null }

/** Dados do profissional cadastrado junto com o acesso (só para quem é da equipe) */
function lerNovoProfissional(valor: unknown, perfil: Perfil): NovoProfissional | null {
  if (!valor) return null;
  const v = valor as Record<string, unknown>;
  const funcoes = Array.isArray(v.funcoes) ? [...new Set(v.funcoes.filter((f): f is string => typeof f === 'string'))] : [];
  if (!funcoes.length || funcoes.some((f) => !FUNCOES.includes(f))) throw new Recusa('Marque o que a pessoa vai ser: artista, produção, maquiagem ou fantasias.');
  if (PERFIS_EQUIPE.includes(perfil) && !funcoes.includes(perfil)) throw new Recusa('O perfil precisa ser uma das funções marcadas.');
  const personagens = funcoes.includes('artista') && Array.isArray(v.personagens)
    ? v.personagens.filter((p): p is string => typeof p === 'string') : [];
  return { telefone: texto(v.telefone) || null, funcoes, personagens, disponibilidade: texto(v.disponibilidade) || null };
}

async function editar(admin: SupabaseClient, corpo: Record<string, unknown>, quem: Chamador) {
  const id = texto(corpo.id);
  const nome = texto(corpo.nome);
  const email = texto(corpo.email).toLowerCase();
  const perfil = texto(corpo.perfil) as Perfil;
  const profissionalId = texto(corpo.profissional_id) || null;
  const ativo = corpo.ativo !== false;
  const senha = texto(corpo.senha);
  const ehVoce = id === quem.id;
  const telas = validarTelas(corpo.telas, perfil);

  const { data: atual } = await admin.from('usuarios').select('id, email, perfil, ativo').eq('id', id).maybeSingle();
  if (!atual) throw new Recusa('Acesso não encontrado.');
  if (atual.perfil === 'diretora' && quem.perfil !== 'diretora') throw new Recusa('Só a Direção pode alterar um acesso de Direção.', 403);
  if (!nome) throw new Recusa('Informe o nome.');
  validarEmail(email);
  validarPerfil(perfil, profissionalId, quem);
  if (ehVoce && perfil !== atual.perfil) throw new Recusa('Você não pode mudar o próprio perfil.');
  if (ehVoce && !ativo) throw new Recusa('Você não pode desativar o próprio acesso.');
  if (ehVoce && senha) throw new Recusa('Para trocar a sua própria senha, use "Trocar minha senha".');
  if (senha) validarSenha(senha);

  // O sistema nunca pode ficar sem ninguém da gestão com acesso
  const deixaDeSerGestao = atual.ativo && PERFIS_GESTAO.includes(atual.perfil) && (!ativo || !PERFIS_GESTAO.includes(perfil));
  if (deixaDeSerGestao) {
    const { count } = await admin.from('usuarios').select('id', { count: 'exact', head: true })
      .eq('ativo', true).in('perfil', PERFIS_GESTAO).neq('id', id);
    if (!count) throw new Recusa('É preciso ter pelo menos uma pessoa da Direção ou gerente com acesso ativo.');
  }

  const { data: ligado } = await admin.from('profissionais').select('id').eq('usuario_id', id).maybeSingle();
  if (profissionalId && profissionalId !== ligado?.id) await conferirProfissional(admin, profissionalId, id);

  // Login no Supabase Auth: e-mail, senha e bloqueio
  const { data: login, error: erroBusca } = await admin.auth.admin.getUserById(id);
  if (erroBusca || !login.user) throw new Recusa('Login não encontrado.');
  const mudancas: Record<string, unknown> = {};
  if (email !== atual.email) {
    const outro = await loginPorEmail(admin, email);
    if (outro && outro.id !== id) throw new Recusa('Já existe um login com esse e-mail.');
    mudancas.email = email;
    mudancas.email_confirm = true;
  }
  if (senha) {
    mudancas.password = senha;
    mudancas.user_metadata = { ...login.user.user_metadata, trocar_senha: true };
  }
  if (ativo !== atual.ativo) mudancas.ban_duration = ativo ? 'none' : '876000h';
  if (Object.keys(mudancas).length) {
    const { error } = await admin.auth.admin.updateUserById(id, mudancas);
    if (error) throw error;
  }

  // Perfil no sistema e ligação com o cadastro do profissional
  const { error: erroPerfil } = await admin.from('usuarios')
    .update({ nome, email, perfil, ativo, ...(telas !== undefined ? { telas } : {}) }).eq('id', id);
  if (erroPerfil) throw erroPerfil;
  if (profissionalId !== (ligado?.id ?? null)) {
    if (ligado) {
      const { error } = await admin.from('profissionais').update({ usuario_id: null }).eq('id', ligado.id);
      if (error) throw error;
    }
    if (profissionalId) {
      const { error } = await admin.from('profissionais').update({ usuario_id: id }).eq('id', profissionalId);
      if (error) throw error;
    }
  }
  return { ok: true };
}

/** Registros que levam o nome da pessoa: com eles, o acesso é desativado, não excluído */
const HISTORICO: [tabela: string, coluna: string, descricao: string][] = [
  ['eventos', 'criado_por', 'eventos'],
  ['evento_remarcacoes', 'alterado_por', 'remarcações'],
  ['despesas', 'criado_por', 'despesas'],
  ['despesas', 'aprovado_por', 'despesas aprovadas'],
  ['substituicoes', 'decidido_por', 'trocas'],
  ['conferencias_fantasia', 'responsavel_id', 'conferências de fantasias'],
];

async function excluir(admin: SupabaseClient, corpo: Record<string, unknown>, quem: Chamador) {
  const id = texto(corpo.id);
  if (id === quem.id) throw new Recusa('Você não pode excluir o próprio acesso.');
  const { data: atual } = await admin.from('usuarios').select('id, perfil, ativo').eq('id', id).maybeSingle();
  if (!atual) throw new Recusa('Acesso não encontrado.');
  if (atual.perfil === 'diretora' && quem.perfil !== 'diretora') throw new Recusa('Só a Direção pode excluir um acesso de Direção.', 403);

  // O sistema nunca pode ficar sem ninguém da gestão com acesso
  if (atual.ativo && PERFIS_GESTAO.includes(atual.perfil)) {
    const { count } = await admin.from('usuarios').select('id', { count: 'exact', head: true })
      .eq('ativo', true).in('perfil', PERFIS_GESTAO).neq('id', id);
    if (!count) throw new Recusa('É preciso ter pelo menos uma pessoa da Direção ou gerente com acesso ativo.');
  }

  const temHistorico: string[] = [];
  for (const [tabela, coluna, descricao] of HISTORICO) {
    const { count, error } = await admin.from(tabela).select(coluna, { count: 'exact', head: true }).eq(coluna, id);
    if (error) throw error;
    if (count && !temHistorico.includes(descricao)) temHistorico.push(descricao);
  }
  if (temHistorico.length) {
    throw new Recusa(`Este acesso já tem registros no sistema (${temHistorico.join(', ')}). Para manter o histórico, desative o acesso em vez de excluir.`);
  }

  // O trigger de usuarios desativa e desvincula o profissional na mesma
  // transação do Auth. Se apagar falhar, o vínculo original é preservado.
  // Apagar o login apaga junto o perfil, os avisos e as inscrições de celular (cascata do banco)
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
  return { ok: true };
}

/** Chave de administrador: a nova (sb_secret_…) quando o projeto usa as chaves novas; senão a service_role antiga */
function chaveAdmin(): string {
  try {
    const novas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    if (novas.default) return novas.default;
  } catch { /* variável ausente ou em outro formato: usa a antiga */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, chaveAdmin(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Quem está chamando: o token do login vem no cabeçalho Authorization
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(token);
    if (!sessao.user) {
      console.error('usuarios: login não reconhecido:', erroSessao?.message);
      throw new Recusa('Entre de novo no sistema.', 401);
    }
    const { data: perfil } = await admin.from('usuarios').select('perfil, ativo').eq('id', sessao.user.id).maybeSingle();
    if (!perfil?.ativo || !PERFIS_GESTAO.includes(perfil.perfil)) {
      throw new Recusa('Só a direção e a gerente cuidam dos acessos.', 403);
    }
    const quem: Chamador = { id: sessao.user.id, perfil: perfil.perfil };

    const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (corpo.acao) {
      case 'listar': return resposta(await listar(admin));
      case 'criar': return resposta(await criar(admin, corpo, quem));
      case 'editar': return resposta(await editar(admin, corpo, quem));
      case 'excluir': return resposta(await excluir(admin, corpo, quem));
      default: throw new Recusa('Ação desconhecida.');
    }
  } catch (e) {
    if (e instanceof Recusa) return resposta({ erro: e.message }, e.status);
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error('usuarios:', mensagem);
    if (mensagem.includes('already been registered')) return resposta({ erro: 'Já existe um login com esse e-mail.' }, 400);
    if (mensagem.includes('usuarios_email_key')) return resposta({ erro: 'Já existe um acesso com esse e-mail.' }, 400);
    if (mensagem.includes('profissionais_usuario_id_key')) return resposta({ erro: 'Este profissional já está ligado a outro login.' }, 400);
    if (mensagem.includes('different from the old')) return resposta({ erro: 'Escolha uma senha diferente da atual.' }, 400);
    return resposta({ erro: 'Não foi possível concluir. Tente de novo.' }, 500);
  }
});
