// Tipos que espelham as tabelas do banco (supabase/migrations).
// Os nomes dos campos são os mesmos das colunas, para trocar os dados de
// exemplo pelas consultas do Supabase sem mudar as telas.

export type PerfilAcesso =
  | 'diretora' | 'gerente' | 'supervisora' | 'produtor' | 'artista' | 'maquiador' | 'fantasias';
export type FuncaoProfissional = 'artista' | 'produtor' | 'maquiador' | 'fantasias';
export type FuncaoEscala = 'artista' | 'produtor' | 'maquiador';
export type SituacaoEvento = 'agendado' | 'confirmado' | 'realizado' | 'cancelado';
export type SituacaoFantasia = 'disponivel' | 'limpeza' | 'manutencao' | 'inativa';
export type SituacaoPagamento = 'pendente' | 'pago';
export type SituacaoAprovacao = 'nao_requer' | 'pendente' | 'aprovada' | 'recusada';
export type SituacaoSubstituicao =
  | 'aguardando_aceite' | 'aguardando_aprovacao' | 'aprovada' | 'recusada' | 'cancelada';
export type CondicaoPeca = 'ok' | 'danificada' | 'faltando';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  foto_path: string | null;
  perfil: PerfilAcesso;
  ativo: boolean;
  /** Telas escolhidas pela gestão; null = padrão do perfil */
  telas: string[] | null;
  /** Três atalhos escolhidos pela própria pessoa para a navegação mobile */
  abas_mobile: string[] | null;
}

/** Situação do login no Supabase Auth (só a gestão vê, pela função "usuarios") */
export interface SituacaoLogin {
  id: string;
  email: string;
  criado_em: string;
  ultimo_acesso: string | null;
  convite_pendente: boolean;
  /** Ainda está com a senha provisória ou com o convite */
  trocar_senha: boolean;
  bloqueado: boolean;
}

export interface Profissional {
  id: string;
  /** Ausente em projetos anteriores à migração de exclusão de profissionais. */
  excluido_em?: string | null;
  usuario_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  funcoes: FuncaoProfissional[];
  disponibilidade: string | null;
  ativo: boolean;
}

export interface Personagem {
  id: string;
  nome: string;
  descricao: string | null;
  referencias: string | null;
  orientacoes: string | null;
  ativo: boolean;
}

export interface ProfissionalPersonagem {
  profissional_id: string;
  personagem_id: string;
}

export interface DocumentoArtista {
  id: string;
  profissional_id: string;
  tipo: string;
  nome: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  enviado_por: string;
  enviado_em: string;
}

export interface Contratante {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
}

export interface Local {
  id: string;
  nome: string;
  tipo: string;
  endereco: string | null;
  contato: string | null;
  link_localizacao: string | null;
  orientacoes_acesso: string | null;
  ativo: boolean;
}

export interface Fantasia {
  id: string;
  personagem_id: string;
  identificacao: string;
  tamanho: string | null;
  quantidade: number;
  situacao: SituacaoFantasia;
  previsao_disponivel: string | null;
  observacoes: string | null;
}

