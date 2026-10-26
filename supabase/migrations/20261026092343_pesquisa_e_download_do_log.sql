-- Pesquisa e download do Log da igreja (P-04, D-095).
--
-- 1. registros_do_log ganha o termo de pesquisa: nome de pessoa (quem fez ou
--    de quem é o registro), textos do registro (conta, campanha, campo,
--    motivo) e valor ("150" ou "150,00" acham R$ 150,00). Sem acento e sem
--    maiúscula.
-- 2. registrar_download_do_log grava no próprio log quem baixou, o período
--    e quantos registros: quem acessa dados pessoais em massa deixa rastro
--    (LGPD). Só o Pastor de Governo da igreja (ou o Admin Master) chama.

create extension if not exists unaccent with schema extensions;

-- Forma simplificada para comparar: sem acento e em minúsculas.
create function public.simplificar(p_texto text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(extensions.unaccent(coalesce(p_texto, '')));
$$;

-- A assinatura muda (novo parâmetro): a versão anterior sai.
drop function public.registros_do_log(uuid, timestamptz, timestamptz, text[], text, integer, integer);

create function public.registros_do_log(
  p_igreja_id uuid,
  p_desde timestamptz,
  p_antes_de timestamptz,
  p_tabelas text[] default null,
  p_quem text default null,          -- id do login, 'sistema' ou nulo (todos)
  p_pagina integer default 0,
  p_tamanho integer default 20,
  p_busca text default null
)
returns table (
  id bigint,
  usuario_id uuid,
  perfil text,
  acao text,
  tabela text,
  registro_id uuid,
  antes jsonb,
  depois jsonb,
  motivo text,
  criado_em timestamptz,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  with entrada as (
    select trim(coalesce(p_busca, '')) as b
  ),
  termo as (
    select
      nullif(public.simplificar(b), '') as texto,
      -- Valor em reais, do jeito brasileiro, vira centavos para achar valores:
      -- "150" e "150,00" = 15000; "1.500" e "1.500,50" usam o ponto de milhar.
      (round(case
        when b ~ '^\d{1,3}(\.\d{3})*,\d{1,2}$' or b ~ '^\d+,\d{1,2}$' then replace(replace(b, '.', ''), ',', '.')::numeric
        when b ~ '^\d{1,3}(\.\d{3})+$' then replace(b, '.', '')::numeric
        when b ~ '^\d+(\.\d{1,2})?$' then b::numeric
      end * 100))::bigint as centavos
    from entrada
  ),
  pessoas as (
    select m.id, m.usuario_id
    from public.membros m, termo
    where m.igreja_id = p_igreja_id
      and termo.texto is not null
      and public.simplificar(m.nome) like '%' || termo.texto || '%'
  ),
  relevantes as (
    select a.*
    from public.auditoria a, termo
    where a.igreja_id = p_igreja_id
      and a.criado_em >= p_desde
      and a.criado_em < p_antes_de
      and (p_tabelas is null or a.tabela = any (p_tabelas))
      and (
        p_quem is null
        or (p_quem = 'sistema' and a.usuario_id is null)
        or a.usuario_id::text = p_quem
      )
      and not (
        a.acao = 'update'
        and (a.antes - 'atualizado_em' - 'em_conferencia_desde' - 'proximo_numero_dizimista')
          = (a.depois - 'atualizado_em' - 'em_conferencia_desde' - 'proximo_numero_dizimista')
      )
      and (
        termo.texto is null
        -- Termo que é um valor ("150,00") compara só valores: procurar o texto
        -- "150" acharia também R$ 1.500,50 (150050 centavos).
        or (termo.centavos is not null and termo.centavos in (
              (a.antes ->> 'valor_informado_centavos')::bigint, (a.depois ->> 'valor_informado_centavos')::bigint,
              (a.antes ->> 'valor_conferido_centavos')::bigint, (a.depois ->> 'valor_conferido_centavos')::bigint))
        or (termo.centavos is null and (
              a.usuario_id in (select p.usuario_id from pessoas p where p.usuario_id is not null)
              or (coalesce(a.depois, a.antes) ->> 'membro_id')::uuid in (select p.id from pessoas p)
              or (a.tabela = 'membros' and a.registro_id in (select p.id from pessoas p))
              or public.simplificar(coalesce(a.antes::text, '') || ' ' || coalesce(a.depois::text, '') || ' ' || coalesce(a.motivo, ''))
                   like '%' || termo.texto || '%'))
      )
  )
  select r.id, r.usuario_id, r.perfil, r.acao, r.tabela, r.registro_id, r.antes, r.depois, r.motivo, r.criado_em,
         count(*) over () as total
  from relevantes r
  order by r.criado_em desc, r.id desc
  -- Até 1.000 por pedido: a tela usa 20; o download, páginas maiores.
  limit least(greatest(p_tamanho, 1), 1000)
  offset greatest(p_pagina, 0) * least(greatest(p_tamanho, 1), 1000);
$$;

revoke execute on function public.registros_do_log(uuid, timestamptz, timestamptz, text[], text, integer, integer, text)
  from public, anon;
grant execute on function public.registros_do_log(uuid, timestamptz, timestamptz, text[], text, integer, integer, text)
  to authenticated;


create function public.registrar_download_do_log(
  p_igreja_id uuid,
  p_desde timestamptz,
  p_antes_de timestamptz,
  p_quantidade integer,
  p_busca text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_master boolean := public.eh_admin_master();
begin
  if not (v_admin_master or public.eh_administrador(p_igreja_id)) then
    raise exception 'so_o_pastor_baixa_o_log' using errcode = '42501';
  end if;

  insert into public.auditoria (igreja_id, usuario_id, perfil, acao, tabela, depois)
  values (
    p_igreja_id,
    (select auth.uid()),
    case when v_admin_master then 'admin_master' else 'administrador' end,
    'download',
    'auditoria',
    jsonb_build_object('desde', p_desde, 'antes_de', p_antes_de, 'quantidade', p_quantidade, 'busca', p_busca)
  );
end;
$$;

revoke execute on function public.registrar_download_do_log(uuid, timestamptz, timestamptz, integer, text) from public, anon;
grant execute on function public.registrar_download_do_log(uuid, timestamptz, timestamptz, integer, text) to authenticated;
