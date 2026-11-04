-- =====================================================================
-- Mundinho Kids — telas escolhidas para cada login
--
-- Por padrão, cada login vê as telas do seu perfil (e das funções do
-- profissional ligado a ele). A Direção e a Gerente podem escolher outras
-- telas na edição do acesso. Vazio (null) = padrão do perfil.
-- Isso só controla o menu: os dados continuam protegidos pelas regras do banco.
-- =====================================================================

alter table usuarios add column telas text[];

alter table usuarios add constraint usuarios_telas_validas check (
  telas is null or telas <@ array[
    'painel', 'eventos', 'profissionais', 'personagens', 'fantasias', 'veiculos',
    'financeiro', 'cadastros', 'usuarios', 'configuracoes'
  ]::text[]
);
