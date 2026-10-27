-- Admin Master: telas A-01 (Igrejas) e A-02 (Logs globais), e o suporte.
--
-- Decisões do desenvolvedor (27/10/2026):
-- - O Admin Master vê as igrejas e o Pastor de cada uma; dos membros, só o
--   necessário para um atendimento (busca por e-mail, com motivo), e cada
--   busca fica no log da igreja. Não vê cartões, valores nem comprovantes.
-- - Um só Pastor de Governo por igreja: o novo substitui o anterior, que
--   volta a ser membro.
-- - Igreja inativa: ninguém dela entra (membros e tesouraria); nada se
--   apaga, e reativar devolve tudo como estava.
-- - Igreja nova: nome, país, idioma, moeda, faixa do plano e o Pastor (que
--   recebe o convite por e-mail e completa o resto).


-- -----------------------------------------------------------------------------
-- 1. Igreja inativa: as regras de acesso só valem em igreja ativa
-- -----------------------------------------------------------------------------

create function public.igreja_ativa(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.igrejas i where i.id = p_igreja_id and i.status = 'ativa');
$$;

create or replace function public.perfil_na_igreja(p_igreja_id uuid)
returns public.perfil_membro
language sql
stable
security definer
set search_path = ''
as $$
  select m.perfil
  from public.membros m
  join public.igrejas i on i.id = m.igreja_id and i.status = 'ativa'
  where m.igreja_id = p_igreja_id
    and m.usuario_id = (select auth.uid())
    and m.status = 'ativo';
$$;

create or replace function public.eh_vinculado(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membros m
    join public.igrejas i on i.id = m.igreja_id and i.status = 'ativa'
    where m.igreja_id = p_igreja_id
      and m.usuario_id = (select auth.uid())
      and m.status in ('convidado', 'ativo')
  );
$$;

create or replace function public.eh_minha_ficha(p_membro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membros m
    join public.igrejas i on i.id = m.igreja_id and i.status = 'ativa'
    where m.id = p_membro_id
      and m.usuario_id = (select auth.uid())
      and m.status = 'ativo'
  );
$$;

-- Para o app explicar por que a pessoa não entra (como em igrejas_onde_estou_inativo).
create function public.igrejas_inativas_onde_estou()
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
    and m.status <> 'inativo'
    and i.status = 'inativa'
  order by i.nome;
$$;

revoke execute on function public.igrejas_inativas_onde_estou() from public, anon;
grant execute on function public.igrejas_inativas_onde_estou() to authenticated;


-- -----------------------------------------------------------------------------
-- 2. O Admin Master deixa de ler os dados dos membros direto
--    (fica só o que é da igreja: a própria igreja e as imagens dela)
-- -----------------------------------------------------------------------------

alter policy auditoria_select on public.auditoria
  using (public.eh_administrador(igreja_id));

alter policy campanhas_select on public.campanhas
  using ((status <> 'rascunho' and public.eh_vinculado(igreja_id)) or public.eh_tesouraria(igreja_id));

alter policy campos_cadastro_select on public.campos_cadastro
  using (public.eh_vinculado(igreja_id) or public.eh_tesouraria(igreja_id));

alter policy comprovantes_select on public.comprovantes
  using (
    public.eh_tesouraria(igreja_id)
    or exists (
      select 1 from public.lancamentos l
       where l.id = comprovantes.lancamento_id and public.eh_minha_ficha(l.membro_id)
    )
  );

alter policy contas_select on public.contas
  using ((ativa and public.eh_vinculado(igreja_id)) or public.eh_tesouraria(igreja_id));

alter policy convites_insert on public.convites
  with check (public.eh_tesouraria(igreja_id));

alter policy convites_select on public.convites
  using (public.eh_tesouraria(igreja_id));

alter policy lancamentos_select on public.lancamentos
  using (public.eh_minha_ficha(membro_id) or public.eh_tesouraria(igreja_id));

alter policy membros_insert on public.membros
  with check (public.eh_tesouraria(igreja_id));

