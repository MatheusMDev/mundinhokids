# Base de teste no Supabase

Passo a passo para subir a base de teste e ligar o app nela.

## 1. Criar o projeto

1. Entre em https://supabase.com/dashboard e crie um projeto novo (ex.: `mundinho-teste`).
2. Região: **South America (São Paulo)**.
3. Guarde a senha do banco num lugar seguro (não vai para o repositório).

## 2. Rodar o banco

Jeito mais rápido: rode `npm run banco:juntar`, abra `supabase/subir_tudo.sql`, copie tudo,
cole no **SQL Editor → New query** e clique em **Run** (confirme o aviso de operações
destrutivas: são as colunas de observações que mudam de tabela). Ou, um por vez, na ordem:

| Ordem | Arquivo | O que faz |
| --- | --- | --- |
| 1 | `migrations/20261020000001_schema_v1.sql` | Tabelas, travas, permissões e funções |
| 2 | `migrations/20261020000002_ajustes_v1.sql` | Correções da V1 |
| 3 | `seed.sql` | Dados de teste (eventos da semana atual) |

Cada um deve terminar com "Success. No rows returned".

> O `seed.sql` é só para a base de **teste**. Para rodar de novo do zero, apague o
> projeto e crie outro, ou recrie o schema `public`.

## 3. Acessos: tudo pelo site

Logins, senhas e perfis são criados e alterados no próprio site, em **Usuários e
acessos**, por Direção e Gerente. As donas não usam o painel do Supabase.

Quem cuida do sistema faz, uma vez, na implantação:

1. **Publicar a função `usuarios`** (é ela que cria e altera logins com a chave de
   administrador, que nunca vai para o navegador): **Edge Functions → Deploy a new
   function → Via Editor**, nome `usuarios`, colar `functions/usuarios/index.ts` e
   **Deploy function**. Para atualizar: aba **Code** da função → **Deploy updates**.
   Ou pela CLI: `npx supabase functions deploy usuarios`.
2. **Authentication → URL Configuration → Site URL**: o endereço do site (em teste,
   `http://localhost:5173`). É para lá que voltam os links de convite e de
   "esqueci minha senha".
3. **O primeiro login da Direção**: **Authentication → Users → Add user**, com senha e
   **Auto Confirm User**, e depois rodar `vincular_usuarios.sql` no SQL Editor com
   esse e-mail e o perfil `diretora`. Daí em diante a Direção cria todo o resto pelo site.
4. **E-mails** (opcional): o envio padrão do Supabase só entrega para os membros da
   conta e poucos por hora. Para convite e "esqueci minha senha" funcionarem com a
   equipe, configure um SMTP em **Authentication → Emails → SMTP Settings**. Sem isso,
   use a **senha provisória** ao criar o acesso: funciona sem e-mail.

Regras que a função garante: só Direção e Gerente mexem em acessos; só a Direção cria
ou altera acessos de Direção; ninguém muda o próprio perfil nem se desativa; o sistema
nunca fica sem ninguém da gestão ativo; acesso desativado não consegue mais entrar.

## 4. Ligar o app

1. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
2. Na raiz do projeto, copie `.env.example` para `.env.local` e cole os dois valores.
3. Rode `npm run dev` e entre com um dos logins.

Com o login da gerente aparecem os valores e o botão de aprovar troca. Com o da
supervisora, os valores ficam ocultos, porque o banco não os envia.

> A chave **anon** pode ficar no navegador: quem protege os dados são as permissões
> do banco. A chave **service_role** nunca vai para o `.env.local` nem para o repositório.

## Antes de mexer no banco

Toda mudança de estrutura vira um novo arquivo em `migrations/`, com data no nome
(ex.: `20261105000001_campo_confirmacao_escala.sql`), e nunca se altera um arquivo
que já rodou. Antes de subir, rode:

```bash
npm run banco:verificar
```

Isso carrega as migrações, o seed e o vínculo de logins num Postgres local e roda os
testes das regras. Esperado: "22 testes passaram, 0 falharam".

### Opcional: Supabase CLI

A pasta já segue o formato da CLI. Se preferir não colar no SQL Editor:

```bash
npx supabase login
npx supabase link --project-ref <id-do-projeto>
npx supabase db push
```

O `db push` aplica só as migrações; o `seed.sql` continua sendo rodado à mão no SQL Editor.

## Ainda não ativado

- **Avisos por push**: o agendamento (pg_cron + Edge Function `enviar-notificacoes`)
  está comentado no fim do schema. A fila `notificacoes` já é preenchida pelo banco.
