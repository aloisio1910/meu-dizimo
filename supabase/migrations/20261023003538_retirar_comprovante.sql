-- =============================================================================
-- Retirar comprovante anexado por engano (D-083), sem apagar (RN-026).
--
-- O membro retira o comprovante enquanto o lançamento aguarda conferência ou
-- está em divergência. O registro e o arquivo continuam guardados: somem da
-- lista do membro e aparecem para a tesouraria como "retirado pelo membro".
-- =============================================================================

alter table public.comprovantes
  add column retirado_em timestamptz,
  add column retirado_por uuid references auth.users (id),
  add constraint comprovantes_retirada_completa check ((retirado_em is null) = (retirado_por is null));

create function public.retirar_comprovante(p_comprovante_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
begin
  select l.* into v_lancamento
  from public.comprovantes c
  join public.lancamentos l on l.id = c.lancamento_id
  where c.id = p_comprovante_id and c.retirado_em is null
  for update of c;

  if v_lancamento.id is null or not public.eh_minha_ficha(v_lancamento.membro_id) then
    raise exception 'comprovante_indisponivel' using errcode = '42501';
  end if;

  -- Durante a conferência e depois de confirmado, o comprovante faz parte da prova.
  if v_lancamento.status not in ('aguardando', 'divergencia') then
    raise exception 'comprovante_travado' using errcode = '42501';
  end if;

  update public.comprovantes
     set retirado_em = now(),
         retirado_por = (select auth.uid())
   where id = p_comprovante_id;
end;
$$;

revoke execute on function public.retirar_comprovante(uuid) from public, anon;
grant execute on function public.retirar_comprovante(uuid) to authenticated;
