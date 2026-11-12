# Validação #64 — exclusões na escala

Resultado: **42 cenários de navegador aprovados**, sem erro JavaScript da aplicação, complementados por **52 testes de banco** e **34 verificações de interface/carregamento**, todos aprovados. Compilação de produção aprovada.

## Matriz de execução

Cada cenário abaixo foi executado para Direção, Gerência e Assistente, nas larguras desktop de 1280 px e mobile de 375 px: 7 grupos × 3 perfis × 2 larguras = 42 resultados aprovados.

| Cenário | Resultado observado |
| --- | --- |
| Abrir a escala contendo profissionais de teste excluídos/desativados | Profissional excluído, usuário excluído, ambos excluídos e login desativado ausentes; artista elegível presente. |
| Selecionar artista, excluí-lo com o diálogo aberto e tentar salvar | Envio recusado, diálogo mantido aberto e mensagem “Este profissional não está mais disponível” visível. |
| Retornar à aba, fechar/reabrir e recarregar a página após excluir | A opção desaparece e não volta a aparecer. |
| Excluir usuário com profissional vinculado e excluir ambos | A pessoa deixa de aparecer na seleção nos dois casos. |
| Escalar pessoas elegíveis nas três funções | Artista, produção e maquiagem adicionados com sucesso na simulação; nomes aparecem na equipe. |
| Selecionar substituto e depois desativar seu login | Lista de substitutos atualizada; pessoa deixa de ser oferecida. |
| Excluir profissional já escalado e abrir o PDF | Nome preservado no detalhe e no PDF; pagamento existente permanece vinculado. |

As capturas do aviso de seleção antiga e do histórico/PDF estão em `.mobile-check/task64-*.png`. O resumo estruturado da execução está em `.mobile-check/task64-resultado.json`. A simulação pode ser repetida por `.mobile-check/validar-task64.mjs`, com Chrome de teste na porta 9223 e preview local na porta 5174.

## Método e limites

O Chrome executou o frontend real compilado, com toques/cliques e eventos de formulário. As chamadas ao Supabase foram interceptadas com cadastros fictícios, mutações persistidas somente no armazenamento da sessão do navegador de teste e respostas de erro simuladas. Nenhum registro real foi excluído ou alterado.

As regras SQL foram testadas separadamente em Postgres embutido/PGlite, incluindo recusa de seleções antigas e aprovação de troca após desativação, RLS, exclusão transacional de login, preservação de pagamentos e permissões para excluir profissional. A simulação de navegador não substitui uma inspeção administrativa do Supabase real.

O usuário confirmou nesta conversa que aplicou a migração `20261106000001_profissionais_disponiveis.sql` e publicou a função de usuários atualizada no Supabase usado pelo site. Essa implantação foi confirmada pelo usuário, sem inspeção administrativa independente nesta sessão.

## Situação dos cartões

- #64: cenários de teste concluídos, com evidências da simulação e dos testes automatizados.
- #63: implementação validada e implantação confirmada pelo usuário. A auditoria foi executada pelo usuário e retornou 12 cadastros para revisão. Os dois Matheus permanecem sem login, um ativo e outro inativo, ambos com uma escala e um pagamento. É necessário confirmar a exclusão lógica (`excluido_em`) e qual cadastro deve ser mantido antes de regularizar os registros reais. O cartão permanece aberto para esse caso.

## Auditoria real fornecida pelo usuário

- `7206b688-d741-4cef-9dc5-023c737b4f73` — `Matheus  Miranda`, ativo, sem login, uma escala e um pagamento.
- `a18e2007-5d9f-4b0f-9409-d4561170204b` — `Matheus Miranda`, inativo, sem login, uma escala e um pagamento.
- Nove dos demais IDs retornados correspondem aos cadastros criados em `supabase/seed.sql`; não devem ser classificados como usuários excluídos apenas por estarem sem login. O registro `[teste] Marina Alves` também exige revisão conforme seu uso.
- A primeira consulta não retornava `excluido_em`. Ela foi ajustada para mostrar esse campo quando existir e não apontar como possível duplicado um registro já excluído logicamente. Permanecer fisicamente no banco para preservar histórico não significa continuar aparecendo nas novas seleções.
