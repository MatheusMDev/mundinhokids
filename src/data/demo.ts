// Dados de exemplo, os mesmos dos mocks (outubro de 2026).
// Substituídos pelas consultas do Supabase quando o projeto estiver ligado.

import type { BaseDados, EscalaItem, Evento, PagamentoProfissional, ReservaVeiculo } from '../lib/tipos';

/** "Hoje" da demonstração: quinta-feira, 15 de outubro de 2026, 11h */
export const HOJE_DEMO = '2026-10-15T11:00:00-03:00';

const t = (dataHora: string) => `${dataHora.replace(' ', 'T')}:00-03:00`;

const evento = (
  id: string, titulo: string, inicio: string, fim: string, situacao: Evento['situacao'],
  extra: Partial<Evento> = {},
): Evento => ({
  id, titulo, inicio: t(inicio), fim: t(fim), situacao,
  aniversariante: null, idade: null,
  contratante_id: 'c-mariana', local_id: 'l-castelo',
  tem_maquiagem: false, maquiagem_pessoas: 0,
  orientacoes: null, motivo_cancelamento: null,
  criado_em: t('2026-09-20 10:00'),
  ...extra,
});

let seqEscala = 0;
const escala = (
  evento_id: string, profissional_id: string, funcao: EscalaItem['funcao'],
  personagem_id: string | null = null, fantasia_id: string | null = null,
  extra: Partial<EscalaItem> = {},
): EscalaItem => ({
  id: `es-${++seqEscala}`, evento_id, profissional_id, funcao, personagem_id, fantasia_id,
  maquiar: false, horario_maquiagem: null, ativo: true, ...extra,
});

let seqReserva = 0;
const reserva = (evento_id: string, responsavel_id: string, retirada: string, devolucao: string): ReservaVeiculo => ({
  id: `rv-${++seqReserva}`, veiculo_id: 'v-doblo', evento_id, responsavel_id,
  retirada: t(retirada), devolucao_prevista: t(devolucao), devolvido_em: null, ativo: true,
});

let seqPagamento = 0;
const pagamento = (
  evento_id: string, profissional_id: string, valor: number, situacao: PagamentoProfissional['situacao'] = 'pendente',
): PagamentoProfissional => ({
  id: `pg-${++seqPagamento}`, evento_id, profissional_id, valor_combinado: valor, situacao,
  pago_em: situacao === 'pago' ? '2026-10-14' : null,
});