-- A própria ficha continua legível (o app precisa dela para dizer que a
-- igreja está inativa); alterar, só em igreja ativa.
alter policy membros_select on public.membros
  using (((usuario_id = (select auth.uid())) and status <> 'inativo') or public.eh_tesouraria(igreja_id));

alter policy membros_update on public.membros
  using (
    ((usuario_id = (select auth.uid())) and status <> 'inativo' and public.igreja_ativa(igreja_id))
    or public.eh_tesouraria(igreja_id)
  )
  with check (
    ((usuario_id = (select auth.uid())) and status <> 'inativo' and public.igreja_ativa(igreja_id))
    or public.eh_tesouraria(igreja_id)
  );


-- -----------------------------------------------------------------------------
-- 3. Um só Pastor de Governo por igreja
-- -----------------------------------------------------------------------------

create unique index membros_um_pastor_por_igreja
  on public.membros (igreja_id)
  where perfil = 'administrador' and status <> 'inativo';


-- -----------------------------------------------------------------------------
-- 4. Funções do Admin Master
-- -----------------------------------------------------------------------------

-- agir_como passa a levar também a marca de Admin Master do login, para
-- eh_admin_master() valer dentro das funções chamadas pela Edge Function.
create or replace function public.agir_como(p_usuario uuid)
returns void
language sql
set search_path = ''
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_usuario,
      'role', 'authenticated',
      'app_metadata', coalesce((select u.raw_app_meta_data from auth.users u where u.id = p_usuario), '{}'::jsonb)
    )::text,
    true
  );
$$;

create function public.exigir_admin_master()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.eh_admin_master() then
    raise exception 'so_admin_master' using errcode = '42501';
  end if;
end;
$$;

-- A-01: as igrejas, com o Pastor de cada uma (o contato da igreja com a
-- plataforma) e quantos membros ativos tem. Nenhum dado de membro além disso.
create function public.admin_listar_igrejas()
returns table (
  id uuid,
  nome text,
  status public.status_igreja,
  faixa_plano text,
  pais text,
  idioma text,
  moeda text,
  titulo_administrador text,
  criado_em timestamptz,
  membros_ativos bigint,
  pastor_id uuid,
  pastor_nome text,
  pastor_email text,
  pastor_status public.status_membro
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin_master();
  return query
    select i.id, i.nome, i.status, i.faixa_plano, i.pais::text, i.idioma, i.moeda::text, i.titulo_administrador,
           i.criado_em,
           (select count(*) from public.membros m where m.igreja_id = i.id and m.status = 'ativo'),
           p.id, p.nome, p.email, p.status
      from public.igrejas i
      left join public.membros p
        on p.igreja_id = i.id and p.perfil = 'administrador' and p.status <> 'inativo'
     order by i.nome;
end;
$$;

-- Igreja nova com o convite do Pastor de Governo (o e-mail sai sozinho).
create function public.admin_cadastrar_igreja(
  p_nome text,
  p_pais text,
  p_idioma text,
  p_moeda text,
  p_faixa_plano text,
  p_titulo_administrador text,
  p_pastor_nome text,
  p_pastor_email text,
  p_pastor_celular text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja_id uuid;
begin
  perform public.exigir_admin_master();
  if length(trim(coalesce(p_nome, ''))) < 3 then
    raise exception 'nome_obrigatorio' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_pastor_nome, ''))) < 3 or length(trim(coalesce(p_pastor_celular, ''))) < 8 then
    raise exception 'pastor_obrigatorio' using errcode = '22023';
  end if;
  if lower(trim(coalesce(p_pastor_email, ''))) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalido' using errcode = '22023';
  end if;

  insert into public.igrejas (nome, pais, idioma, moeda, faixa_plano, titulo_administrador)
  values (
    trim(p_nome),
    upper(coalesce(nullif(trim(p_pais), ''), 'BR')),
    coalesce(nullif(trim(p_idioma), ''), 'pt-BR'),
    upper(coalesce(nullif(trim(p_moeda), ''), 'BRL')),
    nullif(trim(coalesce(p_faixa_plano, '')), ''),
    coalesce(nullif(trim(p_titulo_administrador), ''), 'Pastor de Governo')
  )
  returning id into v_igreja_id;

  perform public.convidar_membro(v_igreja_id, p_pastor_nome, p_pastor_email, p_pastor_celular, 'administrador');
  return v_igreja_id;
