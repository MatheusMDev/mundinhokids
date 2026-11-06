# #57 — novo Financeiro

Tela reorganizada seguindo os cartões, filtros, bordas, cores e navegação das telas atuais.

## Entrega

- Quatro indicadores: contratado, recebido, equipe a pagar e despesas.
- Seções Por evento, Equipe a pagar e Despesas gerais, com endereço compartilhável e filtros/páginas independentes.
- Cartões de eventos com contratado, recebido, situação, progresso do recebimento, valor a receber, equipe pendente e despesas. Link para o evento e retorno ao Financeiro preservando os filtros e a página.
- Pendências agrupadas por profissional, inclusive quando o profissional está excluído/desativado, preservando as obrigações existentes. Eventos detalhados por um controle expansível.
- Despesas gerais/insumos em cartões editáveis, com responsável, valor e situação da aprovação. Lançamento acessível pelo topo da tela.
- Busca por evento/aniversariante, profissional/evento e despesa/responsável. Filtros de mês, recebimento, tipo e aprovação. Paginação de seis cartões.
- Estados vazios com ação de limpar filtros, skeleton específico do Financeiro e erro contextual com Tentar de novo.
- Proteção de valores por perfil mantida. A tela não oferece novas permissões nem altera políticas de banco.

## Cálculos

O consolidado foi extraído para `src/lib/financeiro.ts`. Contratado, recebido, situação por evento, despesas e agrupamento das pendências mantêm as regras da versão anterior.

Foi corrigida uma inconsistência do indicador Equipe a pagar: agora soma exatamente os pagamentos pendentes exibidos na seção da equipe, inclusive obrigações de eventos cancelados que já apareciam nessa lista. Nenhum lançamento ou valor gravado foi alterado.

## Validação

- `npm.cmd run financeiro:verificar`: 9 testes de cálculos, agrupamento, pendências, preservação de histórico, ausência de mutação e estado vazio aprovados.
- `npm.cmd run pessoas:verificar`: 34 verificações existentes aprovadas, incluindo renderização de todas as telas e uso de profissionais históricos no Financeiro.
- `npm.cmd run build`: aprovado.
- Chrome após a revisão mobile: 41 verificações aprovadas; nenhum erro JavaScript da aplicação.
- Três seções conferidas em 320, 375, 768, 1024 e 1280 px, sem rolagem horizontal; barra inferior disponível nos tamanhos compactos.
- Conferidos busca, paginação, retorno do evento mantendo parâmetros, filtro de recebimento parcial, expansão dos eventos de cada profissional, filtro de aprovação, edição e lançamento de despesas com valores decimais, limpar filtros, vazio, carregamento, erro e recuperação.
- Acesso permitido para Gerência/Direção e bloqueado para Supervisão, Produção, Artista, Maquiagem e Fantasias.

As ações no Chrome usaram o frontend compilado com cadastros e respostas do Supabase simulados; nenhum dado real foi alterado. Evidências locais: `.mobile-check/financeiro57-resultado.json` e `.mobile-check/financeiro57-*.png`.

## Revisão mobile solicitada pelo usuário

A primeira versão ocupava quase toda a primeira tela com cabeçalho, indicadores e filtros. O painel foi compactado no celular:

- Título e ação de lançar despesa na mesma linha, com alvo de toque de 44 px.
- Indicadores agrupados num único painel 2 × 2, sem ícones decorativos e com textos de apoio mais curtos.
- Abas Eventos, Equipe e Despesas com contadores legíveis na mesma linha.
- Busca direta e botão Filtros. Seletores secundários expansíveis em largura completa, com indicador de quantos filtros estão ativos, evitando rótulos cortados.
- Título e contagem da seção mais compactos. Nas três seções, o início da lista fica antes de 520 px nas larguras de 320 e 375 px.
- Abrir/fechar filtros mantém a seleção; busca, paginação, edição/lançamento, erro/recuperação e permissões foram conferidos novamente.

## Aplicação

Atualizar/publicar o frontend. Esta entrega não adiciona RPCs, tabelas, colunas ou migrações; usa os serviços existentes para lançar e editar despesas.
