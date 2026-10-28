-- Idade mínima (D-104): o app é para maiores de 18 anos.
--
-- No primeiro acesso, a pessoa declara ter 18 anos ou mais, e a declaração
-- fica no aceite dos termos, com data e versão. Menores não recebem convite
-- e participam pelo dízimo familiar do responsável, sem login nem ficha
-- própria (LGPD, art. 14: o app não trata dados de menores como usuários).

alter table public.aceites_termos
  add column declarou_maioridade boolean not null default false;

comment on column public.aceites_termos.declarou_maioridade is
  'A pessoa declarou ter 18 anos ou mais ao aceitar esta versão dos termos (D-104).';

-- A assinatura muda (um parâmetro a mais): a função antiga sai e a nova entra.
drop function public.concluir_cadastro(uuid, text, text, public.tipo_dizimo, jsonb, jsonb, text);

-- Passo 4: igual a antes, agora exigindo a declaração de maioridade.
create function public.concluir_cadastro(
  p_membro_id uuid,
  p_nome text,
  p_celular text,
  p_tipo_dizimo public.tipo_dizimo,
  p_familiares jsonb,
  p_campos_extras jsonb,
  p_versao_termos text,
  p_declarou_maioridade boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_versao_termos is null or length(trim(p_versao_termos)) = 0 then
    raise exception 'termos_obrigatorios' using errcode = '23502';
  end if;
  if p_declarou_maioridade is not true then
    raise exception 'maioridade_obrigatoria' using errcode = '23502';
  end if;

  update public.membros
     set nome = trim(p_nome),
         celular = trim(p_celular),
         tipo_dizimo = p_tipo_dizimo,
         familiares = coalesce(p_familiares, '[]'::jsonb),
         campos_extras = coalesce(p_campos_extras, '{}'::jsonb),
         status = 'ativo',
         cadastro_concluido_em = now()
   where id = p_membro_id
     and usuario_id = (select auth.uid())
     and status = 'convidado';

  if not found then
    raise exception 'cadastro_indisponivel' using errcode = 'P0002';
  end if;

  insert into public.aceites_termos (usuario_id, versao, declarou_maioridade)
  values ((select auth.uid()), trim(p_versao_termos), true)
  on conflict (usuario_id, versao) do nothing;
end;
$$;

revoke execute on function
  public.concluir_cadastro(uuid, text, text, public.tipo_dizimo, jsonb, jsonb, text, boolean)
  from public, anon;
grant execute on function
  public.concluir_cadastro(uuid, text, text, public.tipo_dizimo, jsonb, jsonb, text, boolean)
  to authenticated;
