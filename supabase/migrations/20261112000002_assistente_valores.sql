-- A Assistente consulta valores operacionais, mas não grava nem aprova financeiro.
-- O perfil interno continua sendo `supervisora` para preservar dados existentes.

create policy fin_ler_assistente on evento_financeiro for select to authenticated
  using (meu_perfil() = 'supervisora');

create policy rec_ler_assistente on recebimentos for select to authenticated
  using (meu_perfil() = 'supervisora');

drop policy pag_ler on pagamentos_profissionais;
create policy pag_ler on pagamentos_profissionais for select to authenticated
  using (eh_gestao() or meu_perfil() = 'supervisora' or profissional_id = meu_profissional_id());

drop policy desp_ler on despesas;
create policy desp_ler on despesas for select to authenticated
  using (eh_gestao() or meu_perfil() = 'supervisora' or criado_por = auth.uid());

drop policy hist_ler on historico;
create policy hist_ler on historico for select to authenticated
  using (eh_gestao() or meu_perfil() = 'supervisora');
