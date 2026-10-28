-- Mensagens aos membros e avisos da plataforma (D-102).
--
-- O Pastor de Governo e os tesoureiros mandam uma mensagem (ex.: um
-- versículo sobre fidelidade) para todos os membros ativos ou para um grupo
-- do cadastro (ex.: Célula = Norte), nunca escolhidos pelo que deram ou
-- deixaram de dar. Até 1 por semana por igreja; o membro pode desligar.
-- O Admin Master manda avisos da plataforma (ex.: manutenção programada)
-- para todas as igrejas ou uma só, sem limite e sem desligar.
-- A mensagem chega como aviso (aba Avisos) e push, pelo mesmo caminho do
-- D-096. Agendar o envio fica para o pacote premium (D-103).


-- -----------------------------------------------------------------------------
-- 1. Tabela mensagens (a 14ª): o que foi enviado, por quem e para quem
-- -----------------------------------------------------------------------------

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  -- Vazio: aviso da plataforma para todas as igrejas.
  igreja_id uuid references public.igrejas (id),
  origem text not null check (origem in ('igreja', 'plataforma')),
  autor_id uuid not null references auth.users (id),
  autor_nome text not null,
  texto text not null check (length(texto) between 3 and 500),
  -- Grupo do cadastro (chave do campo e valor); vazio = todos.
  grupo_campo text,
  grupo_valor text,
  destinatarios integer not null default 0,
  criado_em timestamptz not null default now(),
  check (origem = 'plataforma' or igreja_id is not null),
  check ((grupo_campo is null) = (grupo_valor is null))
);

create index mensagens_da_igreja on public.mensagens (igreja_id, criado_em desc);

comment on table public.mensagens is 'Mensagens da igreja aos membros e avisos da plataforma (D-102); cada envio vira avisos em notificacoes.';

create trigger mensagens_auditoria
  after insert or update or delete on public.mensagens
  for each row execute function public.registrar_auditoria();

alter table public.mensagens enable row level security;

-- A tesouraria vê as mensagens da própria igreja (o histórico na tela).
create policy mensagens_select on public.mensagens
  for select to authenticated
  using (igreja_id is not null and public.eh_tesouraria(igreja_id));

revoke all on public.mensagens from anon;
revoke insert, update, delete, truncate on public.mensagens from authenticated;
grant select on public.mensagens to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Os avisos novos
-- -----------------------------------------------------------------------------

alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in (
  'lancamento_confirmado', 'divergencia_registrada', 'lancamento_reaberto', 'nova_campanha',
  'novo_lancamento', 'novo_comprovante', 'divergencia_contestada', 'pix_alterado', 'email_alterado',
  'mensagem_da_igreja', 'aviso_da_plataforma'
));

