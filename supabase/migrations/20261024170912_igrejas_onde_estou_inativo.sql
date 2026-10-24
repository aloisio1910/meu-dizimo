-- Quem foi inativado não vê a própria ficha (RLS, RN-035). Sem isto, o app
-- só sabia que a pessoa "não tem igreja" e mostrava a mensagem de convite
-- vencido. Esta função devolve à própria pessoa apenas os nomes das igrejas
-- em que a ficha dela está inativa, para o app explicar o motivo.

create function public.igrejas_onde_estou_inativo()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select i.nome
  from public.membros m
  join public.igrejas i on i.id = m.igreja_id
  where m.usuario_id = (select auth.uid())
    and m.status = 'inativo'
  order by i.nome;
$$;

revoke execute on function public.igrejas_onde_estou_inativo() from public, anon;
grant execute on function public.igrejas_onde_estou_inativo() to authenticated;
