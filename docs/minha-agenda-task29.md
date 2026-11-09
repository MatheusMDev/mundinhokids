# Minha agenda — cartão #29

A aba Agenda da equipe abre agora a página **Minha agenda**, em celular e desktop. O painel de gestão mantém o calendário atual. Não é necessária uma nova migração para esta tela.

- **Próximos:** compromissos futuros ou em andamento com escala ativa, em ordem de início. Cada cartão mostra data, horário, local, função, personagem e valor próprio, quando informado.
- **Histórico:** eventos encerrados, realizados e cancelados, preservando a identificação de escalas antigas. Uma escala desativada para um evento futuro não aparece como compromisso.
- **Valores:** pagamentos próprios por evento, com pendentes primeiro, indicação de recebimento e sua data. Os totais incluem todos os registros próprios disponíveis, inclusive obrigações de eventos cancelados ou sem evento visível.
- As listas têm paginação. A seção escolhida permanece no endereço e o retorno do detalhe mantém a seleção.
- Cadastros sem vínculo, listas vazias e valores ainda não informados têm mensagens específicas.

Os dados continuam sendo carregados pelas consultas existentes, protegidas pelas políticas do banco. A consolidação também filtra explicitamente pelo profissional ligado à sessão, inclusive em contas com múltiplas funções. Não consulta valores contratados nem dados financeiros de outras pessoas.

## Validação local

- `npm.cmd run agenda:verificar`: 8 testes de consolidação, privacidade, escalas antigas, ordenação, eventos em andamento, centavos, troca de profissional e ausência de vínculo.
- `npm.cmd run pessoas:verificar`: 35 verificações aprovadas.
- `npm.cmd run financeiro:verificar`: 9 testes aprovados.
- `npm.cmd run build`: aprovado.
- `node scripts/browser/verificar-agenda.mjs`: 27 cenários em Chrome, com perfis simulados de Júlia (artista) e Bruno (produção), larguras de 320, 375, 768 e 1280 px. Inclui abas, totais, campos da escala, isolamento de dados alheios, retorno do evento, paginação, vazios e vínculo ausente. Barra inferior visível e sem rolagem horizontal nas larguras móveis.

Para repetir os testes de navegador, configurar `.env.local` com a URL pública do projeto, executar o build e iniciar `npm.cmd run preview -- --host 127.0.0.1 --port 5174`. Iniciar Chrome com depuração remota na porta 9223 e uma aba aberta. O script intercepta as chamadas ao Supabase e usa sessão/dados fictícios. Gera imagens e resultado em `.mobile-check/`, pasta ignorada pelo Git.

Nenhum login ou registro real foi alterado. Ainda falta validar com as contas reais de Júlia e Bruno no ambiente publicado; o último item do checklist do Trello permanece pendente por esse motivo.