export function criarBaseDemo(): BaseDados {
  seqEscala = 0;
  seqReserva = 0;
  seqPagamento = 0;

  return {
    configuracoes: {
      link_formulario_produtor: 'https://forms.gle/exemplo-feedback',
      lembrete_antecedencia_minutos: '120',
      substituicao_antecedencia_minutos: '90',
      supervisora_pode_cancelar: 'false',
      supervisora_pode_alterar_equipe: 'false',
      despesa_aprovacao_acima_de: '',
    },

    usuarios: [
      { id: 'u-gerente', nome: 'Gerente geral', email: 'gerente@mundinho.com.br', perfil: 'gerente', ativo: true },
      { id: 'u-supervisora', nome: 'Supervisora', email: 'supervisao@mundinho.com.br', perfil: 'supervisora', ativo: true },
    ],

    profissionais: [
      { id: 'p-julia', usuario_id: null, nome: 'Júlia Martins', telefone: '(11) 98111-2001', email: null, funcoes: ['artista'], disponibilidade: 'Fins de semana', ativo: true },
      { id: 'p-lucas', usuario_id: null, nome: 'Lucas Pereira', telefone: '(11) 98111-2002', email: null, funcoes: ['artista'], disponibilidade: null, ativo: true },
      { id: 'p-rafael', usuario_id: null, nome: 'Rafael Lima', telefone: '(11) 98111-2003', email: null, funcoes: ['artista'], disponibilidade: null, ativo: true },
      { id: 'p-ana', usuario_id: null, nome: 'Ana Costa', telefone: '(11) 98111-2004', email: null, funcoes: ['artista'], disponibilidade: null, ativo: true },
      { id: 'p-bia', usuario_id: null, nome: 'Bia Rocha', telefone: '(11) 98111-2005', email: null, funcoes: ['artista'], disponibilidade: 'Só sábado e domingo', ativo: true },
      { id: 'p-caio', usuario_id: null, nome: 'Caio Mendes', telefone: '(11) 98111-2006', email: null, funcoes: ['artista'], disponibilidade: null, ativo: true },
      { id: 'p-bruno', usuario_id: null, nome: 'Bruno Alves', telefone: '(11) 98111-2007', email: null, funcoes: ['produtor'], disponibilidade: null, ativo: true },
      { id: 'p-diego', usuario_id: null, nome: 'Diego Souza', telefone: '(11) 98111-2008', email: null, funcoes: ['produtor'], disponibilidade: null, ativo: true },
      { id: 'p-carla', usuario_id: null, nome: 'Carla Dias', telefone: '(11) 98111-2009', email: null, funcoes: ['maquiador'], disponibilidade: null, ativo: true },
      { id: 'p-paula', usuario_id: null, nome: 'Paula Nunes', telefone: '(11) 98111-2010', email: null, funcoes: ['fantasias'], disponibilidade: null, ativo: true },
    ],

    personagens: [
      { id: 'pe-gelo', nome: 'Princesa do Gelo', descricao: 'Princesa de vestido azul e capa de neve.', referencias: null, orientacoes: 'Fala calma, canta a música do gelo no parabéns.', ativo: true },
      { id: 'pe-aranha', nome: 'Herói Aranha', descricao: 'Herói de uniforme vermelho e azul.', referencias: null, orientacoes: 'Brincadeira da teia com as crianças maiores.', ativo: true },
      { id: 'pe-sereia', nome: 'Sereia Encantada', descricao: 'Sereia de cauda verde.', referencias: null, orientacoes: 'Bolhas de sabão na entrada.', ativo: true },
      { id: 'pe-capitao', nome: 'Capitão Estrela', descricao: 'Astronauta de capacete prateado.', referencias: null, orientacoes: 'Contagem regressiva antes do parabéns.', ativo: true },
    ],

    profissional_personagens: [
      { profissional_id: 'p-julia', personagem_id: 'pe-gelo' },
      { profissional_id: 'p-lucas', personagem_id: 'pe-aranha' },
      { profissional_id: 'p-rafael', personagem_id: 'pe-aranha' },
      { profissional_id: 'p-rafael', personagem_id: 'pe-capitao' },
      { profissional_id: 'p-ana', personagem_id: 'pe-sereia' },
      { profissional_id: 'p-ana', personagem_id: 'pe-gelo' },
      { profissional_id: 'p-bia', personagem_id: 'pe-gelo' },
      { profissional_id: 'p-bia', personagem_id: 'pe-sereia' },
      { profissional_id: 'p-caio', personagem_id: 'pe-capitao' },
    ],

    contratantes: [
      { id: 'c-mariana', nome: 'Mariana Souza (mãe)', telefone: '(11) 98765-4321', email: null },
      { id: 'c-renata', nome: 'Renata Oliveira (mãe)', telefone: '(11) 97654-3210', email: null },
      { id: 'c-paulo', nome: 'Paulo Henrique (pai)', telefone: '(11) 96543-2109', email: null },
      { id: 'c-escola', nome: 'Escola Pequeno Saber', telefone: '(11) 3456-7890', email: 'eventos@pequenosaber.com.br' },
    ],

    locais: [
      { id: 'l-castelo', nome: 'Buffet Castelo Encantado', tipo: 'buffet', endereco: 'Rua das Acácias, 245 · Jardim América', contato: '(11) 3333-1010', link_localizacao: 'https://maps.google.com/?q=Rua+das+Acacias+245', orientacoes_acesso: 'Estacionar na entrada lateral, pela Rua das Acácias.', ativo: true },
      { id: 'l-pula', nome: 'Buffet Pula-Pula', tipo: 'buffet', endereco: 'Av. dos Ipês, 1200 · Vila Nova', contato: '(11) 3333-2020', link_localizacao: 'https://maps.google.com/?q=Av+dos+Ipes+1200', orientacoes_acesso: 'Entrada de artistas pelos fundos.', ativo: true },
      { id: 'l-magico', nome: 'Buffet Mundo Mágico', tipo: 'buffet', endereco: 'Rua das Flores, 88 · Centro', contato: '(11) 3333-3030', link_localizacao: 'https://maps.google.com/?q=Rua+das+Flores+88', orientacoes_acesso: null, ativo: true },
      { id: 'l-escola', nome: 'Escola Pequeno Saber', tipo: 'escola', endereco: 'Rua do Saber, 10 · Jardim Escola', contato: '(11) 3456-7890', link_localizacao: 'https://maps.google.com/?q=Rua+do+Saber+10', orientacoes_acesso: 'Apresentar-se na secretaria.', ativo: true },
      { id: 'l-casa', nome: 'Residência da família', tipo: 'casa', endereco: 'Rua das Palmeiras, 51 · Morumbi', contato: null, link_localizacao: 'https://maps.google.com/?q=Rua+das+Palmeiras+51', orientacoes_acesso: 'Interfone 51. Festa no salão do prédio.', ativo: true },
    ],

    fantasias: [
      { id: 'f-gelo-m', personagem_id: 'pe-gelo', identificacao: 'Princesa do Gelo', tamanho: 'M', quantidade: 1, situacao: 'disponivel', previsao_disponivel: null, observacoes: 'Inclui coroa e luvas' },
      { id: 'f-gelo-p', personagem_id: 'pe-gelo', identificacao: 'Princesa do Gelo', tamanho: 'P', quantidade: 1, situacao: 'limpeza', previsao_disponivel: t('2026-10-16 12:00'), observacoes: 'Inclui coroa' },
      { id: 'f-aranha-g', personagem_id: 'pe-aranha', identificacao: 'Herói Aranha', tamanho: 'G', quantidade: 1, situacao: 'disponivel', previsao_disponivel: null, observacoes: 'Máscara com tela respirável' },
      { id: 'f-sereia-m', personagem_id: 'pe-sereia', identificacao: 'Sereia Encantada', tamanho: 'M', quantidade: 1, situacao: 'disponivel', previsao_disponivel: null, observacoes: null },
      { id: 'f-capitao-g', personagem_id: 'pe-capitao', identificacao: 'Capitão Estrela', tamanho: 'G', quantidade: 1, situacao: 'disponivel', previsao_disponivel: null, observacoes: 'Capacete na caixa azul' },
    ],

    veiculos: [{ id: 'v-doblo', nome: 'Doblò', placa: 'ABC1D23', observacoes: 'Chave fica com a gerente.', ativo: true }],

    eventos: [
      evento('e-davi', 'Festa do Davi', '2026-10-03 14:00', '2026-10-03 17:00', 'realizado', { local_id: 'l-pula', contratante_id: 'c-paulo' }),
      evento('e-sofia', 'Festa da Sofia', '2026-10-04 16:00', '2026-10-04 19:00', 'realizado', { local_id: 'l-magico', contratante_id: 'c-renata' }),
      evento('e-miguel', 'Festa do Miguel', '2026-10-10 15:00', '2026-10-10 18:00', 'realizado', { local_id: 'l-castelo' }),
      evento('e-alice', 'Festa da Alice', '2026-10-10 19:00', '2026-10-10 22:00', 'realizado', { local_id: 'l-pula', contratante_id: 'c-renata' }),
      evento('e-arthur', 'Festa do Arthur', '2026-10-11 15:00', '2026-10-11 18:00', 'realizado', { local_id: 'l-casa', contratante_id: 'c-paulo' }),
      evento('e-escola', 'Escola Pequeno Saber', '2026-10-12 10:00', '2026-10-12 12:00', 'realizado', { local_id: 'l-escola', contratante_id: 'c-escola', orientacoes: 'Dia das Crianças: apresentação no pátio para três turmas.' }),
      evento('e-helena', 'Festa da Helena', '2026-10-16 18:00', '2026-10-16 21:00', 'confirmado', {
        aniversariante: 'Helena', idade: 6, local_id: 'l-magico', contratante_id: 'c-renata',
        orientacoes: 'Chegar às 17h30 para trocar de roupa na sala 2.\nParabéns às 20h.',
      }),
      evento('e-theo', 'Festa do Theo', '2026-10-17 11:00', '2026-10-17 14:00', 'confirmado', {
        aniversariante: 'Theo', idade: 4, local_id: 'l-pula', contratante_id: 'c-paulo',
        orientacoes: 'Festa no salão de baixo.\nDevolver a Doblò até 14h para a Festa da Laura.',
      }),
      evento('e-laura', 'Festa da Laura', '2026-10-17 15:00', '2026-10-17 18:00', 'confirmado', {
        aniversariante: 'Laura', idade: 5, local_id: 'l-castelo', contratante_id: 'c-mariana',
        tem_maquiagem: true, maquiagem_pessoas: 2, criado_em: t('2026-10-02 10:15'),
        orientacoes: [
          'Entrada dos personagens às 16h, depois do teatrinho do buffet.',
          'A aniversariante é tímida: a Princesa do Gelo chega primeiro e se apresenta com calma.',
          'Parabéns às 17h30, com os dois personagens ao lado da mesa.',
          'Estacionar a Doblò na entrada lateral, pela Rua das Acácias.',
        ].join('\n'),
      }),
      evento('e-gael', 'Festa do Gael', '2026-10-17 19:00', '2026-10-17 21:30', 'agendado', {
        aniversariante: 'Gael', idade: 7, local_id: 'l-magico', contratante_id: 'c-renata',
      }),
      evento('e-valentina', 'Festa da Valentina', '2026-10-18 16:00', '2026-10-18 19:00', 'confirmado', {
        aniversariante: 'Valentina', idade: 5, local_id: 'l-casa', contratante_id: 'c-paulo',
        tem_maquiagem: true, maquiagem_pessoas: 2,
        orientacoes: 'Festa no salão do prédio. Interfone 51.',
      }),
      evento('e-bento', 'Festa do Bento', '2026-10-24 15:00', '2026-10-24 18:00', 'agendado', { aniversariante: 'Bento', idade: 3, local_id: 'l-pula' }),
      evento('e-cecilia', 'Festa da Cecília', '2026-10-25 14:00', '2026-10-25 17:00', 'agendado', { aniversariante: 'Cecília', idade: 8, local_id: 'l-castelo', contratante_id: 'c-renata' }),
      evento('e-liz', 'Festa à fantasia da Liz', '2026-10-31 16:00', '2026-10-31 19:00', 'agendado', { aniversariante: 'Liz', idade: 6, local_id: 'l-magico', contratante_id: 'c-paulo' }),
    ],

    evento_escala: [
      escala('e-davi', 'p-rafael', 'artista', 'pe-aranha', 'f-aranha-g'),
      escala('e-davi', 'p-diego', 'produtor'),
      escala('e-sofia', 'p-bia', 'artista', 'pe-sereia', 'f-sereia-m'),
      escala('e-sofia', 'p-bruno', 'produtor'),
      escala('e-miguel', 'p-caio', 'artista', 'pe-capitao', 'f-capitao-g'),
      escala('e-miguel', 'p-diego', 'produtor'),
      escala('e-alice', 'p-julia', 'artista', 'pe-gelo', 'f-gelo-m'),
      escala('e-alice', 'p-bruno', 'produtor'),
      escala('e-arthur', 'p-lucas', 'artista', 'pe-aranha', 'f-aranha-g'),
      escala('e-arthur', 'p-diego', 'produtor'),
      escala('e-escola', 'p-ana', 'artista', 'pe-gelo', 'f-gelo-p'),
      escala('e-escola', 'p-caio', 'artista', 'pe-capitao', 'f-capitao-g'),
      escala('e-escola', 'p-bruno', 'produtor'),

      escala('e-helena', 'p-julia', 'artista', 'pe-gelo', 'f-gelo-m'),
      escala('e-helena', 'p-caio', 'artista', 'pe-capitao', 'f-capitao-g'),
      escala('e-helena', 'p-bruno', 'produtor'),

      escala('e-theo', 'p-rafael', 'artista', 'pe-aranha', 'f-aranha-g'),
      escala('e-theo', 'p-ana', 'artista', 'pe-sereia', 'f-sereia-m'),
      escala('e-theo', 'p-diego', 'produtor'),

      escala('e-laura', 'p-julia', 'artista', 'pe-gelo', 'f-gelo-m', { maquiar: true }),
      escala('e-laura', 'p-lucas', 'artista', 'pe-aranha', 'f-aranha-g', { maquiar: true }),
      escala('e-laura', 'p-bruno', 'produtor'),
      escala('e-laura', 'p-carla', 'maquiador', null, null, { horario_maquiagem: t('2026-10-17 14:00') }),

      escala('e-gael', 'p-caio', 'artista', 'pe-capitao', 'f-capitao-g'),
      escala('e-gael', 'p-diego', 'produtor'),

      escala('e-valentina', 'p-bia', 'artista', 'pe-gelo', 'f-gelo-p', { maquiar: true }),
      escala('e-valentina', 'p-ana', 'artista', 'pe-sereia', 'f-sereia-m', { maquiar: true }),
      escala('e-valentina', 'p-bruno', 'produtor'),

      escala('e-bento', 'p-rafael', 'artista', 'pe-aranha', 'f-aranha-g'),
      escala('e-bento', 'p-diego', 'produtor'),
    ],

    reservas_veiculo: [
      reserva('e-helena', 'p-bruno', '2026-10-16 16:45', '2026-10-16 21:45'),
      reserva('e-theo', 'p-diego', '2026-10-17 09:00', '2026-10-17 14:00'),
      reserva('e-laura', 'p-bruno', '2026-10-17 14:15', '2026-10-17 19:00'),
      reserva('e-valentina', 'p-bruno', '2026-10-18 14:30', '2026-10-18 19:45'),
    ],

    evento_financeiro: [
      { evento_id: 'e-helena', valor_contratado: 1500 },
      { evento_id: 'e-theo', valor_contratado: 1400 },
      { evento_id: 'e-laura', valor_contratado: 1800 },
      { evento_id: 'e-gael', valor_contratado: 900 },
      { evento_id: 'e-valentina', valor_contratado: 1600 },
    ],

    recebimentos: [
      { id: 'rc-1', evento_id: 'e-helena', valor: 1500, recebido_em: '2026-10-01', forma: 'pix' },
      { id: 'rc-2', evento_id: 'e-theo', valor: 700, recebido_em: '2026-10-05', forma: 'pix' },
      { id: 'rc-3', evento_id: 'e-laura', valor: 900, recebido_em: '2026-10-02', forma: 'pix' },
      { id: 'rc-4', evento_id: 'e-valentina', valor: 800, recebido_em: '2026-10-08', forma: 'transferência' },
    ],

    pagamentos_profissionais: [
      pagamento('e-helena', 'p-julia', 250, 'pago'),
      pagamento('e-helena', 'p-caio', 250, 'pago'),
      pagamento('e-helena', 'p-bruno', 200, 'pago'),
      pagamento('e-theo', 'p-rafael', 250),
      pagamento('e-theo', 'p-ana', 250),
      pagamento('e-theo', 'p-diego', 200, 'pago'),
      pagamento('e-laura', 'p-julia', 250),
      pagamento('e-laura', 'p-lucas', 250),
      pagamento('e-laura', 'p-bruno', 200),
      pagamento('e-laura', 'p-carla', 220, 'pago'),
    ],

    despesas: [
      { id: 'd-1', evento_id: 'e-laura', tipo: 'extra', descricao: 'Balões e fita para a entrada', valor: 45, responsavel_id: 'p-bruno', comprovante: 'Nota da papelaria (foto no WhatsApp)', aprovacao: 'nao_requer' },
      { id: 'd-2', evento_id: null, tipo: 'insumo', descricao: 'Reposição de glitter e tinta facial', valor: 68, responsavel_id: 'p-carla', comprovante: null, aprovacao: 'nao_requer' },
    ],

    substituicoes: [
      {
        id: 's-1', escala_id: 'es-21', solicitante_id: 'p-lucas', substituto_id: 'p-rafael',
        motivo: 'Consulta médica no sábado à tarde', situacao: 'aguardando_aprovacao',
        solicitado_em: t('2026-10-15 09:40'), respondido_em: t('2026-10-15 10:15'), decidido_em: null,
      },
    ],

    conferencias_fantasia: [
      { id: 'cf-1', evento_id: 'e-escola', fantasia_id: 'f-gelo-p', devolvida: true, condicao: 'ok', precisa_limpeza: true, precisa_reparo: false, pendencias: 'Barra do vestido suja de tinta.' },
      { id: 'cf-2', evento_id: 'e-escola', fantasia_id: 'f-capitao-g', devolvida: true, condicao: 'ok', precisa_limpeza: false, precisa_reparo: false, pendencias: null },
    ],

    historico: [
      { id: 1, evento_id: 'e-laura', descricao: 'Evento criado', financeiro: false, usuario_nome: 'Gerente geral', em: t('2026-10-02 10:15') },
      { id: 2, evento_id: 'e-laura', descricao: 'Horário alterado de 14h para 15h', financeiro: false, usuario_nome: 'Supervisora', em: t('2026-10-12 16:02') },
      { id: 3, evento_id: 'e-laura', descricao: 'Valor contratado definido em R$ 1.800', financeiro: true, usuario_nome: 'Gerente geral', em: t('2026-10-02 10:20') },
      { id: 4, evento_id: 'e-laura', descricao: 'Troca solicitada por Lucas Pereira', financeiro: false, usuario_nome: 'Lucas Pereira', em: t('2026-10-15 09:40') },
    ],

    notificacoes: [
      { id: 'n-1', evento_id: 'e-laura', tipo: 'escalado', agendada_para: t('2026-10-02 10:30'), enviada_em: t('2026-10-02 10:30') },
      { id: 'n-2', evento_id: 'e-laura', tipo: 'lembrete', agendada_para: t('2026-10-17 13:00'), enviada_em: null },
    ],
  };
}
