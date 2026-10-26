-- Páginas numeradas no Log da igreja (P-04).
--
-- Para mostrar "página 3 de 12", o banco precisa contar os registros. A
-- contagem ignora as atualizações que só mexem em controles internos (ex.:
-- o "ainda conferindo" a cada 2 minutos, em em_conferencia_desde), que
-- ficam gravadas mas não interessam a quem lê o log.
--
-- Roda com as permissões de quem chama: a RLS da auditoria continua
-- valendo (só o Pastor de Governo da igreja e o Admin Master leem).

create function public.registros_do_log(
  p_igreja_id uuid,
  p_desde timestamptz,
  p_antes_de timestamptz,
  p_tabelas text[] default null,
  p_quem text default null,          -- id do login, 'sistema' ou nulo (todos)
  p_pagina integer default 0,
  p_tamanho integer default 20
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
  with relevantes as (
    select a.*
    from public.auditoria a
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
  )
  select r.id, r.usuario_id, r.perfil, r.acao, r.tabela, r.registro_id, r.antes, r.depois, r.motivo, r.criado_em,
         count(*) over () as total
  from relevantes r
  order by r.criado_em desc, r.id desc
  limit least(greatest(p_tamanho, 1), 100)
  offset greatest(p_pagina, 0) * least(greatest(p_tamanho, 1), 100);
$$;

revoke execute on function public.registros_do_log(uuid, timestamptz, timestamptz, text[], text, integer, integer)
  from public, anon;
grant execute on function public.registros_do_log(uuid, timestamptz, timestamptz, text[], text, integer, integer)
  to authenticated;
