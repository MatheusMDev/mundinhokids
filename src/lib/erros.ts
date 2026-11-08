// Traduz os erros do Supabase/Postgres para mensagens que a equipe entende.
// As regras do banco (triggers) já respondem em português; aqui ficam as travas
// de restrição, permissões e falhas de rede.

const TRAVAS: Record<string, string> = {
  escala_conflito_profissional: 'Este profissional já está em outro evento nesse horário.',
  escala_conflito_personagem: 'Este personagem já está em outro evento nesse horário.',
  escala_conflito_fantasia: 'Esta fantasia já está reservada para outro evento nesse horário.',
  reserva_conflito_veiculo: 'O veículo já está reservado nesse período.',
  personagens_nome_key: 'Já existe um personagem com esse nome.',
  veiculos_placa_key: 'Já existe um veículo com essa placa.',
  usuarios_email_key: 'Já existe um login com esse e-mail.',
  profissionais_usuario_id_key: 'Este profissional já está ligado a outro login.',
  eventos_titulo_preenchido: 'Informe o nome do evento.',
  eventos_check: 'O fim do evento precisa ser depois do início.',
  reservas_veiculo_check: 'A devolução precisa ser depois da retirada.',
  fantasias_quantidade_check: 'A quantidade precisa ser maior que zero.',
  substituicoes_um_pedido_aberto: 'Já existe um pedido de troca em andamento para esta vaga.',
  nome_obrigatorio: 'Informe seu nome.',
  not_authenticated: 'Sua sessão expirou. Entre novamente.',
  sem_permissao: 'Seu perfil não pode fazer esta alteração.',
};

interface ErroBanco {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export class SemPermissao extends Error {
  constructor() {
    super('Seu perfil não pode fazer esta alteração.');
  }
}

export function traduzirErro(erro: unknown): string {
  if (erro instanceof SemPermissao) return erro.message;
  const e = (erro ?? {}) as ErroBanco;
  const texto = `${e.message ?? ''} ${e.details ?? ''}`;

  const trava = Object.keys(TRAVAS).find((nome) => texto.includes(nome));
  if (trava) return TRAVAS[trava];

  switch (e.code) {
    case '42501': return 'Seu perfil não pode fazer esta alteração.';
    case '23505': return 'Já existe um cadastro com esses dados.';
    case '23503': return 'Este cadastro está ligado a outro que não existe mais.';
    case '23502': return 'Preencha os campos obrigatórios.';
    case 'P0001': return e.message ?? 'O banco recusou a alteração.';
  }
  if (texto.includes('row-level security')) return 'Seu perfil não pode fazer esta alteração.';
  if (texto.includes('Failed to fetch')) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  if (erro instanceof Error) return erro.message;
  return e.message || 'Não foi possível salvar. Tente de novo.';
}
