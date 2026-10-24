-- Regras de status das campanhas (P-02).
--
-- D-088: o Pastor de Governo reabre uma campanha encerrada.
-- D-089: a campanha encerra sozinha no dia seguinte à data de fim.
--
-- Caminhos permitidos para quem usa o app:
--   rascunho  -> ativa      publicar
--   ativa     -> encerrada  encerrar (a permanente "Oferta" nunca encerra)
--   encerrada -> ativa      reabrir
-- Uma campanha publicada não volta a rascunho: membros já podem ter
-- ofertado nela. Só fica ativa se a data de fim não passou.

-- Data de hoje no Brasil. O banco roda em UTC; sem isto, entre 21h e
-- meia-noite o "hoje" seria o dia seguinte. O fuso por igreja entra na
-- Fase 2, com outros países.
create function public.hoje_na_igreja()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function public.proteger_campanha()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.permanente then
      raise exception 'A campanha permanente é criada pelo sistema' using errcode = '42501';
    end if;
    -- Toda campanha nova começa como rascunho e é publicada depois.
    new.status := 'rascunho';
    return new;
  end if;

  if new.igreja_id <> old.igreja_id or new.permanente <> old.permanente then
    raise exception 'Igreja e tipo da campanha não podem ser alterados' using errcode = '42501';
  end if;

  if new.status <> old.status and not (
       (old.status = 'rascunho' and new.status = 'ativa')
       or (old.status = 'ativa' and new.status = 'encerrada')
       or (old.status = 'encerrada' and new.status = 'ativa')
     ) then
    raise exception 'status_invalido' using errcode = '42501';
  end if;

  if new.status = 'ativa' and new.fim is not null and new.fim < public.hoje_na_igreja() then
    raise exception 'fim_no_passado' using errcode = '22023';
  end if;

  return new;
end;
$$;

-- Rotina automática (pg_cron, todo dia logo depois da meia-noite no Brasil):
-- encerra as campanhas cuja data de fim já passou.
create function public.encerrar_campanhas_vencidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantidade integer;
begin
  update public.campanhas
     set status = 'encerrada'
   where status = 'ativa'
     and not permanente
     and fim is not null
     and fim < public.hoje_na_igreja();

  get diagnostics v_quantidade = row_count;
  return v_quantidade;
end;
$$;

revoke execute on function public.encerrar_campanhas_vencidas() from public, anon, authenticated;

-- 03:05 UTC = 00:05 em Brasília.
select cron.schedule(
  'encerrar-campanhas-vencidas',
  '5 3 * * *',
  $$ select public.encerrar_campanhas_vencidas(); $$
);
