-- Contas e Pix da igreja (P-03, D-091).
--
-- 1. Trocar a conta principal numa só operação: o índice "uma principal por
--    igreja" impede marcar a nova antes de desmarcar a antiga, e fazer em
--    dois pedidos poderia deixar a igreja sem principal (o dízimo ficaria
--    sem conta de destino).
-- 2. Uma conta usada por campanha em rascunho ou ativa não é desativada:
--    as ofertas iriam para uma conta inativa. Primeiro troca-se a conta da
--    campanha. A conta principal já não pode ser desativada
--    (contas_principal_ativa).
-- O log de cada mudança já é gravado pela trigger de auditoria (RN-040).

-- Roda com as permissões de quem chama: a RLS de contas só deixa o Pastor
-- de Governo da igreja alterar.
create function public.definir_conta_principal(p_conta_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_igreja_id uuid;
begin
  select c.igreja_id into v_igreja_id
  from public.contas c
  where c.id = p_conta_id and c.ativa;

  if v_igreja_id is null or not (public.eh_administrador(v_igreja_id) or public.eh_admin_master()) then
    raise exception 'conta_indisponivel' using errcode = '42501';
  end if;

  -- O índice único é conferido linha a linha: desmarca a antiga antes de
  -- marcar a nova. A função roda numa só transação, então ou as duas
  -- mudanças acontecem, ou nenhuma.
  update public.contas
     set principal = false
   where igreja_id = v_igreja_id and principal and id <> p_conta_id;

  update public.contas
     set principal = true
   where id = p_conta_id;
end;
$$;

revoke execute on function public.definir_conta_principal(uuid) from public, anon;
grant execute on function public.definir_conta_principal(uuid) to authenticated;

create function public.proteger_conta_em_uso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.ativa and not new.ativa and exists (
    select 1 from public.campanhas c
    where c.conta_id = new.id and c.status in ('rascunho', 'ativa')
  ) then
    raise exception 'conta_em_uso' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger contas_b_em_uso
  before update on public.contas
  for each row execute function public.proteger_conta_em_uso();
