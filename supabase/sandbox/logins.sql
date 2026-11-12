-- =====================================================================
-- Mundinho Kids — logins fictícios do SANDBOX (demonstração, card #67)
--
-- Rodar só no projeto "MatheusMDev's Sandbox" (lscwfrxcmcyrotawnkew),
-- DEPOIS de supabase/sandbox/dados.sql. Nunca rodar na produção.
--
-- Todos os logins de demonstração usam a senha fixa "senha123" (combinado para
-- a demo; não é usada em nenhum outro lugar). Nunca use estes logins ou esta
-- senha na produção.
--
-- Cria 14 logins já confirmados (e-mails fictícios @demo.com; nenhum e-mail é
-- enviado ao criar):
--   Direção, Gerente, Supervisora (sem cadastro de profissional)
--   5 artistas, 3 produtores, 2 maquiadores e 1 responsável pelas fantasias,
--   cada um ligado ao seu cadastro em Profissionais.
-- Pode rodar de novo: quem já existe só é atualizado.
-- =====================================================================

drop table if exists pg_temp.senha_demo, pg_temp.logins;
create temp table senha_demo as
select 'senha123'::text as valor;

-- Trava: só roda no banco do sandbox (o de demonstração tem os dados fictícios)
do $$
begin
  if not exists (select 1 from profissionais where id = 'a1000000-0000-0000-0000-000000000001') then
    raise exception 'Rode primeiro supabase/sandbox/dados.sql (este script é só para o sandbox).';
  end if;
end $$;

create temp table logins (id uuid, email text, nome text, perfil perfil_acesso, profissional uuid);

insert into logins values
  ('91000000-0000-0000-0000-000000000001', 'direcao@demo.com',    'Fernanda Lopes', 'diretora',    null),
  ('91000000-0000-0000-0000-000000000002', 'gerente@demo.com',    'Patrícia Gomes', 'gerente',     null),
  ('91000000-0000-0000-0000-000000000003', 'supervisora@demo.com','Camila Ramos',   'supervisora', null),
  ('91000000-0000-0000-0000-000000000011', 'julia@demo.com',      'Júlia Martins',  'artista',     'a1000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000012', 'lucas@demo.com',      'Lucas Pereira',  'artista',     'a1000000-0000-0000-0000-000000000002'),
  ('91000000-0000-0000-0000-000000000013', 'rafael@demo.com',     'Rafael Lima',    'artista',     'a1000000-0000-0000-0000-000000000003'),
  ('91000000-0000-0000-0000-000000000014', 'ana@demo.com',        'Ana Costa',      'artista',     'a1000000-0000-0000-0000-000000000004'),
  ('91000000-0000-0000-0000-000000000015', 'bia@demo.com',        'Bia Rocha',      'artista',     'a1000000-0000-0000-0000-000000000005'),
  ('91000000-0000-0000-0000-000000000016', 'bruno@demo.com',      'Bruno Alves',    'produtor',    'a1000000-0000-0000-0000-000000000006'),
  ('91000000-0000-0000-0000-000000000017', 'diego@demo.com',      'Diego Souza',    'produtor',    'a1000000-0000-0000-0000-000000000007'),
  ('91000000-0000-0000-0000-000000000018', 'marina@demo.com',     'Marina Teles',   'produtor',    'a1000000-0000-0000-0000-000000000008'),
  ('91000000-0000-0000-0000-000000000019', 'carla@demo.com',      'Carla Dias',     'maquiador',   'a1000000-0000-0000-0000-000000000009'),
  ('91000000-0000-0000-0000-000000000020', 'renan@demo.com',      'Renan Prado',    'maquiador',   'a1000000-0000-0000-0000-000000000010'),
  ('91000000-0000-0000-0000-000000000021', 'paula@demo.com',      'Paula Nunes',    'fantasias',   'a1000000-0000-0000-0000-000000000011');

-- Logins no Supabase Auth (já confirmados, sem pedir troca de senha)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', l.id, 'authenticated', 'authenticated', l.email,
       extensions.crypt((select valor from senha_demo), extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('nome', l.nome, 'trocar_senha', false), now(), now(), '', '', '', ''
from logins l
where not exists (select 1 from auth.users u where lower(u.email) = lower(l.email));

-- Senha de quem já existia é atualizada para a da demo
update auth.users u
   set encrypted_password = extensions.crypt((select valor from senha_demo), extensions.gen_salt('bf')),
       updated_at = now()
  from logins l
 where lower(u.email) = lower(l.email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from logins l
join auth.users u on lower(u.email) = lower(l.email)
where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

-- Perfil de acesso de cada login
insert into usuarios (id, nome, email, perfil)
select u.id, l.nome, u.email, l.perfil
from logins l
join auth.users u on lower(u.email) = lower(l.email)
on conflict (id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true;

-- Liga cada login ao seu cadastro de profissional
update profissionais p
   set usuario_id = u.id
  from logins l
  join auth.users u on lower(u.email) = lower(l.email)
 where l.profissional = p.id
   and p.usuario_id is distinct from u.id;

-- Confere quem ficou ligado
select us.email, us.perfil, p.nome as profissional, p.funcoes
from usuarios us
left join profissionais p on p.usuario_id = us.id
order by us.perfil, us.email;
