# Mundinho Kids — gestão de eventos e equipes

Sistema web (computador e celular) em React + Vite, com banco no Supabase.

## Rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:5173, com login. O app precisa do `.env.local` com a URL e a
chave pública do Supabase (modelo em `.env.example`). Os dados vêm do banco, já filtrados
pelas permissões de cada perfil. O passo a passo da base de teste está em
[supabase/README.md](supabase/README.md).

Logins da base de teste: `gerente@teste.com` (vê valores e aprova trocas) e
`supervisora@teste.com` (sem valores). Para testar a equipe, crie também `bruno@teste.com`
(produção), `julia@teste.com` (artista) e `paula@teste.com` (fantasias) e rode
`supabase/vincular_usuarios.sql`.

## Estrutura

```
src/                     front (React)
  pages/                 telas: Painel, DetalheEvento, PdfEvento, Cadastros, Configuracoes, Usuarios, Login
  components/            Layout, Calendario, formulários (cadastro, evento, valores, conferência, trocas)
  lib/acoes.ts           gravações no Supabase
  lib/erros.ts           erros do banco traduzidos para português
  lib/tipos.ts           tipos com os mesmos nomes das colunas do banco
  lib/consultas.ts       o que as telas calculam (pendências, conflitos, fantasias)
  lib/dados.ts           leitura do Supabase no formato das telas
  lib/estado.tsx         login, carga dos dados e ações
  lib/supabase.ts        cliente do Supabase (lê o .env.local)
supabase/                banco
  migrations/            estrutura, em ordem (schema da V1 e ajustes)
  seed.sql               dados de teste, com datas da semana atual
  subir_tudo.sql         migrações + seed num arquivo só (gerado por npm run banco:juntar)
  vincular_usuarios.sql  liga os logins do Auth aos perfis
  verificar/             testes do banco num Postgres local (PGlite)
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o app em http://localhost:5173 |
| `npm run build` | Confere os tipos e gera a versão de produção em `dist/` |
| `npm run banco:verificar` | Testa migrações, seed e permissões. Esperado: "22 testes passaram, 0 falharam" |
| `npm run banco:juntar` | Gera `supabase/subir_tudo.sql` para colar de uma vez no SQL Editor |

## Telas

| Caminho | Tela |
| --- | --- |
| `/` | Painel com calendário, pendências e próximos eventos (no celular: Agenda da equipe) |
| `/eventos/:id` | Detalhe do evento: troca, equipe, orientações, fantasias, transporte, avisos, financeiro, histórico |
| `/eventos/:id/pdf` | Folha operacional para salvar em PDF e mandar no WhatsApp (sem valores) |
| `/eventos`, `/profissionais`, `/personagens`, `/fantasias`, `/veiculos`, `/cadastros` | Cadastros com formulários de criar e editar |
| `/financeiro` | Totais, valores por evento, a pagar por profissional e despesas gerais (só gestão) |
| `/usuarios` | Usuários e acessos: perfil, ativo e ligação com o profissional |
| `/configuracoes` | Regras do sistema: feedback, avisos, prazo de troca, aprovação de despesas, supervisora |
