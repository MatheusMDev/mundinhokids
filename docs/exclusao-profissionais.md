# Botão Excluir profissional

Na tela **Profissionais**, Gerência e Direção veem **Excluir profissional** em cada cartão. O botão também aparece nos filtros **Inativos / sem acesso ativo** e **Todos**, permitindo remover cadastros antigos ou duplicados. Outros perfis não veem a ação.

A confirmação identifica a pessoa e explica o resultado: o cadastro sai da listagem e das novas seleções; escalas, pagamentos e outros registros históricos continuam identificados. O login é mantido e desvinculado. Para excluir também o acesso, usar **Usuários e acessos**.

A exclusão é lógica: `excluido_em` registra quando ocorreu, o profissional fica inativo e perde o vínculo com o login. Isso permite excluir mesmo quem já tem histórico sem apagar escalas ou pagamentos. Um excluído não reaparece nem no filtro Todos e não pode ser reativado alterando apenas `ativo`.

## Permissões

A RPC `excluir_profissional` verifica a sessão e exige perfil ativo de Gerência ou Direção. Anônimos, artistas, assistentes e gerentes desativados são recusados. O trigger também recusa tentativas de marcar a exclusão por update direto de outro perfil. Somente Direção pode excluir um profissional ainda vinculado a um acesso de Direção.

## Ativação no projeto existente

1. Executar no SQL Editor a migração `supabase/migrations/20261106000002_excluir_profissional.sql`, depois das migrações existentes. Essa migração adiciona a coluna e a RPC; não usar o seed nem o instalador inicial.
2. Para as proteções completas de novas escalas, reservas, despesas e trocas da task #63, aplicar também `20261106000001_profissionais_disponiveis.sql` caso ainda esteja pendente.
3. Atualizar/publicar o frontend. O botão usa diretamente a sessão do usuário com a RPC; esta ação não exige uma nova versão da Edge Function `usuarios`.
4. Conferir com um cadastro de teste: excluir, verificar desaparecimento da lista, preservação do login e consulta do histórico. Sem a nova RPC, somente a tentativa de excluir apresenta uma mensagem informando que a ação ainda precisa ser ativada; o carregamento do app continua funcionando.

## Verificação local

- `npm.cmd run banco:verificar`: 52 testes aprovados, incluindo 11 novos cenários de exclusão, permissões, preservação de login/histórico, reativação e seleção antiga.
- `npm.cmd run pessoas:verificar`: 34 verificações aprovadas, incluindo visibilidade do botão, confirmação, exclusão da listagem e tratamento de função ausente.
- `npm.cmd run build`: aprovado.

Nenhum profissional real foi excluído nesta sessão. A aplicação da migração e a validação no Supabase conectado permanecem pendentes por falta de acesso administrativo.
