-- =====================================================================
-- Mundinho Kids — dados de teste
-- Rodar depois das migrações, só no projeto de TESTE.
--
-- As datas são relativas à semana atual: o "sábado" é o próximo sábado
-- (ou hoje, se hoje for sábado). Assim a base sempre tem eventos na
-- semana, pendências e uma troca para aprovar, como nos mocks.
--
-- Os logins (gerente e assistente) não são criados aqui: crie os
-- usuários em Authentication > Users e rode supabase/vincular_usuarios.sql.
-- =====================================================================

-- Data/hora relativa ao sábado da semana, no horário de São Paulo
create function pg_temp.quando(p_dias int, p_hora text) returns timestamptz
language sql stable as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select (((d + ((6 - extract(dow from d)::int) % 7)) + p_dias) + p_hora::time) at time zone 'America/Sao_Paulo'
  from hoje
$$;

-- ---------------------------------------------------------------------
-- Configurações de teste
-- ---------------------------------------------------------------------

update configuracoes set valor = 'https://forms.gle/exemplo-feedback' where chave = 'link_formulario_produtor';

-- ---------------------------------------------------------------------
-- Profissionais e personagens
-- ---------------------------------------------------------------------

insert into profissionais (id, nome, telefone, funcoes, disponibilidade) values
  ('a0000000-0000-0000-0000-000000000001', 'Júlia Martins', '(11) 98111-2001', '{artista}',   'Fins de semana'),
  ('a0000000-0000-0000-0000-000000000002', 'Lucas Pereira', '(11) 98111-2002', '{artista}',   null),
  ('a0000000-0000-0000-0000-000000000003', 'Rafael Lima',   '(11) 98111-2003', '{artista}',   null),
  ('a0000000-0000-0000-0000-000000000004', 'Ana Costa',     '(11) 98111-2004', '{artista}',   null),
  ('a0000000-0000-0000-0000-000000000005', 'Bia Rocha',     '(11) 98111-2005', '{artista}',   'Só sábado e domingo'),
  ('a0000000-0000-0000-0000-000000000006', 'Caio Mendes',   '(11) 98111-2006', '{artista}',   null),
  ('a0000000-0000-0000-0000-000000000007', 'Bruno Alves',   '(11) 98111-2007', '{produtor}',  null),
  ('a0000000-0000-0000-0000-000000000008', 'Diego Souza',   '(11) 98111-2008', '{produtor}',  null),
  ('a0000000-0000-0000-0000-000000000009', 'Carla Dias',    '(11) 98111-2009', '{maquiador}', null),
  ('a0000000-0000-0000-0000-000000000010', 'Paula Nunes',   '(11) 98111-2010', '{fantasias}', null);