end;
$$;

-- Status, plano, país, idioma, moeda e título (D-071, D-092).
create function public.admin_atualizar_igreja(
  p_igreja_id uuid,
  p_nome text,
  p_status public.status_igreja,
  p_faixa_plano text,
  p_pais text,
  p_idioma text,
  p_moeda text,
  p_titulo_administrador text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin_master();
  if length(trim(coalesce(p_nome, ''))) < 3 then
    raise exception 'nome_obrigatorio' using errcode = '22023';
  end if;
  update public.igrejas
     set nome = trim(p_nome),
         status = p_status,
         faixa_plano = nullif(trim(coalesce(p_faixa_plano, '')), ''),
         pais = upper(trim(p_pais)),
         idioma = trim(p_idioma),
         moeda = upper(trim(p_moeda)),
         titulo_administrador = coalesce(nullif(trim(p_titulo_administrador), ''), 'Pastor de Governo')
   where id = p_igreja_id;
  if not found then
    raise exception 'igreja_nao_encontrada' using errcode = 'P0002';
  end if;
end;
$$;

-- O Pastor atual deixa de ser: se já entrou, volta a membro; se ainda era
-- convidado, o convite é cancelado.
create function public.admin_tirar_pastor_atual(p_igreja_id uuid, p_exceto uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.membros
     set perfil = 'membro'
   where igreja_id = p_igreja_id and perfil = 'administrador' and status = 'ativo'
     and id is distinct from p_exceto;
  update public.membros
     set status = 'inativo'
   where igreja_id = p_igreja_id and perfil = 'administrador' and status = 'convidado'
     and id is distinct from p_exceto;
$$;

-- Novo Pastor por convite (pessoa que ainda não está na igreja).
create function public.admin_convidar_pastor(
  p_igreja_id uuid,
  p_nome text,
  p_email text,
  p_celular text,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro_id uuid;
begin
  perform public.exigir_admin_master();
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'motivo_obrigatorio' using errcode = '22023';
  end if;
  if lower(trim(coalesce(p_email, ''))) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalido' using errcode = '22023';
  end if;
  perform set_config('app.motivo', trim(p_motivo), true);
  perform public.admin_tirar_pastor_atual(p_igreja_id, null);
  v_membro_id := public.convidar_membro(p_igreja_id, p_nome, p_email, p_celular, 'administrador');
  perform set_config('app.motivo', '', true);
  return v_membro_id;
end;
$$;

-- Novo Pastor entre os membros ativos da igreja (achado pela busca do suporte).
create function public.admin_definir_pastor(p_membro_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.membros;
begin
  perform public.exigir_admin_master();
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'motivo_obrigatorio' using errcode = '22023';
  end if;
  select * into v_membro from public.membros where id = p_membro_id for update;
  if not found then
    raise exception 'membro_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_membro.status <> 'ativo' then
    raise exception 'membro_nao_ativo' using errcode = '22023';
  end if;
  if v_membro.perfil = 'administrador' then
    raise exception 'ja_e_pastor' using errcode = '22023';
  end if;
  perform set_config('app.motivo', trim(p_motivo), true);
  perform public.admin_tirar_pastor_atual(v_membro.igreja_id, p_membro_id);
  update public.membros set perfil = 'administrador' where id = p_membro_id;
  perform set_config('app.motivo', '', true);
end;
$$;

-- Atendimento: acha a pessoa pelo e-mail em todas as igrejas. Cada ficha
-- encontrada fica registrada no log da igreja dela, com o motivo.
create function public.admin_buscar_pessoa(p_email text, p_motivo text)
returns table (
  membro_id uuid,
  igreja_id uuid,
  igreja_nome text,
  nome text,
  email text,
  perfil public.perfil_membro,
  status public.status_membro,
  tem_login boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  perform public.exigir_admin_master();
  if length(v_motivo) < 5 then
    raise exception 'motivo_obrigatorio' using errcode = '22023';
  end if;
  if length(v_email) < 3 then
    raise exception 'email_invalido' using errcode = '22023';
  end if;

  insert into public.auditoria (igreja_id, usuario_id, perfil, acao, tabela, registro_id, antes, depois, motivo)
  select m.igreja_id, (select auth.uid()), 'admin_master', 'acesso_suporte', 'membros', m.id,
         null, jsonb_build_object('email_buscado', v_email), v_motivo
    from public.membros m
   where m.email = v_email;

  return query
    select m.id, m.igreja_id, i.nome, m.nome, m.email, m.perfil, m.status, m.usuario_id is not null
      from public.membros m
      join public.igrejas i on i.id = m.igreja_id
     where m.email = v_email
     order by i.nome;
end;
$$;

-- A-02: o que o suporte e a plataforma fizeram nas igrejas, do mais novo ao
-- mais antigo, com páginas (como o Log da igreja).
create function public.admin_logs_globais(p_pagina integer default 1, p_tamanho integer default 20)
returns table (
  id bigint,
  criado_em timestamptz,
  igreja_id uuid,
  igreja_nome text,
  acao text,
  tabela text,
  registro_id uuid,
  antes jsonb,
  depois jsonb,
  motivo text,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin_master();
  return query
    select a.id, a.criado_em, a.igreja_id, i.nome, a.acao, a.tabela, a.registro_id, a.antes, a.depois, a.motivo,
           count(*) over ()
      from public.auditoria a
      left join public.igrejas i on i.id = a.igreja_id
     where a.perfil = 'admin_master'
     order by a.criado_em desc, a.id desc
     limit least(greatest(p_tamanho, 1), 100)
    offset (greatest(p_pagina, 1) - 1) * least(greatest(p_tamanho, 1), 100);
end;
$$;

-- O Pastor que ainda não entrou pode pedir o convite de novo ao suporte.
create function public.admin_reenviar_convite(p_membro_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja_id uuid;
begin
  perform public.exigir_admin_master();
  select m.igreja_id into v_igreja_id from public.membros m where m.id = p_membro_id and m.status = 'convidado';
  if not found then
    raise exception 'convite_indisponivel' using errcode = 'P0002';
  end if;
  insert into public.convites (igreja_id, membro_id, enviado_por) values (v_igreja_id, p_membro_id, (select auth.uid()));
end;
$$;

revoke execute on function public.admin_reenviar_convite(uuid) from public, anon;
grant execute on function public.admin_reenviar_convite(uuid) to authenticated;

revoke execute on function public.igreja_ativa(uuid) from public, anon;
revoke execute on function public.exigir_admin_master() from public, anon;
revoke execute on function public.admin_tirar_pastor_atual(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_listar_igrejas() from public, anon;
revoke execute on function
  public.admin_cadastrar_igreja(text, text, text, text, text, text, text, text, text),
  public.admin_atualizar_igreja(uuid, text, public.status_igreja, text, text, text, text, text),
  public.admin_convidar_pastor(uuid, text, text, text, text),
  public.admin_definir_pastor(uuid, text),
  public.admin_buscar_pessoa(text, text),
  public.admin_logs_globais(integer, integer)
  from public, anon;
grant execute on function
  public.admin_listar_igrejas(),
  public.admin_cadastrar_igreja(text, text, text, text, text, text, text, text, text),
  public.admin_atualizar_igreja(uuid, text, public.status_igreja, text, text, text, text, text),
  public.admin_convidar_pastor(uuid, text, text, text, text),
  public.admin_definir_pastor(uuid, text),
  public.admin_buscar_pessoa(text, text),
  public.admin_logs_globais(integer, integer)
  to authenticated;


-- -----------------------------------------------------------------------------
-- 5. Troca de e-mail pelo suporte (D-097): o do Pastor e o de quem está em
--    mais de uma igreja. Mesmo caminho da tesouraria (Edge Function
--    trocar-email), sem as restrições de igreja; todas as fichas da pessoa
--    mudam juntas, cada uma com o motivo no log da sua igreja.
-- -----------------------------------------------------------------------------

create or replace function public.trocar_email_do_membro(p_autor uuid, p_membro_id uuid, p_email text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.membros;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_suporte boolean;
begin
  perform public.agir_como(p_autor);
  v_suporte := public.eh_admin_master();

  select * into v_membro from public.membros where id = p_membro_id for update;
  if not found or not (v_suporte or public.eh_tesouraria(v_membro.igreja_id)) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if v_membro.usuario_id = p_autor then
    raise exception 'email_proprio' using errcode = '42501';
  end if;
  if v_membro.perfil = 'administrador' and not v_suporte then
    raise exception 'pastor_pelo_suporte' using errcode = '42501';
  end if;
  if v_membro.status = 'inativo' then
    raise exception 'membro_inativo' using errcode = '42501';
  end if;
  if length(v_motivo) < 5 then
    raise exception 'motivo_obrigatorio' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalido' using errcode = '22023';
  end if;
  if v_email = v_membro.email then
    raise exception 'email_igual' using errcode = '22023';
  end if;
  -- Nas igrejas de todas as fichas que vão mudar, o e-mail novo não pode ser de outra pessoa.
  if exists (
    select 1 from public.membros m
     where m.email = v_email
       and m.igreja_id in (
         select f.igreja_id from public.membros f
          where f.id = p_membro_id or (v_membro.usuario_id is not null and f.usuario_id = v_membro.usuario_id)
       )
  ) then
    raise exception 'email_ja_cadastrado' using errcode = '23505';
  end if;
  -- Juntar duas contas é com o suporte, fora do app.
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'email_ja_tem_login' using errcode = '23505';
  end if;
  -- O login vale para todas as igrejas da pessoa: uma igreja não decide pelas outras.
  if not v_suporte
     and v_membro.usuario_id is not null
     and exists (
       select 1 from public.membros m
        where m.usuario_id = v_membro.usuario_id
          and m.igreja_id <> v_membro.igreja_id
     ) then
    raise exception 'esta_em_outra_igreja' using errcode = '42501';
  end if;

  perform set_config('app.motivo', v_motivo, true);
  update public.membros
     set email = v_email
   where id = p_membro_id
      or (v_membro.usuario_id is not null and usuario_id = v_membro.usuario_id);
  perform set_config('app.motivo', '', true);

  -- Quem ainda não entrou: o convite vai de novo, agora para o e-mail certo.
  if v_membro.status = 'convidado' then
    insert into public.convites (igreja_id, membro_id, enviado_por)
    values (v_membro.igreja_id, p_membro_id, p_autor);
  end if;

  return jsonb_build_object(
    'usuario_id', v_membro.usuario_id,
    'email_antigo', v_membro.email,
    'nome', v_membro.nome,
    'igreja_nome', (select i.nome from public.igrejas i where i.id = v_membro.igreja_id),
    'titulo_administrador', (select i.titulo_administrador from public.igrejas i where i.id = v_membro.igreja_id)
  );
end;
$$;

-- Desfazer também volta todas as fichas da pessoa.
create or replace function public.desfazer_troca_de_email(p_autor uuid, p_membro_id uuid, p_email_antigo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select m.usuario_id from public.membros m where m.id = p_membro_id);
begin
  perform public.agir_como(p_autor);
  perform set_config('app.motivo', 'falha_ao_trocar_o_login', true);
  update public.membros
     set email = p_email_antigo
   where id = p_membro_id or (v_usuario is not null and usuario_id = v_usuario);
  perform set_config('app.motivo', '', true);
end;
$$;
