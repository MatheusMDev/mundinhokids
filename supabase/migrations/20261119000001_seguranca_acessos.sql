-- =====================================================================
-- Segurança dos acessos (revisão de 2026-11-19, sistema publicado)
--
-- 1. notificar_gestao e gerar_notificacoes_gestao podiam ser chamadas por
--    qualquer pessoa pela API (até sem login): dava para mandar qualquer texto
--    como notificação para a Direção. Elas só são usadas por gatilhos (que rodam
--    como dono) e pela Edge Function enviar-notificacoes (service_role).
-- 2. Algumas tabelas liam com "using (true)": qualquer login, mesmo sem perfil
--    no sistema, lia locais, veículos, reservas, fantasias, personagens e
--    configurações. Agora só quem tem perfil ativo (meu_perfil() não nulo).
-- 3. cancelar_evento(uuid, text) não é mais usada: o app chama
--    cancelar_evento_com_multa.
-- =====================================================================

-- 1. Funções internas fora da API
revoke all on function public.notificar_gestao(text, uuid, text) from public, anon, authenticated;
revoke all on function public.gerar_notificacoes_gestao() from public, anon, authenticated;
grant execute on function public.notificar_gestao(text, uuid, text) to service_role;
grant execute on function public.gerar_notificacoes_gestao() to service_role;

-- Funções da própria conta já recusam quem não tem login; tirar do anon por garantia
revoke execute on function public.atualizar_minha_conta(text, text, text) from public, anon;
revoke execute on function public.atualizar_foto_minha_conta(text) from public, anon;

-- 2. Leitura só para quem tem perfil ativo
alter policy cfg_ler  on configuracoes            using (meu_perfil() is not null);
alter policy fan_ler  on fantasias                using (meu_perfil() is not null);
alter policy loc_ler  on locais                   using (meu_perfil() is not null);
alter policy pers_ler on personagens              using (meu_perfil() is not null);
alter policy pp_ler   on profissional_personagens using (meu_perfil() is not null);
alter policy res_ler  on reservas_veiculo         using (meu_perfil() is not null);
alter policy vei_ler  on veiculos                 using (meu_perfil() is not null);

-- 3. Função antiga de cancelamento
drop function if exists public.cancelar_evento(uuid, text);