insert into personagens (id, nome, descricao, orientacoes) values
  ('b0000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'Princesa de vestido azul e capa de neve.', 'Fala calma, canta a música do gelo no parabéns.'),
  ('b0000000-0000-0000-0000-000000000002', 'Herói Aranha',     'Herói de uniforme vermelho e azul.',        'Brincadeira da teia com as crianças maiores.'),
  ('b0000000-0000-0000-0000-000000000003', 'Sereia Encantada', 'Sereia de cauda verde.',                    'Bolhas de sabão na entrada.'),
  ('b0000000-0000-0000-0000-000000000004', 'Capitão Estrela',  'Astronauta de capacete prateado.',          'Contagem regressiva antes do parabéns.');

insert into profissional_personagens (profissional_id, personagem_id) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004');

-- ---------------------------------------------------------------------
-- Contratantes, locais, fantasias e veículo
-- ---------------------------------------------------------------------

insert into contratantes (id, nome, telefone, email) values
  ('c0000000-0000-0000-0000-000000000001', 'Mariana Souza (mãe)',   '(11) 98765-4321', null),
  ('c0000000-0000-0000-0000-000000000002', 'Renata Oliveira (mãe)', '(11) 97654-3210', null),
  ('c0000000-0000-0000-0000-000000000003', 'Paulo Henrique (pai)',  '(11) 96543-2109', null),
  ('c0000000-0000-0000-0000-000000000004', 'Escola Pequeno Saber',  '(11) 3456-7890',  'eventos@pequenosaber.com.br');

insert into contratantes_notas (contratante_id, observacoes) values
  ('c0000000-0000-0000-0000-000000000002', 'Prefere contato por WhatsApp depois das 18h.');

insert into locais (id, nome, tipo, endereco, contato, link_localizacao, orientacoes_acesso) values
  ('d0000000-0000-0000-0000-000000000001', 'Buffet Castelo Encantado', 'buffet', 'Rua das Acácias, 245 · Jardim América', '(11) 3333-1010', 'https://maps.google.com/?q=Rua+das+Acacias+245', 'Estacionar na entrada lateral, pela Rua das Acácias.'),
  ('d0000000-0000-0000-0000-000000000002', 'Buffet Pula-Pula',         'buffet', 'Av. dos Ipês, 1200 · Vila Nova',        '(11) 3333-2020', 'https://maps.google.com/?q=Av+dos+Ipes+1200',      'Entrada de artistas pelos fundos.'),
  ('d0000000-0000-0000-0000-000000000003', 'Buffet Mundo Mágico',      'buffet', 'Rua das Flores, 88 · Centro',           '(11) 3333-3030', 'https://maps.google.com/?q=Rua+das+Flores+88',      null),
  ('d0000000-0000-0000-0000-000000000004', 'Escola Pequeno Saber',     'escola', 'Rua do Saber, 10 · Jardim Escola',      '(11) 3456-7890', 'https://maps.google.com/?q=Rua+do+Saber+10',        'Apresentar-se na secretaria.'),
  ('d0000000-0000-0000-0000-000000000005', 'Residência da família',    'casa',   'Rua das Palmeiras, 51 · Morumbi',       null,             'https://maps.google.com/?q=Rua+das+Palmeiras+51',   'Interfone 51. Festa no salão do prédio.');

insert into fantasias (id, personagem_id, identificacao, tamanho, situacao, previsao_disponivel, observacoes) values
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'M', 'disponivel', null, 'Inclui coroa e luvas'),
  ('f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'P', 'limpeza', pg_temp.quando(-1, '12:00'), 'Inclui coroa'),
  ('f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Herói Aranha',     'G', 'disponivel', null, 'Máscara com tela respirável'),
  ('f0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'Sereia Encantada', 'M', 'disponivel', null, null),
  ('f0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'Capitão Estrela',  'G', 'disponivel', null, 'Capacete na caixa azul');

insert into veiculos (id, nome, placa, observacoes) values
  ('e0000000-0000-0000-0000-000000000001', 'Doblò', 'ABC1D23', 'Chave fica com a gerente.');

-- ---------------------------------------------------------------------
-- Eventos (dia 0 = sábado da semana)
-- ---------------------------------------------------------------------

-- Eventos passados ficam confirmados até que o vídeo real seja anexado;
-- a migração exige o vídeo para permitir a transição para "realizado".

insert into eventos (id, titulo, aniversariante, idade, contratante_id, local_id, inicio, fim, situacao, tem_maquiagem, maquiagem_pessoas, orientacoes) values
  ('10000000-0000-0000-0000-000000000001', 'Festa do Davi',  'Davi',  6, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', pg_temp.quando(-14, '14:00'), pg_temp.quando(-14, '17:00'), 'confirmado', false, 0, null),
  ('10000000-0000-0000-0000-000000000002', 'Festa da Sofia', 'Sofia', 5, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', pg_temp.quando(-13, '16:00'), pg_temp.quando(-13, '19:00'), 'confirmado', false, 0, null),
  ('10000000-0000-0000-0000-000000000003', 'Festa do Miguel', 'Miguel', 7, 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', pg_temp.quando(-7, '15:00'), pg_temp.quando(-7, '18:00'), 'confirmado', false, 0, null),
  ('10000000-0000-0000-0000-000000000004', 'Festa da Alice', 'Alice', 4, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', pg_temp.quando(-7, '19:00'), pg_temp.quando(-7, '22:00'), 'confirmado', false, 0, null),
  ('10000000-0000-0000-0000-000000000005', 'Festa do Arthur', 'Arthur', 6, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', pg_temp.quando(-6, '15:00'), pg_temp.quando(-6, '18:00'), 'confirmado', false, 0, null),
  ('10000000-0000-0000-0000-000000000006', 'Escola Pequeno Saber', null, null, 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', pg_temp.quando(-5, '10:00'), pg_temp.quando(-5, '12:00'), 'confirmado', false, 0, 'Dia das Crianças: apresentação no pátio para três turmas.'),
  ('10000000-0000-0000-0000-000000000007', 'Festa da Helena', 'Helena', 6, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', pg_temp.quando(-1, '18:00'), pg_temp.quando(-1, '21:00'), 'confirmado', false, 0,
    E'Chegar às 17h30 para trocar de roupa na sala 2.\nParabéns às 20h.'),
  ('10000000-0000-0000-0000-000000000008', 'Festa do Theo', 'Theo', 4, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', pg_temp.quando(0, '11:00'), pg_temp.quando(0, '14:00'), 'confirmado', false, 0,
    E'Festa no salão de baixo.\nDevolver a Doblò até 14h para a Festa da Laura.'),
  ('10000000-0000-0000-0000-000000000009', 'Festa da Laura', 'Laura', 5, 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', pg_temp.quando(0, '15:00'), pg_temp.quando(0, '18:00'), 'confirmado', true, 2,
    E'Entrada dos personagens às 16h, depois do teatrinho do buffet.\nA aniversariante é tímida: a Princesa do Gelo chega primeiro e se apresenta com calma.\nParabéns às 17h30, com os dois personagens ao lado da mesa.\nEstacionar a Doblò na entrada lateral, pela Rua das Acácias.'),
  ('10000000-0000-0000-0000-000000000010', 'Festa do Gael', 'Gael', 7, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', pg_temp.quando(0, '19:00'), pg_temp.quando(0, '21:30'), 'agendado', false, 0, null),
  ('10000000-0000-0000-0000-000000000011', 'Festa da Valentina', 'Valentina', 5, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', pg_temp.quando(1, '16:00'), pg_temp.quando(1, '19:00'), 'confirmado', true, 2,
    'Festa no salão do prédio. Interfone 51.'),
  ('10000000-0000-0000-0000-000000000012', 'Festa do Bento', 'Bento', 3, 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', pg_temp.quando(7, '15:00'), pg_temp.quando(7, '18:00'), 'agendado', false, 0, null),
  ('10000000-0000-0000-0000-000000000013', 'Festa da Cecília', 'Cecília', 8, 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', pg_temp.quando(8, '14:00'), pg_temp.quando(8, '17:00'), 'agendado', false, 0, null),
  ('10000000-0000-0000-0000-000000000014', 'Festa à fantasia da Liz', 'Liz', 6, 'c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', pg_temp.quando(14, '16:00'), pg_temp.quando(14, '19:00'), 'agendado', false, 0, null);

-- ---------------------------------------------------------------------
-- Escala (passa pelas travas de horário, personagem e fantasia)
-- ---------------------------------------------------------------------

insert into evento_escala (id, evento_id, profissional_id, funcao, personagem_id, fantasia_id, maquiar, horario_maquiagem) values
  -- realizados
  (default, '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'artista',  'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', false, null),
  (default, '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'artista',  'b0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', false, null),
  (default, '10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000006', 'artista',  'b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', false, null),
  (default, '10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'artista',  'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', false, null),
  (default, '10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'artista',  'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', false, null),
  (default, '10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'artista',  'b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', false, null),
  (default, '10000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  -- Helena
  (default, '10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'artista',  'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', false, null),
  (default, '10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000006', 'artista',  'b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', false, null),
  (default, '10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  -- Theo
  (default, '10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'artista',  'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', false, null),
  (default, '10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'artista',  'b0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', false, null),
  (default, '10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  -- Laura (o Lucas vai pedir a troca)
  (default, '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'artista',  'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', true, null),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'artista', 'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', true, null),
  (default, '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  (default, '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'maquiador', null, null, false, pg_temp.quando(0, '14:00')),
  -- Gael (sem veículo)
  (default, '10000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000006', 'artista',  'b0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005', false, null),
  (default, '10000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null),
  -- Valentina (fantasia em limpeza e sem maquiagem escalada)
  (default, '10000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', 'artista',  'b0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', true, null),
  (default, '10000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000004', 'artista',  'b0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', true, null),
  (default, '10000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000007', 'produtor', null, null, false, null),
  -- Bento
  (default, '10000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'artista',  'b0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', false, null),
  (default, '10000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000008', 'produtor', null, null, false, null);

-- Conferência das fantasias de um evento realizado
insert into conferencias_fantasia (evento_id, fantasia_id, devolvida, condicao, precisa_limpeza, pendencias) values
  ('10000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000005', true, 'ok', false, null);

-- ---------------------------------------------------------------------
-- Veículo
-- ---------------------------------------------------------------------

insert into reservas_veiculo (veiculo_id, evento_id, responsavel_id, retirada, devolucao_prevista) values
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', pg_temp.quando(-1, '16:45'), pg_temp.quando(-1, '21:45')),
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', pg_temp.quando(0, '09:00'),  pg_temp.quando(0, '14:00')),
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', pg_temp.quando(0, '14:15'),  pg_temp.quando(0, '19:00')),
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000007', pg_temp.quando(1, '14:30'),  pg_temp.quando(1, '19:45'));

-- ---------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------

insert into evento_financeiro (evento_id, valor_contratado) values
  ('10000000-0000-0000-0000-000000000007', 1500),
  ('10000000-0000-0000-0000-000000000008', 1400),
  ('10000000-0000-0000-0000-000000000009', 1800),
  ('10000000-0000-0000-0000-000000000010', 900),
  ('10000000-0000-0000-0000-000000000011', 1600);

insert into recebimentos (evento_id, valor, recebido_em, forma) values
  ('10000000-0000-0000-0000-000000000007', 1500, current_date - 14, 'pix'),
  ('10000000-0000-0000-0000-000000000008', 700,  current_date - 10, 'pix'),
  ('10000000-0000-0000-0000-000000000009', 900,  current_date - 13, 'pix'),
  ('10000000-0000-0000-0000-000000000011', 800,  current_date - 7,  'transferência');

insert into pagamentos_profissionais (evento_id, profissional_id, valor_combinado, situacao, pago_em) values
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 250, 'pago', current_date - 1),
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000006', 250, 'pago', current_date - 1),
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 200, 'pago', current_date - 1),
  ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 250, 'pendente', null),
  ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 250, 'pendente', null),
  ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 200, 'pago', current_date - 1),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 250, 'pendente', null),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 250, 'pendente', null),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007', 200, 'pendente', null),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 220, 'pago', current_date - 1);

insert into despesas (evento_id, tipo, descricao, valor, responsavel_id, comprovante) values
  ('10000000-0000-0000-0000-000000000009', 'extra',  'Balões e fita para a entrada', 45, 'a0000000-0000-0000-0000-000000000007', 'Nota da papelaria (foto no WhatsApp)'),
  (null,                                   'insumo', 'Reposição de glitter e tinta facial', 68, 'a0000000-0000-0000-0000-000000000009', null);

-- ---------------------------------------------------------------------
-- Troca aguardando aprovação (Lucas indicou Rafael, que já aceitou)
-- ---------------------------------------------------------------------

insert into substituicoes (escala_id, solicitante_id, substituto_id, motivo, situacao, solicitado_em, respondido_em) values
  ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
   'Consulta médica no sábado à tarde', 'aguardando_aprovacao', now() - interval '2 hours', now() - interval '80 minutes');
