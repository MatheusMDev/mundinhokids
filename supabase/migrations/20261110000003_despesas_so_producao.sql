-- =====================================================================
-- Mundinho Kids — só a produção lança despesas do evento
--
-- Antes, qualquer pessoa escalada no evento (inclusive artista e
-- maquiagem) podia lançar uma despesa nele. Agora lança:
--   * a gestão (Direção e Gerente), em qualquer evento ou sem evento;
--   * quem tem a função Produção (pelo perfil ou pelo cadastro do
--     profissional) e está escalado no evento, sempre em nome próprio.
-- Quem é artista e também produtor continua podendo lançar.
-- As despesas já lançadas não mudam.
-- =====================================================================

drop policy desp_criar on despesas;
create policy desp_criar on despesas for insert to authenticated
  with check (
    eh_gestao()
    or (
      criado_por = auth.uid()
      and evento_id is not null
      and tenho_funcao('produtor')
      and participa_do_evento(evento_id)
    )
  );
