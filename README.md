# Mundinho de Kids — gestão de eventos e equipes

Sistema web (computador e celular) em React + Vite, com banco no Supabase.

## Rodar

```bash
npm install
npm run dev
```

Abre em http://localhost:5173. Sem `.env.local`, o app entra em **modo demonstração**
com os dados dos mocks (outubro de 2026, "hoje" fixo em 15/10). Para ligar no Supabase,
copie `.env.example` para `.env.local` e preencha URL e chave.

## Banco de dados

- `banco/schema.sql` — estrutura original da V1 (22 tabelas, travas, permissões).
- `banco/ajustes_v1.sql` — correções para rodar logo depois do schema: nome do evento,
  quantidade para maquiar, previsão de volta da fantasia, função conferida na escala,
  quem sai da escala deixa de ver o evento, observações internas separadas, despesa
  sem aprovação forjada e funções fechadas para quem não fez login.
- `npm run banco:verificar` — carrega os dois arquivos num Postgres embutido (PGlite)
  e roda 16 verificações. Esperado: "16 testes passaram, 0 falharam".

## Telas

| Caminho | Tela |
| --- | --- |
| `/` | Painel com calendário, pendências e próximos eventos (no celular: Agenda da equipe) |
| `/eventos/:id` | Detalhe do evento: troca, equipe, orientações, fantasias, transporte, avisos, financeiro, histórico |
| `/eventos/:id/pdf` | Folha operacional para salvar em PDF e mandar no WhatsApp (sem valores) |
| `/eventos`, `/profissionais`, `/personagens`, `/fantasias`, `/veiculos`, `/financeiro`, `/cadastros` | Listas dos cadastros |

"Ver tela como" (menu lateral, ou no detalhe do evento no celular) alterna entre gerente
e supervisora para mostrar o que cada perfil enxerga.

## Organização

- `src/lib/tipos.ts` — tipos com os mesmos nomes das colunas do banco.
- `src/lib/consultas.ts` — tudo o que as telas calculam (pendências, conflitos, situação das fantasias).
- `src/lib/estado.tsx` — estado da demonstração e ações (aprovar ou recusar troca).
- `src/data/demo.ts` — dados de exemplo.
