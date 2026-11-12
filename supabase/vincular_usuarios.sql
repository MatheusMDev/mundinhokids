-- =====================================================================
-- Mundinho Kids — liga os logins do Supabase Auth aos perfis
--
-- 1. Crie cada usuário em Authentication > Users > Add user
--    (marque "Auto Confirm User").
-- 2. Rode este script no SQL Editor. Pode rodar de novo sempre que criar
--    outro login: quem já está ligado só é atualizado.
--
-- Perfis: diretora, gerente, supervisora, produtor, artista, maquiador, fantasias
-- =====================================================================

-- Login → perfil. Quem é da equipe também diz qual profissional do cadastro é.
create temp table logins (email text, nome text, perfil perfil_acesso, profissional text) on commit drop;

insert into logins values
  ('gerente@teste.com',     'Gerente geral', 'gerente',     null),
  ('supervisora@teste.com', 'Assistente',     'supervisora', null),
  ('bruno@teste.com',       'Bruno Alves',   'produtor',    'Bruno Alves'),
  ('julia@teste.com',       'Júlia Martins', 'artista',     'Júlia Martins'),
  ('paula@teste.com',       'Paula Nunes',   'fantasias',   'Paula Nunes');

insert into usuarios (id, nome, email, perfil)
select u.id, l.nome, u.email, l.perfil
from logins l
join auth.users u on lower(u.email) = lower(l.email)
on conflict (id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true;

update profissionais p
   set usuario_id = u.id
  from logins l
  join auth.users u on lower(u.email) = lower(l.email)
 where l.profissional is not null and p.nome = l.profissional
   and p.usuario_id is distinct from u.id;

-- Confere quem ficou ligado
select us.email, us.perfil, p.nome as profissional
from usuarios us
left join profissionais p on p.usuario_id = us.id
order by us.perfil, us.email;
