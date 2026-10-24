-- País, idioma e moeda da igreja são da plataforma (D-092).
--
-- O Pastor de Governo ajusta dados, contato e personalização (P-03), mas
-- não país, idioma e moeda: trocar a moeda no meio do caminho misturaria
-- valores nos relatórios, e outros países pedem termos e meios de
-- pagamento próprios (seção 17). Quem altera é o Admin Master.
-- Igual à versão de 20261021213240, com o bloco novo no fim.

create or replace function public.proteger_campos_igreja()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.id <> old.id or new.proximo_numero_dizimista <> old.proximo_numero_dizimista then
    raise exception 'Campos internos da igreja não podem ser alterados' using errcode = '42501';
  end if;

  if (new.status is distinct from old.status or new.faixa_plano is distinct from old.faixa_plano)
     and not public.eh_admin_master() then
    raise exception 'Só o Admin Master altera status e plano da igreja' using errcode = '42501';
  end if;

  if (new.pais, new.idioma, new.moeda) is distinct from (old.pais, old.idioma, old.moeda)
     and not public.eh_admin_master() then
    raise exception 'so_admin_master_altera_pais' using errcode = '42501';
  end if;

  return new;
end;
$$;
