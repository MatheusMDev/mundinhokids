-- =====================================================================
-- Mundinho Kids — um login pode ter mais de uma função
--
-- Antes, o que só a produção ou só quem cuida das fantasias pode fazer olhava
-- o perfil do login. Agora vale também a função do profissional ligado a ele:
-- um login de perfil Artista cujo profissional tem a função Produção pode
-- reservar veículo; com a função Fantasias, confere e edita fantasias.
-- (Ver eventos e escala já dependia de estar escalado no evento.)
-- =====================================================================

-- O login tem a função pelo perfil ou pelo cadastro do profissional ligado a ele
create function tenho_funcao(p_funcao funcao_profissional) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(meu_perfil()::text = p_funcao::text, false)
      or exists (
        select 1
        from profissionais pr
        join usuarios u on u.id = pr.usuario_id and u.ativo
        where pr.usuario_id = auth.uid() and pr.ativo and p_funcao = any (pr.funcoes)
      )
$$;

revoke execute on function tenho_funcao(funcao_profissional) from public, anon;
grant execute on function tenho_funcao(funcao_profissional) to authenticated;

-- Fantasias: quem tem a função fantasias edita a situação e confere a devolução
drop policy fan_alterar on fantasias;
create policy fan_alterar on fantasias for update to authenticated
  using (eh_operacao() or tenho_funcao('fantasias')) with check (eh_operacao() or tenho_funcao('fantasias'));

drop policy ev_ler on eventos;
create policy ev_ler on eventos for select to authenticated
  using (eh_operacao() or tenho_funcao('fantasias') or participa_do_evento(id));

drop policy esc_ler on evento_escala;
create policy esc_ler on evento_escala for select to authenticated
  using (eh_operacao() or tenho_funcao('fantasias') or participa_do_evento(evento_id));

drop policy conf_ler on conferencias_fantasia;
create policy conf_ler on conferencias_fantasia for select to authenticated
  using (eh_operacao() or tenho_funcao('fantasias'));
drop policy conf_criar on conferencias_fantasia;
create policy conf_criar on conferencias_fantasia for insert to authenticated
  with check (eh_operacao() or tenho_funcao('fantasias'));
drop policy conf_alterar on conferencias_fantasia;
create policy conf_alterar on conferencias_fantasia for update to authenticated
  using (eh_operacao() or tenho_funcao('fantasias')) with check (eh_operacao() or tenho_funcao('fantasias'));

-- Veículos: quem tem a função produção reserva em nome próprio
drop policy res_criar on reservas_veiculo;
create policy res_criar on reservas_veiculo for insert to authenticated
  with check (eh_operacao()
              or (tenho_funcao('produtor') and responsavel_id = meu_profissional_id()
                  and (evento_id is null or participa_do_evento(evento_id))));
