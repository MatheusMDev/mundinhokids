# Base de teste no Supabase

Passo a passo para subir a base de teste e ligar o app nela.

## 1. Criar o projeto

1. Entre em https://supabase.com/dashboard e crie um projeto novo (ex.: `mundinho-teste`).
2. Região: **South America (São Paulo)**.
3. Guarde a senha do banco num lugar seguro (não vai para o repositório).

## 2. Rodar o banco

Jeito mais rápido: rode `npm run banco:juntar`, abra `supabase/subir_tudo.sql`, copie tudo,
cole no **SQL Editor → New query** e clique em **Run** (confirme o aviso de operações
destrutivas: são as colunas de observações que mudam de tabela). Ou, um por vez: cada
arquivo de `migrations/` em ordem de nome e, por último, o `seed.sql` (dados de teste).

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
4. **E-mails**: o envio padrão do Supabase só entrega para os membros da conta e poucos
   por hora. No projeto de teste, o envio sai pela **Brevo** (SMTP `smtp-relay.brevo.com`,
   porta 587), em **Authentication → Emails → SMTP Settings**. Sem SMTP, use a **senha
   provisória** ao criar o acesso: funciona sem e-mail.
5. **Modelos de e-mail em português**: ficam em `emails/` (a primeira linha de cada
   arquivo é o assunto). Em **Authentication → Emails → Templates**, cole cada um no
   modelo certo: `convite.html` → *Invite user*, `nova_senha.html` → *Reset password*,
   `senha_alterada.html` → *Password changed* e `email_alterado.html` → *Email address
   changed* (estes dois com **Enable notification** ligado).

Regras que a função garante: só Direção e Gerente mexem em acessos; só a Direção cria
ou altera acessos de Direção; ninguém muda o próprio perfil nem se desativa; o sistema
nunca fica sem ninguém da gestão ativo; acesso desativado não consegue mais entrar.

## 4. Ligar o app

1. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
2. Na raiz do projeto, copie `.env.example` para `.env.local` e cole os dois valores.
3. Rode `npm run dev` e entre com um dos logins.

Com o login da gerente aparecem os valores e o botão de aprovar troca. Com o da
Assistente, os valores ficam disponíveis fora do Painel, mas as alterações continuam restritas à gestão.

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
testes das regras. Esperado: "... testes passaram, 0 falharam". Inclua toda migração
nova na lista `MIGRACOES` de `verificar/verificar.mjs` e `verificar/perfis.mjs`.

### Opcional: Supabase CLI

A pasta já segue o formato da CLI. Se preferir não colar no SQL Editor:

```bash
npx supabase login
npx supabase link --project-ref <id-do-projeto>
npx supabase db push
```

O `db push` aplica só as migrações; o `seed.sql` continua sendo rodado à mão no SQL Editor.

## Avisos automáticos no desktop

A central de notificações funciona depois da migração `20261107000001_notificacoes_desktop.sql`.
Para ativar o alerta do navegador:

1. Gere um par VAPID (por exemplo, `npx web-push generate-vapid-keys`).
2. Publique a função `enviar-notificacoes`: `npx supabase functions deploy enviar-notificacoes --project-ref <project-ref>`.
3. Em **Edge Functions → Secrets**, configure `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY` e
   `VAPID_PRIVATE_KEY`. A chave privada nunca vai para o navegador.
4. No ambiente do app, configure `VITE_VAPID_PUBLIC_KEY` com a chave pública e publique
   novamente o front-end.
5. Ative `pg_cron` e `pg_net` no projeto e crie o agendamento a cada cinco minutos. Use a chave
   **anon public** do projeto no cron; nunca coloque a `service_role` no SQL ou no navegador:

```sql
select cron.schedule(
  'enviar-notificacoes', '*/5 * * * *',
  $$ select net.http_post(
    url := 'https://<projeto>.supabase.co/functions/v1/enviar-notificacoes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<anon public>',
      'Authorization', 'Bearer <anon public>'
    ),
    body := '{}'::jsonb
  ) $$
);
```

A fila `notificacoes` continua sendo preenchida automaticamente pelos gatilhos do banco.
Sem VAPID ou permissão do navegador, a pessoa ainda consulta os avisos na central do sistema.

## Minha conta e foto de perfil

A migration `20261110000001_minha_conta.sql` adiciona telefone e caminho da foto em
`usuarios`, cria o bucket público `avatares` e limita envio, troca e remoção ao diretório
da própria pessoa (`<id-do-usuario>/...`). Também cria as funções usadas pela tela
`/minha-conta` para alterar nome, telefone, disponibilidade e foto sem liberar edição
do perfil, das funções ou da situação do acesso.

Para publicar, aplique a migration normalmente com `npx supabase db push` ou rode o
conteúdo no SQL Editor. A troca de e-mail continua sendo feita pelo Supabase Auth e
exige a confirmação do link enviado ao novo endereço.
