-- =====================================================================
-- Mundinho Kids — dados fictícios do SANDBOX (demonstração, card #67)
--
-- Rodar só no projeto "MatheusMDev's Sandbox" (lscwfrxcmcyrotawnkew),
-- com o banco vazio, ANTES de supabase/sandbox/logins.sql.
-- Nunca rodar na produção. Todos os nomes, telefones e valores são inventados.
--
-- As datas são relativas ao dia em que o script roda: duas festas já
-- realizadas e quatro nos próximos dias, para o calendário, o financeiro
-- e as notificações terem o que mostrar.
-- =====================================================================

do $$
begin
  if exists (select 1 from eventos) or exists (select 1 from profissionais) then
    raise exception 'O banco já tem eventos ou profissionais. Este script é só para o sandbox vazio.';
  end if;
end $$;

-- Dia relativo a hoje, no horário de São Paulo
create function pg_temp.dia(p_dias int, p_hora text) returns timestamptz
language sql stable as $$
  select (((now() at time zone 'America/Sao_Paulo')::date + p_dias) + p_hora::time) at time zone 'America/Sao_Paulo'
$$;

-- Próximo sábado depois de hoje (+ p_dias), no horário de São Paulo
create function pg_temp.sabado(p_dias int, p_hora text) returns timestamptz
language sql stable as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select (((d + ((6 - extract(dow from d)::int + 6) % 7) + 1) + p_dias) + p_hora::time) at time zone 'America/Sao_Paulo'
  from hoje
$$;

-- ---------------------------------------------------------------------
-- Profissionais: 5 artistas, 3 produtores, 2 maquiadores, 1 fantasias
-- (os logins são ligados a eles por supabase/sandbox/logins.sql)
-- ---------------------------------------------------------------------

insert into profissionais (id, nome, telefone, email, funcoes, disponibilidade) values
  ('a1000000-0000-0000-0000-000000000001', 'Júlia Martins', '(11) 90000-1001', 'julia@demo.com',   '{artista}',   'Fins de semana'),
  ('a1000000-0000-0000-0000-000000000002', 'Lucas Pereira', '(11) 90000-1002', 'lucas@demo.com',   '{artista}',   null),
  ('a1000000-0000-0000-0000-000000000003', 'Rafael Lima',   '(11) 90000-1003', 'rafael@demo.com',  '{artista}',   null),
  ('a1000000-0000-0000-0000-000000000004', 'Ana Costa',     '(11) 90000-1004', 'ana@demo.com',     '{artista}',   'Só sábado e domingo'),
  ('a1000000-0000-0000-0000-000000000005', 'Bia Rocha',     '(11) 90000-1005', 'bia@demo.com',     '{artista}',   null),
  ('a1000000-0000-0000-0000-000000000006', 'Bruno Alves',   '(11) 90000-1006', 'bruno@demo.com',   '{produtor}',  null),
  ('a1000000-0000-0000-0000-000000000007', 'Diego Souza',   '(11) 90000-1007', 'diego@demo.com',   '{produtor}',  null),
  ('a1000000-0000-0000-0000-000000000008', 'Marina Teles',  '(11) 90000-1008', 'marina@demo.com',  '{produtor}',  'Tardes'),
  ('a1000000-0000-0000-0000-000000000009', 'Carla Dias',    '(11) 90000-1009', 'carla@demo.com',   '{maquiador}', null),
  ('a1000000-0000-0000-0000-000000000010', 'Renan Prado',   '(11) 90000-1010', 'renan@demo.com',   '{maquiador}', null),
  ('a1000000-0000-0000-0000-000000000011', 'Paula Nunes',   '(11) 90000-1011', 'paula@demo.com',   '{fantasias}', null);

-- ---------------------------------------------------------------------
-- Personagens, quem faz cada um e as fantasias
-- ---------------------------------------------------------------------

insert into personagens (id, nome, descricao, orientacoes) values
  ('b1000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'Princesa de vestido azul e capa de neve.', 'Fala calma; canta a música do gelo no parabéns.'),
  ('b1000000-0000-0000-0000-000000000002', 'Herói Aranha',     'Herói de uniforme vermelho e azul.',        'Brincadeira da teia com as crianças maiores.'),
  ('b1000000-0000-0000-0000-000000000003', 'Sereia Encantada', 'Sereia de cauda verde.',                    'Bolhas de sabão na entrada.'),
  ('b1000000-0000-0000-0000-000000000004', 'Capitão Estrela',  'Astronauta de capacete prateado.',          'Contagem regressiva antes do parabéns.'),
  ('b1000000-0000-0000-0000-000000000005', 'Fada das Flores',  'Fada de asas coloridas e varinha.',         'Distribui pétalas de papel na roda.');

insert into profissional_personagens (profissional_id, personagem_id) values
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005'),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002'),
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002'),
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000004'),
  ('a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000003'),
  ('a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000005'),
  ('a1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003');

insert into fantasias (id, personagem_id, identificacao, tamanho, situacao, observacoes) values
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'M', 'disponivel', 'Inclui coroa e luvas'),
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Princesa do Gelo', 'P', 'disponivel', 'Inclui coroa'),
  ('f1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 'Herói Aranha',     'G', 'disponivel', 'Máscara com tela respirável'),
  ('f1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000003', 'Sereia Encantada', 'M', 'disponivel', null),
  ('f1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000004', 'Capitão Estrela',  'G', 'disponivel', 'Capacete na caixa azul'),
  ('f1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000005', 'Fada das Flores',  'M', 'disponivel', 'Asas desmontáveis');

-- ---------------------------------------------------------------------
-- Contratantes, 6 locais e veículo
-- ---------------------------------------------------------------------

insert into contratantes (id, nome, telefone, email) values
  ('c1000000-0000-0000-0000-000000000001', 'Mariana Souza (mãe)',   '(11) 90000-2001', null),
  ('c1000000-0000-0000-0000-000000000002', 'Renata Oliveira (mãe)', '(11) 90000-2002', null),
  ('c1000000-0000-0000-0000-000000000003', 'Paulo Henrique (pai)',  '(11) 90000-2003', null),
  ('c1000000-0000-0000-0000-000000000004', 'Escola Pequeno Saber',  '(11) 90000-2004', 'eventos@escola.demo.com');

insert into locais (id, nome, tipo, endereco, contato, link_localizacao, orientacoes_acesso) values
  ('d1000000-0000-0000-0000-000000000001', 'Buffet Castelo Encantado', 'buffet',     'Rua das Acácias, 245 · Jardim América', '(11) 90000-3001', 'https://maps.google.com/?q=Rua+das+Acacias+245', 'Estacionar na entrada lateral.'),
  ('d1000000-0000-0000-0000-000000000002', 'Buffet Pula-Pula',         'buffet',     'Av. dos Ipês, 1200 · Vila Nova',        '(11) 90000-3002', 'https://maps.google.com/?q=Av+dos+Ipes+1200',      'Entrada de artistas pelos fundos.'),
  ('d1000000-0000-0000-0000-000000000003', 'Buffet Mundo Mágico',      'buffet',     'Rua das Flores, 88 · Centro',           '(11) 90000-3003', 'https://maps.google.com/?q=Rua+das+Flores+88',      null),
  ('d1000000-0000-0000-0000-000000000004', 'Escola Pequeno Saber',     'escola',     'Rua do Saber, 10 · Jardim Escola',      '(11) 90000-2004', 'https://maps.google.com/?q=Rua+do+Saber+10',        'Apresentar-se na secretaria.'),
  ('d1000000-0000-0000-0000-000000000005', 'Residência da família',    'casa',       'Rua das Palmeiras, 51 · Morumbi',       null,              'https://maps.google.com/?q=Rua+das+Palmeiras+51',   'Interfone 51. Festa no salão do prédio.'),
  ('d1000000-0000-0000-0000-000000000006', 'Condomínio Parque Verde',  'casa',       'Av. Central, 900 · Bloco B',            '(11) 90000-3006', 'https://maps.google.com/?q=Av+Central+900',         'Identificar-se na portaria; salão de festas no térreo.');

insert into veiculos (id, nome, placa, observacoes) values
  ('e1000000-0000-0000-0000-000000000001', 'Doblò', 'DEM0A01', 'Chave fica com a gerente.');

-- ---------------------------------------------------------------------
-- 6 eventos: 2 realizados e 4 nos próximos dias
-- ---------------------------------------------------------------------

insert into eventos (id, titulo, aniversariante, idade, contratante_id, local_id, inicio, fim, situacao, tem_maquiagem, maquiagem_pessoas, orientacoes) values
  ('11000000-0000-0000-0000-000000000001', 'Festa do Davi', 'Davi', 6, 'c1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002',
    pg_temp.dia(-6, '14:00'), pg_temp.dia(-6, '17:00'), 'realizado', false, 0, null),
  ('11000000-0000-0000-0000-000000000002', 'Festa da Sofia', 'Sofia', 5, 'c1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003',
    pg_temp.dia(-1, '15:00'), pg_temp.dia(-1, '18:00'), 'realizado', true, 3, 'Maquiagem de borboleta para a aniversariante e duas amigas.'),
  ('11000000-0000-0000-0000-000000000003', 'Festa da Laura', 'Laura', 5, 'c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
    pg_temp.sabado(0, '15:00'), pg_temp.sabado(0, '18:00'), 'confirmado', true, 2,
    E'Entrada dos personagens às 16h, depois do teatrinho do buffet.\nA aniversariante é tímida: a Princesa do Gelo chega primeiro.\nParabéns às 17h30.'),
  ('11000000-0000-0000-0000-000000000004', 'Festa do Theo', 'Theo', 4, 'c1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000006',
    pg_temp.sabado(0, '19:00'), pg_temp.sabado(0, '22:00'), 'confirmado', false, 0, 'Festa no salão do térreo.'),
  ('11000000-0000-0000-0000-000000000005', 'Dia das Crianças — Escola Pequeno Saber', null, null, 'c1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004',
    pg_temp.sabado(1, '10:00'), pg_temp.sabado(1, '12:00'), 'agendado', true, 10, 'Apresentação no pátio para três turmas; pintura facial depois.'),
  ('11000000-0000-0000-0000-000000000006', 'Festa da Cecília', 'Cecília', 8, 'c1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000005',
    pg_temp.sabado(7, '14:00'), pg_temp.sabado(7, '17:00'), 'agendado', false, 0, null);

-- ---------------------------------------------------------------------
-- Escala (todos os profissionais aparecem em pelo menos um evento)
-- ---------------------------------------------------------------------

insert into evento_escala (evento_id, profissional_id, funcao, personagem_id, fantasia_id, maquiar, horario_maquiagem) values
  -- Davi (realizado)
  ('11000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'artista',   'b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003', false, null),
  ('11000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', 'produtor',  null, null, false, null),
  -- Sofia (realizado ontem: fantasias ainda sem conferência)
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', 'artista',   'b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000006', false, null),
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', 'artista',   'b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004', false, null),
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000007', 'produtor',  null, null, false, null),
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000009', 'maquiador', null, null, false, pg_temp.dia(-1, '14:30')),
  -- Laura
  ('11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'artista',   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', true, null),
  ('11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 'artista',   'b1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004', true, null),
  ('11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000007', 'produtor',  null, null, false, null),
  ('11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000009', 'maquiador', null, null, false, pg_temp.sabado(0, '14:00')),
  -- Theo
  ('11000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'artista',   'b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003', false, null),
  ('11000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 'artista',   'b1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000005', false, null),
  ('11000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000006', 'produtor',  null, null, false, null),
  -- Escola
  ('11000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'artista',   'b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000006', false, null),
  ('11000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000008', 'produtor',  null, null, false, null),
  ('11000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000010', 'maquiador', null, null, false, pg_temp.sabado(1, '09:30')),
  -- Cecília
  ('11000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'artista',   'b1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000006', false, null),
  ('11000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'artista',   'b1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003', false, null),
  ('11000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000008', 'produtor',  null, null, false, null);

-- Conferência das fantasias da Festa do Davi (já feita)
insert into conferencias_fantasia (evento_id, fantasia_id, devolvida, condicao, precisa_limpeza, pendencias) values
  ('11000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003', true, 'ok', false, null);

-- Reserva da Doblò para a Festa da Laura
insert into reservas_veiculo (veiculo_id, evento_id, responsavel_id, retirada, devolucao_prevista) values
  ('e1000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000007',
    pg_temp.sabado(0, '13:30'), pg_temp.sabado(0, '18:45'));

-- ---------------------------------------------------------------------
-- Financeiro (valores de exemplo)
-- ---------------------------------------------------------------------

insert into evento_financeiro (evento_id, valor_contratado) values
  ('11000000-0000-0000-0000-000000000001', 1200),
  ('11000000-0000-0000-0000-000000000002', 1650),
  ('11000000-0000-0000-0000-000000000003', 1800),
  ('11000000-0000-0000-0000-000000000004', 1400),
  ('11000000-0000-0000-0000-000000000005', 2200),
  ('11000000-0000-0000-0000-000000000006', 1300);

insert into recebimentos (evento_id, valor, recebido_em, forma) values
  ('11000000-0000-0000-0000-000000000001', 1200, current_date - 20, 'pix'),
  ('11000000-0000-0000-0000-000000000002', 1650, current_date - 12, 'pix'),
  ('11000000-0000-0000-0000-000000000003', 900,  current_date - 10, 'pix'),
  ('11000000-0000-0000-0000-000000000004', 700,  current_date - 5,  'transferência'),
  ('11000000-0000-0000-0000-000000000005', 1100, current_date - 3,  'boleto');

insert into pagamentos_profissionais (evento_id, profissional_id, valor_combinado, situacao, pago_em) values
  ('11000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 250, 'pago', current_date - 4),
  ('11000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000006', 200, 'pago', current_date - 4),
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', 250, 'pendente', null),
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000004', 250, 'pendente', null),
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000007', 200, 'pendente', null),
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000009', 220, 'pendente', null),
  ('11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 250, 'pendente', null),
  ('11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 250, 'pendente', null),
  ('11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000007', 200, 'pendente', null),
  ('11000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000009', 220, 'pendente', null),
  ('11000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 250, 'pendente', null),
  ('11000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 250, 'pendente', null),
  ('11000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000006', 200, 'pendente', null);

insert into despesas (evento_id, tipo, descricao, valor, responsavel_id, comprovante) values
  ('11000000-0000-0000-0000-000000000002', 'extra',  'Balões para a entrada', 45, 'a1000000-0000-0000-0000-000000000007', 'Foto da nota no WhatsApp'),
  (null,                                   'insumo', 'Reposição de tinta facial e glitter', 68, 'a1000000-0000-0000-0000-000000000009', null);

-- Confere o que entrou
select 'profissionais' as tabela, count(*) from profissionais
union all select 'locais', count(*) from locais
union all select 'eventos', count(*) from eventos
union all select 'escala', count(*) from evento_escala
union all select 'pagamentos', count(*) from pagamentos_profissionais;
