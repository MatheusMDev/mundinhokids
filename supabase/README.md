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

## 3. Criar os logins de teste

1. **Authentication → Users → Add user → Create new user**.
2. Crie, por exemplo, `gerente@teste.com` e `supervisora@teste.com`, com senha, e
   marque **Auto Confirm User**.
3. No SQL Editor, rode `vincular_usuarios.sql` (troque os e-mails se usou outros).
   A consulta no fim mostra quem ficou ligado a qual perfil.

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
- **Convite de profissionais**: criar login para artistas e produtores pelo app precisa
  de uma Edge Function com a chave de administrador. Por enquanto, crie em Authentication.