export interface Veiculo {
  id: string;
  nome: string;
  placa: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export interface Evento {
  id: string;
  titulo: string;
  aniversariante: string | null;
  idade: number | null;
  contratante_id: string;
  local_id: string;
  inicio: string;
  fim: string;
  situacao: SituacaoEvento;
  tem_maquiagem: boolean;
  maquiagem_pessoas: number;
  orientacoes: string | null;
  motivo_cancelamento: string | null;
  criado_em: string;
}

export interface EscalaItem {
  id: string;
  evento_id: string;
  profissional_id: string;
  funcao: FuncaoEscala;
  personagem_id: string | null;
  fantasia_id: string | null;
  maquiar: boolean;
  horario_maquiagem: string | null;
  ativo: boolean;
}

export interface ReservaVeiculo {
  id: string;
  veiculo_id: string;
  evento_id: string | null;
  responsavel_id: string;
  retirada: string;
  devolucao_prevista: string;
  devolvido_em: string | null;
  observacoes: string | null;
  ativo: boolean;
}

export interface EventoFinanceiro {
  evento_id: string;
  valor_contratado: number;
}

export interface Recebimento {
  id: string;
  evento_id: string;
  valor: number;
  recebido_em: string;
  forma: string | null;
  observacoes: string | null;
}

export interface PagamentoProfissional {
  id: string;
  evento_id: string;
  profissional_id: string;
  valor_combinado: number;
  situacao: SituacaoPagamento;
  pago_em: string | null;
  cancelado_em: string | null;
  observacoes: string | null;
}

export interface Despesa {
  id: string;
  evento_id: string | null;
  tipo: 'extra' | 'insumo';
  descricao: string;
  valor: number;
  responsavel_id: string | null;
  comprovante: string | null;
  aprovacao: SituacaoAprovacao;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface AdicionalProdutor {
  id: string;
  produtor_id: string;
  valor: number;
  data: string;
  descricao: string;
  foto_path: string;
  foto_nome: string;
  foto_mime: 'image/jpeg' | 'image/png' | 'image/webp';
  foto_tamanho: number;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  cancelado_em: string | null;
  cancelado_por: string | null;
}

export interface Substituicao {
  id: string;
  escala_id: string;
  solicitante_id: string;
  substituto_id: string;
  motivo: string | null;
  situacao: SituacaoSubstituicao;
  solicitado_em: string;
  respondido_em: string | null;
  decidido_em: string | null;
}

export interface ConferenciaFantasia {
  id: string;
  evento_id: string;
  fantasia_id: string;
  devolvida: boolean;
  condicao: CondicaoPeca;
  precisa_limpeza: boolean;
  precisa_reparo: boolean;
  pendencias: string | null;
  conferido_em: string;
}

export interface Historico {
  id: number;
  evento_id: string | null;
  descricao: string;     // no banco vem de tabela/ação/antes/depois; aqui já resumido
  financeiro: boolean;
  usuario_nome: string;
  em: string;
}

export interface Notificacao {
  id: string;
  evento_id: string | null;
  tipo: 'escalado' | 'lembrete' | 'alterado' | 'cancelado' | 'removido' | 'substituicao'
    | 'despesa_aprovacao' | 'evento_gestao' | 'pendencia_operacional' | 'resumo_diario'
    | 'conferencia_fantasias';
  mensagem: string | null;
  agendada_para: string;
  enviada_em: string | null;
  lida_em: string | null;
}

export interface PreferenciaNotificacao {
  usuario_id: string;
  tipo: Notificacao['tipo'];
  ativa: boolean;
}

export interface TrocaParaMim {
  substituicao_id: string;
  situacao: SituacaoSubstituicao;
  evento_id: string;
  titulo: string;
  inicio: string;
  fim: string;
  local_nome: string;
  personagem: string | null;
  solicitante: string;
  motivo: string | null;
  solicitado_em: string;
}

/** Tudo o que as telas leem. No Supabase, cada lista é uma tabela já filtrada pelas permissões. */
export interface BaseDados {
  /** IDs elegíveis para novos vínculos, calculados pelo banco sem expor logins de colegas. */
  profissionais_disponiveis: string[];
  configuracoes: Record<string, string>;
  usuarios: Usuario[];
  profissionais: Profissional[];
  disponibilidade_semanal: DisponibilidadeSemanalDia[];
  personagens: Personagem[];
  profissional_personagens: ProfissionalPersonagem[];
  documentos_artistas: DocumentoArtista[];
  contratantes: Contratante[];
  locais: Local[];
  fantasias: Fantasia[];
  veiculos: Veiculo[];
  eventos: Evento[];
  evento_escala: EscalaItem[];
  reservas_veiculo: ReservaVeiculo[];
  evento_financeiro: EventoFinanceiro[];
  recebimentos: Recebimento[];
  pagamentos_profissionais: PagamentoProfissional[];
  despesas: Despesa[];
  adicionais_produtores: AdicionalProdutor[];
  substituicoes: Substituicao[];
  conferencias_fantasia: ConferenciaFantasia[];
  historico: Historico[];
  notificacoes: Notificacao[];
  notificacao_preferencias: PreferenciaNotificacao[];
  /** Pedidos de troca em que o login é o substituto (função trocas_para_mim) */
  trocas_para_mim: TrocaParaMim[];
  /** Observações internas: só a operação recebe linhas */
  profissionais_notas: { profissional_id: string; observacoes: string }[];
  contratantes_notas: { contratante_id: string; observacoes: string }[];
}
