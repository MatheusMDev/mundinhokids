# Mundinho Kids — gestão de eventos e equipes

Sistema web (computador e celular) para organizar as festas do Mundinho Kids: agenda,
eventos, equipe escalada, personagens, fantasias, veículos, financeiro, trocas entre
profissionais e notificações.

- **Front:** React 18 + TypeScript + Vite, com React Router.
- **Banco, login e funções:** Supabase (Postgres com permissões por linha, Auth e Edge Functions).
- **Sem servidor próprio:** o navegador fala direto com o Supabase. Cada perfil só recebe
  do banco o que pode ver.

## Sumário

1. [Pré-requisitos](#pré-requisitos)
2. [Rodar na sua máquina](#rodar-na-sua-máquina)
3. [Variáveis de ambiente](#variáveis-de-ambiente)
4. [Supabase](#supabase)
5. [Comandos](#comandos)
6. [Testes e validações](#testes-e-validações)
7. [Estrutura de pastas](#estrutura-de-pastas)
8. [Perfis e telas](#perfis-e-telas)
9. [Como contribuir](#como-contribuir)

## Pré-requisitos

| Ferramenta | Versão | Para quê |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 20 ou mais nova | Rodar o app e os testes |
| npm | o que vem com o Node | Instalar dependências |
| Git | qualquer recente | Baixar o código e mandar alterações |
| Conta no [Supabase](https://supabase.com/dashboard) | — | Só para quem cuida do banco |

Não precisa de Docker nem de Postgres instalado: os testes do banco usam um Postgres
embutido (PGlite).

## Rodar na sua máquina

```bash
git clone https://github.com/MatheusMDev/mundinhokids.git
cd mundinhokids
npm install
```

Crie o arquivo de ambiente a partir do modelo e preencha com os dados do Supabase
(veja [Variáveis de ambiente](#variáveis-de-ambiente)):

```bash
cp .env.example .env.local
```

No Windows (PowerShell): `Copy-Item .env.example .env.local`.

Suba o app:

```bash
npm run dev
```

Abra http://localhost:5173 e entre com o seu login. Logins são criados pela Direção ou
pela Gerência dentro do próprio sistema, em **Usuários e acessos**. Se faltar o
`.env.local`, o app mostra a tela "Supabase não configurado"; preencha o arquivo e
reinicie o `npm run dev`.

## Variáveis de ambiente

Ficam no `.env.local`, na raiz. Esse arquivo está no `.gitignore` e nunca vai para o
repositório. O modelo é o [.env.example](.env.example).

| Variável | Obrigatória | Onde pegar |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Sim | Supabase → **Project Settings → API → Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Sim | Supabase → **Project Settings → API Keys** → chave *anon public* ou *publishable* |
| `VITE_VAPID_PUBLIC_KEY` | Não | Chave pública VAPID, para o alerta de notificação no navegador ([como gerar](supabase/README.md#avisos-automáticos-no-desktop)) |

> Tudo que começa com `VITE_` vai para o navegador. A chave *anon/publishable* pode ir,
> porque quem protege os dados são as permissões do banco. A chave **service_role /
> secret** nunca entra no `.env.local`, no código nem no Git: ela só existe dentro das
> Edge Functions, no próprio Supabase.

## Supabase

O passo a passo completo está em [supabase/README.md](supabase/README.md). Resumo:

| O quê | Onde | Observação |
| --- | --- | --- |
| Estrutura do banco | `supabase/migrations/` | Um arquivo por mudança, com data no nome, aplicado em ordem |
| Dados de teste | `supabase/seed.sql` | Só para a base de **teste**, com eventos da semana atual |
| Tudo de uma vez | `supabase/subir_tudo.sql` | Migrações + seed num arquivo só (gerado por `npm run banco:juntar`) |
| Primeiro login da Direção | `supabase/vincular_usuarios.sql` | Liga um login do Auth a um perfil. Usado uma vez, na implantação |
| Criar e alterar logins | `supabase/functions/usuarios/` | Edge Function chamada pela tela **Usuários e acessos** |
| Notificações no navegador | `supabase/functions/enviar-notificacoes/` | Edge Function chamada a cada 5 minutos pelo `pg_cron` |
| E-mails em português | `supabase/emails/` | Convite, nova senha, senha alterada e e-mail alterado |

Regras importantes:

- **As donas não usam o painel do Supabase.** Logins, senhas, perfis e permissões são
  geridos pelo site. O painel é só para quem cuida da implantação.
- **Nunca edite uma migração que já rodou.** Crie um arquivo novo em `migrations/` e
  inclua o nome dele na lista `MIGRACOES` de `supabase/verificar/verificar.mjs` e
  `supabase/verificar/perfis.mjs`.
- Depois de mudar migrações ou o seed, rode `npm run banco:juntar` para atualizar o
  `subir_tudo.sql`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o app em http://localhost:5173 com recarga automática |
| `npm run build` | Confere os tipos (TypeScript) e gera a versão de produção em `dist/` |
| `npm run preview` | Serve o `dist/` localmente, para conferir o build |
| `npm run banco:verificar` | Testa migrações, seed e permissões do banco num Postgres local |
| `npm run perfis:verificar` | Testa o que cada perfil (gerente, supervisora, equipe, fantasias) pode ler e gravar |
| `npm run pessoas:verificar` | Testa telas de pessoas e acessos renderizando os componentes reais |
| `npm run financeiro:verificar` | Testa os cálculos do Financeiro (totais, a pagar, despesas) |
| `npm run banco:juntar` | Gera `supabase/subir_tudo.sql` para colar de uma vez no SQL Editor |

## Testes e validações

Antes de abrir um PR, rode:

```bash
npm run build
npm run banco:verificar
npm run perfis:verificar
npm run pessoas:verificar
npm run financeiro:verificar
```

Todos devem terminar com "0 falharam" (ou "passaram", nos que não contam falhas).
Nenhum deles conecta ao Supabase nem altera dados reais.

## Estrutura de pastas

```
src/
  main.tsx               ponto de entrada
  App.tsx                rotas; cada tela fica dentro de <Restrita> (checa a permissão)
  estilos.css            todo o visual (cores, componentes, celular)
  pages/                 uma tela por arquivo
    Painel.tsx             calendário, pendências e agenda da equipe
    DetalheEvento.tsx      evento: equipe, fantasias, transporte, trocas, financeiro, histórico
    PdfEvento.tsx          folha operacional para salvar em PDF (sem valores)
    Cadastros.tsx          Eventos, Profissionais, Personagens, Fantasias, Veículos, Cadastros, Mais
    Financeiro.tsx         totais, valores por evento, a pagar e despesas
    Notificacoes.tsx       central de avisos e alerta do navegador
    Usuarios.tsx           usuários e acessos (criar, editar, permissões, excluir)
    Configuracoes.tsx      regras do sistema
    Login.tsx, TrocarSenha.tsx, Erro.tsx
  components/            peças reutilizadas
    Layout.tsx             menu lateral, abas do celular e topo
    Restrita.tsx           bloqueia a rota se o perfil não pode ver a tela
    Formulario*.tsx        diálogos de criar e editar
    SeletorFiltro.tsx, Paginacao.tsx, Calendario.tsx, Icone.tsx, Skeleton*.tsx
  lib/                   regras e acesso a dados, sem visual
    supabase.ts            cliente do Supabase (lê o .env.local)
    dados.ts               lê o banco e monta a base que as telas usam
    estado.tsx             login, perfil, permissões, telas liberadas e recarga
    acoes.ts               tudo que grava no banco ou chama Edge Functions
    consultas.ts           cálculos das telas (pendências, conflitos, fantasias)
    financeiro.ts          cálculos do Financeiro
    tipos.ts               tipos com os mesmos nomes das colunas do banco
    erros.ts               erros do banco traduzidos para português
    formato.ts             datas, horas, dinheiro e textos
public/                  ícone, imagem de erro e service worker das notificações
scripts/                 testes de telas e do Financeiro (Node)
supabase/                banco, Edge Functions, e-mails e testes do banco (ver acima)
docs/                    anotações de entregas específicas (tasks #57, #63, #64)
```

## Perfis e telas

O perfil de cada login define o que ele vê por padrão. Quem tem mais de uma função (por
exemplo, artista e produtor) soma as telas das duas. A Direção e a Gerência podem ajustar
as telas de cada pessoa em **Usuários e acessos → Permissões**.

| Perfil | Vê |
| --- | --- |
| Direção e Gerente geral | Tudo, inclusive valores, Financeiro e Usuários e acessos |
| Supervisora | Tudo, menos Financeiro e valores |
| Produtor | Só a própria agenda, os eventos em que está escalado e Veículos |
| Artista e Maquiador | Só a própria agenda e os eventos em que está escalado |
| Fantasias | Só Fantasias |

A tela esconde o que o perfil não pode ver, mas a proteção de verdade está no banco: um
perfil sem permissão não recebe os dados, mesmo que tente chamar a API direto.

| Caminho | Tela |
| --- | --- |
| `/` | Calendário e painel (no celular, Agenda) |
| `/eventos`, `/eventos/:id`, `/eventos/:id/pdf` | Lista, detalhe e folha em PDF do evento |
| `/notificacoes` | Central de avisos |
| `/profissionais` | Equipe (só visualização; o cadastro é feito em Usuários e acessos) |
| `/personagens`, `/fantasias`, `/veiculos`, `/cadastros` | Cadastros de apoio |
| `/financeiro` | Financeiro (só Direção e Gerência) |
| `/usuarios` | Usuários e acessos (só Direção e Gerência) |
| `/configuracoes` | Regras do sistema |
| `/mais` | Menu extra do celular |

## Como contribuir

O código fica em https://github.com/MatheusMDev/mundinhokids e as tarefas no quadro do
Trello do projeto, numeradas (`#24`, `#61`...).

1. **Atualize a `main`** antes de começar:
   ```bash
   git checkout main
   git pull
   ```
2. **Crie uma branch** a partir dela, no formato `tipo/seu-nome/assunto`:
   ```bash
   git checkout -b feat/matheus/minha-conta
   ```
   Tipos: `feat` (novidade), `fix` (correção), `docs` (documentação), `refactor`,
   `chore` (manutenção).
3. **Commits** no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/),
   citando o card do Trello quando houver:
   ```
   feat: #59 tela Minha conta com nome, foto e telefone
   fix: #26 supervisora não vê valores no detalhe do evento
   ```
4. **Rode os testes** da seção [Testes e validações](#testes-e-validações).
5. **Abra um Pull Request** para a `main` no GitHub, dizendo o que mudou e como testar.
   O merge é feito pelo Matheus depois da revisão.
6. **Mudou o banco?** Diga no PR qual migração precisa ser aplicada no Supabase. Mudou
   uma Edge Function? Diga que ela precisa ser publicada de novo.
7. **Mova o card** no Trello conforme o andamento.

Nunca commite `.env.local`, chaves `service_role`/`secret` nem senhas.
