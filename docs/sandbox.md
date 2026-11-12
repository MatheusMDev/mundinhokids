# Sandbox para o cliente testar (card #67)

Projeto Supabase separado da produção, com a mesma estrutura e regras de banco, mas
**sem nenhum dado real**.

| | Produção | Sandbox |
| --- | --- | --- |
| Organização | MatheusMDev's Org | Sandbox |
| Projeto | `mundinho-Kids` (`ffrzzhgcgidgpupfheld`) | `MatheusMDev's Sandbox` (`lscwfrxcmcyrotawnkew`) |
| Região | São Paulo | us-west-2 (Oregon) |
| Postgres | 17.11 | 17.11 |

## O que já foi feito (2026-11-10)

1. **Migrações recuperadas.** O banco de produção tinha mudanças que não estavam no Git.
   Elas foram lidas direto do catálogo do Postgres de produção (só leitura, sem dados) e
   viraram arquivos em `supabase/migrations/`:
   - `20261106000001_profissionais_disponiveis.sql` (tasks #63/#64)
   - `20261106000002_excluir_profissional.sql` (task #63)
   - `20261110000002_aviso_conferencia_fantasias.sql` e
     `20261110000003_despesas_so_producao.sql` (estavam aplicadas, mas o arquivo tinha
     se perdido antes do commit)
   - `20261110000004_abas_mobile.sql` (aplicada direto no banco; o código do app que usa a
     coluna `abas_mobile` também não está em nenhuma branch)
2. **Conferência.** Uma "fotografia" do catálogo (colunas, funções, regras de acesso,
   gatilhos, restrições, índices, tipos e views) do banco montado só com as migrações do
   repositório ficou igual à da produção. `npm run banco:verificar` voltou a passar
   (52 testes).
3. **Estrutura no sandbox.** Todas as migrações rodaram no SQL Editor do sandbox numa
   única execução, **sem o `seed.sql`**. A fotografia do sandbox ficou igual à da
   produção: 209 colunas, 58 regras de acesso, 93 restrições, 47 índices, 231 funções,
   23 gatilhos, tempo real em `notificacoes`, bucket `avatares` e as extensões `pg_cron`
   e `pg_net`. Linhas: 0 usuários, 0 eventos, 0 profissionais (só as 7 configurações padrão).

Não foi usada a opção *Restore to a new project*, porque ela copia dados, logins e segredos.

4. **Edge Functions publicadas** no sandbox: `usuarios` e `enviar-notificacoes`, com o
   código idêntico ao do repositório (conferido por SHA-256) e a verificação de JWT ligada.
   A `enviar-notificacoes` só funciona depois dos segredos VAPID (passo 2 abaixo).

## O que falta (envolve chaves ou decisões)

Faça no painel do **sandbox** (confira o nome do projeto no topo antes de cada passo):

1. ~~Edge Functions~~ (feito).
2. **Segredos das notificações no celular** (Edge Functions → Secrets): `VAPID_SUBJECT`,
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Use um par VAPID novo, não o da produção.
3. **Tarefa a cada 5 minutos** (SQL Editor), trocando `<anon public do sandbox>` pela
   chave *anon public* do sandbox (Project Settings → API Keys):
   ```sql
   select cron.schedule('enviar-notificacoes', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://lscwfrxcmcyrotawnkew.supabase.co/functions/v1/enviar-notificacoes',
       headers := jsonb_build_object('Content-Type', 'application/json',
         'apikey', '<anon public do sandbox>', 'Authorization', 'Bearer <anon public do sandbox>'),
       body := '{}'::jsonb) $$);
   ```
4. **Auth**: Site URL e redirects apontando para a URL do site de staging (quando existir);
   SMTP (Brevo) e os modelos de `supabase/emails/`, como em `supabase/README.md`.
5. **Primeiro login da Direção** e os logins de teste dos perfis combinados.
6. **Dados de teste fictícios** (seed novo, organizado) e o procedimento de repor o banco.
7. **Site de demonstração na Vercel: feito (2026-11-11).** No ar em
   <https://mundinhokids.vercel.app>, ligado ao sandbox (conferido no código publicado).
   Site URL e Redirect URL (`https://mundinhokids.vercel.app/**`) já configurados no Auth
   do sandbox. Os passos abaixo ficam para refazer, se precisar.
   (Plano Hobby, grátis; é só para a dona ver o
   sistema, o site definitivo vai para a Hostinger). O repositório já tem o `vercel.json`
   (manda todas as rotas para o `index.html`, para recarregar `/eventos/...` não dar 404,
   e pede aos buscadores para não indexar o site).
   1. Criar a conta em vercel.com entrando com o GitHub.
   2. *Add New → Project* → importar `MatheusMDev/mundinhokids`, branch `main`.
      Framework, build (`npm run build`) e pasta (`dist`) já vêm do `vercel.json`.
   3. Em *Environment Variables*, antes do primeiro deploy:
      - `VITE_SUPABASE_URL` = `https://lscwfrxcmcyrotawnkew.supabase.co`
      - `VITE_SUPABASE_ANON_KEY` = chave *anon public* do **sandbox**
      - `VITE_VAPID_PUBLIC_KEY` = só quando o passo 2 for feito
      Nunca a `service_role`, e nunca as chaves da produção.
   4. *Deploy*. Depois, no sandbox, Authentication → URL Configuration: **Site URL** =
      endereço da Vercel (ex.: `https://mundinhokids.vercel.app`) e o mesmo endereço com
      `/**` em **Redirect URLs**. Sem isso, convites e troca de senha voltam para o lugar errado.
   5. Mudou uma variável? Fazer *Redeploy*: as `VITE_` entram no build, não são lidas na hora.
8. Supabase Free pausa o projeto após 1 semana sem uso: abrir o painel do sandbox antes
   de cada demonstração.

## Como recriar a estrutura do zero no sandbox

Rodar, em ordem, todos os arquivos de `supabase/migrations/` no SQL Editor do sandbox
(**sem** o `seed.sql`), e depois:

```sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
```

Nunca rodar isso na produção.
