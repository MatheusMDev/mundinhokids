# Task #63 — usuários excluídos e profissionais indisponíveis

Revisão em 05/11/2026. Escopo ampliado para todas as telas e todos os pontos de leitura/gravação relacionados a usuários e profissionais.

## Causa confirmada no código

A Edge Function `usuarios` removia `usuario_id` do profissional antes de excluir o login, mas preservava `ativo = true`. Isso fazia o cadastro continuar disponível. Se a exclusão do Auth falhasse, o vínculo também já estava perdido. Os seletores de escala, responsáveis por veículos, despesas e a RPC de substitutos não verificavam uniformemente a atividade do login.

Um cadastro sem login pode ser legítimo. Não é possível concluir, somente por `usuario_id is null`, quais profissionais antigos pertencem a acessos anteriormente excluídos. Eles precisam de revisão por ID; a migração não apaga nem desativa esses cadastros em massa.

## Regra aplicada

Para novos vínculos, o profissional precisa estar ativo e, quando tiver usuário vinculado, esse usuário também precisa estar ativo. A nova RPC `profissionais_disponiveis` retorna somente os IDs elegíveis dentro da visibilidade do perfil; não expõe dados dos logins dos colegas. O carregamento não libera seleções se essa consulta falhar.

Ao excluir um login, um trigger desativa e desvincula o profissional na mesma transação. Ao desvincular um login por edição, o cadastro antigo também é desativado. Profissionais criados originalmente sem login permanecem elegíveis. Desativar o login bloqueia a elegibilidade; reativá-lo não muda a escolha independente de desativar o próprio profissional.

O banco verifica novamente inserções, mudanças de responsável e reativações, incluindo aprovações de trocas pendentes. Histórico, pagamentos existentes, cancelamento de reservas e devoluções permanecem disponíveis.

## Mapa da revisão

| Ponto | Tratamento |
| --- | --- |
| `carregarBase` — leitura das 20 tabelas, configurações, histórico e RPCs | Preserva a base completa para histórico; carrega elegibilidade separadamente. |
| Escala — artista, produção e maquiagem | Filtra elegíveis e recusa seleção que deixou de ser válida. Trigger protege chamadas diretas. |
| Substitutos, pedido, resposta e aprovação de troca | RPC filtra elegíveis; formulário atualiza opções; trigger recusa avanço para substituto desligado. |
| Reservas no evento e em Veículos | Responsáveis elegíveis; vínculo antigo identificado; banco bloqueia nova reserva, reativação ou remarcação com pessoa indisponível. |
| Despesas gerais e do evento | Novos responsáveis elegíveis, mesmo se um profissional desligado ainda constar na escala histórica. Vínculo antigo fica identificado e pode ser preservado ao corrigir a despesa. |
| Profissionais e filtros | Ativos/elegíveis por padrão; filtro explícito de inativos ou todos para consulta. |
| Usuários e acessos — criação, edição e exclusão | Logins excluídos desaparecem pela exclusão física; inativos permanecem identificados para gestão. Novos vínculos não aceitam profissional inativo. Excluir Auth não deixa órfão ativo. |
| Sessão, papéis e permissões | Interface bloqueia usuário inativo; profissional inativo não acrescenta funções; sessão antiga perde permissões baseadas no profissional no banco. |
| Agenda/painel, Eventos, detalhe e PDF | Preservam quem já participou do evento; não removem nomes históricos. |
| Financeiro, valores da equipe e despesas existentes | Mantêm identificação e permitem cumprir obrigações já registradas. |
| Personagens, Fantasias, Cadastros e Configurações | Não oferecem seletores adicionais de usuários/profissionais; renderização conferida com a base que contém desligados. |
| Mais / conta | Revalida o acesso e mantém a navegação do perfil. |
| Dados em outras abas/aparelhos | Recarrega ao focar/retornar à aba e a cada 30 segundos quando visível. Gravação sempre protegida pelo banco. |

## Verificação local

- `npm.cmd run banco:verificar`: 41 testes aprovados, incluindo 16 novos cenários de ciclo de vida/elegibilidade.
- `npm.cmd run pessoas:verificar`: 28 verificações de carregamento e renderização aprovadas, incluindo as 13 telas principais, preservação de nomes históricos e compatibilidade com função ainda ausente.
- `npm.cmd run build`: compilação de produção.

Os testes usam Postgres embutido e dados fictícios; não alteram nem comprovam o estado do Supabase conectado. A validação da interface usa renderização dos componentes reais, sem simular autenticação, rede ou persistência reais.

## Aplicar no projeto existente

1. Executar **somente** `supabase/migrations/20261106000001_profissionais_disponiveis.sql` no SQL Editor do projeto existente, depois das migrações anteriores. Não usar o arquivo de instalação inicial nem o seed nesse projeto.
2. Publicar a versão atualizada da Edge Function `usuarios` (`supabase/functions/usuarios/index.ts`).
3. Publicar/reiniciar o frontend com os novos arquivos. Enquanto a nova RPC estiver ausente, o app carrega com uma regra temporária conservadora: só oferece profissionais ativos cujo login ativo seja comprovado pelos dados visíveis. Profissionais sem login ou com login oculto pela RLS não aparecem em novas seleções nesse modo; a migração libera o tratamento completo. Outros erros da RPC continuam sendo reportados.
4. Executar `supabase/auditar_profissionais.sql`, que é somente leitura, e revisar os candidatos antigos por ID, login e vínculos. Não presumir exclusão para todo profissional sem login.
5. Validar no projeto conectado: excluir/desativar um acesso de teste, retornar às telas, abrir seletores e tentar salvar uma seleção antiga. Conferir nomes nos históricos e concluir a task #64.

Sem acesso administrativo ao Supabase nesta sessão, a aplicação da migração, o deploy da Edge Function e a conferência dos registros reais permanecem pendentes. A task #63 não deve ser marcada como concluída até essa implantação e a validação no projeto conectado.