-- A mensagem da igreja pode ser desligada; o aviso da plataforma, não.
create or replace function public.aviso_pode_desligar(p_tipo text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_tipo in ('nova_campanha', 'novo_lancamento', 'novo_comprovante', 'mensagem_da_igreja');
$$;

alter table public.membros drop constraint membros_avisos_desligados_check;
alter table public.membros add constraint membros_avisos_desligados_check
  check (avisos_desligados <@ array['nova_campanha', 'novo_lancamento', 'novo_comprovante', 'mensagem_da_igreja']);


-- -----------------------------------------------------------------------------
-- 3. Quem recebe
-- -----------------------------------------------------------------------------

-- O membro está no grupo? Lista: a mesma opção; texto: contém o trecho, sem
-- acento nem maiúscula (como o filtro da lista de Membros, D-094).
create function public.membro_no_grupo(p_membro public.membros, p_campo text, p_valor text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_campo is null then true
    else coalesce((
      select case c.tipo
               when 'lista' then v.valor = p_valor
               else public.simplificar(v.valor) like '%' || public.simplificar(p_valor) || '%'
             end
        from public.campos_cadastro c
        cross join lateral (
          select case when c.preenchido_por = 'tesouraria'
                      then p_membro.campos_internos ->> c.chave
                      else p_membro.campos_extras ->> c.chave
                 end as valor
        ) v
       where c.igreja_id = p_membro.igreja_id and c.chave = p_campo and c.ativo
    ), false)
  end;
$$;

-- Membros que vão receber a mensagem da igreja: ativos, com login, no grupo,
-- que não desligaram, menos quem envia.
create function public.destinatarios_da_mensagem(p_igreja_id uuid, p_campo text, p_valor text, p_autor uuid)
returns setof public.membros
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
    from public.membros m
   where m.igreja_id = p_igreja_id
     and m.status = 'ativo'
     and m.usuario_id is not null
     and m.usuario_id is distinct from p_autor
     and not ('mensagem_da_igreja' = any (m.avisos_desligados))
     and public.membro_no_grupo(m, p_campo, p_valor);
$$;

-- Quando a próxima mensagem da igreja pode sair (limite de 1 por semana).
create function public.proxima_mensagem_da_igreja(p_igreja_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(m.criado_em) + interval '7 days'
    from public.mensagens m
   where m.igreja_id = p_igreja_id and m.origem = 'igreja';
$$;

revoke execute on function public.membro_no_grupo(public.membros, text, text) from public, anon, authenticated;
revoke execute on function public.destinatarios_da_mensagem(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.proxima_mensagem_da_igreja(uuid) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. Funções da tesouraria
-- -----------------------------------------------------------------------------

-- Para a tela: quantos vão receber e quando a próxima pode sair.
create function public.previa_da_mensagem(p_igreja_id uuid, p_campo text default null, p_valor text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_proxima timestamptz := public.proxima_mensagem_da_igreja(p_igreja_id);
begin
  if not public.eh_tesouraria(p_igreja_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'destinatarios', (select count(*) from public.destinatarios_da_mensagem(
      p_igreja_id, nullif(trim(p_campo), ''), nullif(trim(p_valor), ''), (select auth.uid()))),
    'proxima_em', case when v_proxima > now() then v_proxima end
  );
end;
$$;

create function public.enviar_mensagem_da_igreja(
  p_igreja_id uuid,
  p_texto text,
  p_campo text default null,
  p_valor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texto text := trim(coalesce(p_texto, ''));
  v_campo text := nullif(trim(coalesce(p_campo, '')), '');
  v_valor text := nullif(trim(coalesce(p_valor, '')), '');
  v_autor uuid := (select auth.uid());
  v_proxima timestamptz;
  v_mensagem_id uuid;
  v_quantos integer;
begin
  if not public.eh_tesouraria(p_igreja_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if length(v_texto) < 3 or length(v_texto) > 500 then
    raise exception 'texto_invalido' using errcode = '22023';
  end if;
  if (v_campo is null) <> (v_valor is null)
     or (v_campo is not null and not exists (
       select 1 from public.campos_cadastro c
        where c.igreja_id = p_igreja_id and c.chave = v_campo and c.ativo and c.tipo in ('lista', 'texto')
     )) then
    raise exception 'grupo_invalido' using errcode = '22023';
  end if;

  -- Duas pessoas enviando ao mesmo tempo: só uma passa pelo limite.
  perform pg_advisory_xact_lock(hashtext('mensagem_da_igreja:' || p_igreja_id::text));
  v_proxima := public.proxima_mensagem_da_igreja(p_igreja_id);
  if v_proxima > now() then
    raise exception 'limite_semanal' using errcode = '22023', detail = v_proxima::text;
  end if;

  -- A quantidade vai junto na criação: mudar depois apareceria no log.
  v_quantos := (select count(*) from public.destinatarios_da_mensagem(p_igreja_id, v_campo, v_valor, v_autor));
  insert into public.mensagens (igreja_id, origem, autor_id, autor_nome, texto, grupo_campo, grupo_valor, destinatarios)
  values (
    p_igreja_id, 'igreja', v_autor,
    (select m.nome from public.membros m where m.igreja_id = p_igreja_id and m.usuario_id = v_autor and m.status = 'ativo'),
    v_texto, v_campo, v_valor, v_quantos
  )
  returning id into v_mensagem_id;

  insert into public.notificacoes (igreja_id, usuario_id, tipo, dados)
  select p_igreja_id, d.usuario_id, 'mensagem_da_igreja', jsonb_build_object('mensagem_id', v_mensagem_id, 'texto', v_texto)
    from public.destinatarios_da_mensagem(p_igreja_id, v_campo, v_valor, v_autor) d;

  return jsonb_build_object('mensagem_id', v_mensagem_id, 'destinatarios', v_quantos);
end;
$$;

revoke execute on function public.previa_da_mensagem(uuid, text, text) from public, anon;
revoke execute on function public.enviar_mensagem_da_igreja(uuid, text, text, text) from public, anon;
grant execute on function public.previa_da_mensagem(uuid, text, text) to authenticated;
grant execute on function public.enviar_mensagem_da_igreja(uuid, text, text, text) to authenticated;


-- -----------------------------------------------------------------------------
-- 5. Avisos da plataforma (Admin Master)
-- -----------------------------------------------------------------------------

-- Uma pessoa em várias igrejas recebe um aviso só (na primeira igreja dela),
-- de igrejas ativas. Com igreja escolhida, só os de lá.
create function public.destinatarios_da_plataforma(p_igreja_id uuid)
returns table (usuario_id uuid, igreja_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (m.usuario_id) m.usuario_id, m.igreja_id
    from public.membros m
    join public.igrejas i on i.id = m.igreja_id and i.status = 'ativa'
   where m.status = 'ativo'
     and m.usuario_id is not null
     and (p_igreja_id is null or m.igreja_id = p_igreja_id)
   order by m.usuario_id, m.criado_em;
$$;

revoke execute on function public.destinatarios_da_plataforma(uuid) from public, anon, authenticated;

create function public.admin_previa_do_aviso(p_igreja_id uuid default null)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin_master();
  return (select count(*) from public.destinatarios_da_plataforma(p_igreja_id));
end;
$$;

create function public.admin_enviar_aviso_da_plataforma(p_texto text, p_igreja_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texto text := trim(coalesce(p_texto, ''));
  v_mensagem_id uuid;
  v_quantos integer;
begin
  perform public.exigir_admin_master();
  if length(v_texto) < 3 or length(v_texto) > 500 then
    raise exception 'texto_invalido' using errcode = '22023';
  end if;

  v_quantos := (select count(*) from public.destinatarios_da_plataforma(p_igreja_id));
  insert into public.mensagens (igreja_id, origem, autor_id, autor_nome, texto, destinatarios)
  values (p_igreja_id, 'plataforma', (select auth.uid()), 'Meu Dízimo', v_texto, v_quantos)
  returning id into v_mensagem_id;

  insert into public.notificacoes (igreja_id, usuario_id, tipo, dados)
  select d.igreja_id, d.usuario_id, 'aviso_da_plataforma', jsonb_build_object('mensagem_id', v_mensagem_id, 'texto', v_texto)
    from public.destinatarios_da_plataforma(p_igreja_id) d;

  return jsonb_build_object('mensagem_id', v_mensagem_id, 'destinatarios', v_quantos);
end;
$$;

-- Histórico dos avisos da plataforma, para a tela do Admin Master.
create function public.admin_avisos_da_plataforma()
returns table (id uuid, igreja_nome text, texto text, destinatarios integer, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin_master();
  return query
    select m.id, i.nome, m.texto, m.destinatarios, m.criado_em
      from public.mensagens m
      left join public.igrejas i on i.id = m.igreja_id
     where m.origem = 'plataforma'
     order by m.criado_em desc
     limit 50;
end;
$$;

revoke execute on function
  public.admin_previa_do_aviso(uuid),
  public.admin_enviar_aviso_da_plataforma(text, uuid),
  public.admin_avisos_da_plataforma()
  from public, anon;
grant execute on function
  public.admin_previa_do_aviso(uuid),
  public.admin_enviar_aviso_da_plataforma(text, uuid),
  public.admin_avisos_da_plataforma()
  to authenticated;

