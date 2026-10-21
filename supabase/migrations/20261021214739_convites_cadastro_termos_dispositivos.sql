-- =============================================================================
-- Convites, campos do cadastro, aceite dos termos e dispositivos.
-- Funções do primeiro acesso e bloqueio de login sem convite (RN-002).
--
-- Fluxo (Fluxos e Telas, passos 1 a 4):
--   1. Tesouraria chama convidar_membro: cria o membro (convidado) e o convite.
--   2. A pessoa pede o código de 6 dígitos; o hook só deixa criar o login se
--      houver convite válido para o e-mail.
--   3. Já logado, o app chama aceitar_convites: liga o login às fichas.
--   4. O membro preenche o cadastro e chama concluir_cadastro: valida os
--      campos da igreja, registra o aceite dos termos e ativa o membro.
--
-- Erros que o app mostra ao usuário usam códigos curtos (ex.: email_ja_cadastrado)
-- para o app traduzir pelo i18n.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

create type public.tipo_campo_cadastro as enum ('texto', 'data', 'numero', 'lista');
create type public.plataforma_dispositivo as enum ('ios', 'android', 'web');


-- -----------------------------------------------------------------------------
-- campos_cadastro (campos extras definidos por igreja, RN-004)
-- -----------------------------------------------------------------------------

create table public.campos_cadastro (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  -- Nome técnico usado como chave em membros.campos_extras (ex.: "lider").
  chave text not null check (chave ~ '^[a-z][a-z0-9_]{0,39}$'),
  rotulo text not null check (length(trim(rotulo)) > 0),
  tipo public.tipo_campo_cadastro not null,
  opcoes text[] not null default '{}',
  -- Obrigatório, opcional (obrigatorio = false) ou não usado (ativo = false).
  obrigatorio boolean not null default false,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (igreja_id, chave),
  -- Lista de opções só existe (e é obrigatória) no tipo "lista".
  constraint campos_cadastro_opcoes check ((tipo = 'lista') = (cardinality(opcoes) > 0))
);

comment on table public.campos_cadastro is 'Campos extras do cadastro de cada igreja; valores ficam em membros.campos_extras.';

-- Chave e tipo são fixos: mudar quebraria os valores já gravados nos membros.
-- Para outro tipo, cria-se um campo novo e desativa-se o antigo.
create function public.proteger_campo_cadastro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.igreja_id <> old.igreja_id or new.chave <> old.chave or new.tipo <> old.tipo then
    raise exception 'Chave e tipo do campo não podem ser alterados' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger campos_cadastro_a_proteger
  before update on public.campos_cadastro
  for each row execute function public.proteger_campo_cadastro();

create trigger campos_cadastro_atualizado_em
  before update on public.campos_cadastro
  for each row execute function public.definir_atualizado_em();

create trigger campos_cadastro_auditoria
  after insert or update or delete on public.campos_cadastro
  for each row execute function public.registrar_auditoria();


-- -----------------------------------------------------------------------------
-- Validação dos dados cadastrais do membro
--
-- Roda sempre (inclusive nas funções internas): confere os campos extras
-- contra campos_cadastro e o formato da lista de familiares.
-- -----------------------------------------------------------------------------

create function public.validar_dados_cadastrais()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campo record;
  v_chave text;
  v_valor jsonb;
  v_familiar jsonb;
  v_verificar_obrigatorios boolean;
begin
  -- Familiares: lista de objetos {"nome": "...", "parentesco": "..." (opcional)}.
  if tg_op = 'INSERT' or new.familiares is distinct from old.familiares or new.tipo_dizimo <> old.tipo_dizimo then
    for v_familiar in select * from jsonb_array_elements(new.familiares) loop
      if jsonb_typeof(v_familiar) <> 'object'
         or jsonb_typeof(v_familiar -> 'nome') is distinct from 'string'
         or length(trim(v_familiar ->> 'nome')) = 0
         or (v_familiar ? 'parentesco' and jsonb_typeof(v_familiar -> 'parentesco') <> 'string') then
        raise exception 'familiar_invalido' using errcode = '22023';
      end if;
    end loop;

    if new.tipo_dizimo = 'familiar' and jsonb_array_length(new.familiares) = 0 then
      raise exception 'familiares_obrigatorios' using errcode = '23502';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.campos_extras = old.campos_extras and new.status = old.status then
    return new;
  end if;

  -- Obrigatórios são cobrados ao ativar o cadastro e sempre que o membro mexe
  -- nos campos extras. Reativar um membro não exige campos criados depois.
  v_verificar_obrigatorios := new.status = 'ativo'
    and (tg_op = 'INSERT' or new.campos_extras is distinct from old.campos_extras or old.status = 'convidado');

  -- Chaves precisam existir na igreja. Campos desativados continuam aceitos
  -- para não invalidar valores antigos.
  for v_chave in select jsonb_object_keys(new.campos_extras) loop
    if not exists (
      select 1 from public.campos_cadastro c where c.igreja_id = new.igreja_id and c.chave = v_chave
    ) then
      raise exception 'campo_desconhecido' using errcode = '22023', detail = v_chave;
    end if;
  end loop;

  for v_campo in
    select * from public.campos_cadastro c where c.igreja_id = new.igreja_id and c.ativo
  loop
    v_valor := new.campos_extras -> v_campo.chave;

    if v_valor is null
       or v_valor = 'null'::jsonb
       or (jsonb_typeof(v_valor) = 'string' and length(trim(v_valor #>> '{}')) = 0) then
      if v_campo.obrigatorio and v_verificar_obrigatorios then
        raise exception 'campo_obrigatorio' using errcode = '23502', detail = v_campo.chave;
      end if;
      continue;
    end if;

    if (v_campo.tipo = 'texto' and jsonb_typeof(v_valor) <> 'string')
       or (v_campo.tipo = 'numero' and jsonb_typeof(v_valor) <> 'number')
       or (v_campo.tipo = 'lista' and (jsonb_typeof(v_valor) <> 'string' or not (v_valor #>> '{}') = any (v_campo.opcoes)))
       or (v_campo.tipo = 'data' and (jsonb_typeof(v_valor) <> 'string' or (v_valor #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$')) then
      raise exception 'campo_invalido' using errcode = '22023', detail = v_campo.chave;
    end if;

    if v_campo.tipo = 'data' then
      perform (v_valor #>> '{}')::date;  -- recusa datas inexistentes, como 2026-02-30
    end if;
  end loop;

  return new;
end;
$$;

create trigger membros_c_dados_cadastrais
  before insert or update on public.membros
  for each row execute function public.validar_dados_cadastrais();


-- -----------------------------------------------------------------------------
-- convites (validade de 7 dias; reenviar cria novo registro, RN-027)
-- -----------------------------------------------------------------------------

-- Permite chave estrangeira composta: o convite e o membro são da mesma igreja.
alter table public.membros add constraint membros_id_igreja unique (id, igreja_id);

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  membro_id uuid not null,
  enviado_por uuid references auth.users (id),
  enviado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  aceito_em timestamptz,
  foreign key (membro_id, igreja_id) references public.membros (id, igreja_id)
);

create index convites_membro on public.convites (membro_id, enviado_em desc);

comment on table public.convites is 'Cada envio ou reenvio de convite; válido por 7 dias.';

create function public.preparar_convite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.membros m
      where m.id = new.membro_id and m.status = 'convidado'
    ) then
      raise exception 'convite_indisponivel' using errcode = 'P0002';
    end if;

    -- Pedidos do app sempre recebem prazo e autor definidos pelo banco.
    if current_user = 'authenticated' then
      new.enviado_por := (select auth.uid());
      new.enviado_em := now();
      new.expira_em := now() + interval '7 days';
      new.aceito_em := null;
    end if;

    return new;
  end if;

  -- UPDATE: só o aceite muda, uma única vez.
  if (new.id, new.igreja_id, new.membro_id, new.enviado_por, new.enviado_em, new.expira_em)
       is distinct from (old.id, old.igreja_id, old.membro_id, old.enviado_por, old.enviado_em, old.expira_em)
     or old.aceito_em is not null then
    raise exception 'Convite não pode ser alterado' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger convites_a_preparar
  before insert or update on public.convites
  for each row execute function public.preparar_convite();

create trigger convites_auditoria
  after insert or update or delete on public.convites
  for each row execute function public.registrar_auditoria();


-- -----------------------------------------------------------------------------
-- aceites_termos (prova do consentimento, LGPD, RN-041)
-- -----------------------------------------------------------------------------

create table public.aceites_termos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id),
  versao text not null check (length(trim(versao)) > 0),
  aceito_em timestamptz not null default now(),
  unique (usuario_id, versao)
);

comment on table public.aceites_termos is 'Aceite dos termos e da política de privacidade, com data e versão; imutável.';

create function public.preparar_aceite_termos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aceito_em := now();
  return new;
end;
$$;

create trigger aceites_termos_a_preparar
  before insert on public.aceites_termos
  for each row execute function public.preparar_aceite_termos();


-- -----------------------------------------------------------------------------
-- dispositivos (tokens de push; um usuário pode ter vários aparelhos)
-- -----------------------------------------------------------------------------

create table public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id),
  token text not null unique,
  plataforma public.plataforma_dispositivo not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index dispositivos_usuario on public.dispositivos (usuario_id) where ativo;

create trigger dispositivos_atualizado_em
  before update on public.dispositivos
  for each row execute function public.definir_atualizado_em();


-- -----------------------------------------------------------------------------
-- Funções chamadas pelo app (RPC)
-- -----------------------------------------------------------------------------

-- Tesouraria convida (passo 1). Roda com as permissões de quem chama, então
-- RLS e triggers de membros valem normalmente.
create function public.convidar_membro(
  p_igreja_id uuid,
  p_nome text,
  p_email text,
  p_celular text,
  p_perfil public.perfil_membro default 'membro'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_membro_id uuid;
begin
  -- RN-028, com mensagem própria para a tela avisar quem convidou.
  if exists (
    select 1 from public.membros m where m.igreja_id = p_igreja_id and lower(m.email) = v_email
  ) then
    raise exception 'email_ja_cadastrado' using errcode = '23505';
  end if;

  insert into public.membros (igreja_id, nome, email, celular, perfil)
  values (p_igreja_id, trim(p_nome), v_email, trim(p_celular), p_perfil)
  returning id into v_membro_id;

  insert into public.convites (igreja_id, membro_id) values (p_igreja_id, v_membro_id);

  return v_membro_id;
end;
$$;

-- Reenvio: novo registro de convite, com novo prazo de 7 dias.
create function public.reenviar_convite(p_membro_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_igreja_id uuid;
  v_convite_id uuid;
begin
  select m.igreja_id into v_igreja_id
  from public.membros m
  where m.id = p_membro_id and m.status = 'convidado';

  if v_igreja_id is null then
    raise exception 'convite_indisponivel' using errcode = 'P0002';
  end if;

  insert into public.convites (igreja_id, membro_id)
  values (v_igreja_id, p_membro_id)
  returning id into v_convite_id;

  return v_convite_id;
end;
$$;

-- Passo 3: liga o login às fichas convidadas com o mesmo e-mail que ainda
-- têm convite válido. Devolve as igrejas ligadas. Chamado após cada login.
create function public.aceitar_convites()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_convite record;
begin
  if v_usuario_id is null or v_email is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  for v_convite in
    select distinct on (c.membro_id) c.id, c.membro_id, c.igreja_id
    from public.convites c
    join public.membros m on m.id = c.membro_id
    where lower(m.email) = v_email
      and m.status = 'convidado'
      and m.usuario_id is null
      and c.aceito_em is null
      and c.expira_em > now()
    order by c.membro_id, c.enviado_em desc
  loop
    update public.convites set aceito_em = now() where id = v_convite.id;
    update public.membros set usuario_id = v_usuario_id where id = v_convite.membro_id;
    return next v_convite.igreja_id;
  end loop;
end;
$$;

-- Passo 4: o membro completa o cadastro, aceita os termos e fica ativo.
create function public.concluir_cadastro(
  p_membro_id uuid,
  p_nome text,
  p_celular text,
  p_tipo_dizimo public.tipo_dizimo,
  p_familiares jsonb,
  p_campos_extras jsonb,
  p_versao_termos text
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

  update public.membros
     set nome = trim(p_nome),
         celular = trim(p_celular),
         tipo_dizimo = p_tipo_dizimo,
         familiares = coalesce(p_familiares, '[]'::jsonb),
         campos_extras = coalesce(p_campos_extras, '{}'::jsonb),
         status = 'ativo'
   where id = p_membro_id
     and usuario_id = (select auth.uid())
     and status = 'convidado';

  if not found then
    raise exception 'cadastro_indisponivel' using errcode = 'P0002';
  end if;

  insert into public.aceites_termos (usuario_id, versao)
  values ((select auth.uid()), trim(p_versao_termos))
  on conflict (usuario_id, versao) do nothing;
end;
$$;

-- Token de push do aparelho. Se o aparelho trocar de conta, o token passa
-- para o novo usuário.
create function public.registrar_dispositivo(p_token text, p_plataforma public.plataforma_dispositivo)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  insert into public.dispositivos (usuario_id, token, plataforma)
  values (auth.uid(), p_token, p_plataforma)
  on conflict (token) do update
    set usuario_id = excluded.usuario_id,
        plataforma = excluded.plataforma,
        ativo = true;
end;
$$;

create function public.desativar_dispositivo(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.dispositivos
     set ativo = false
   where token = p_token
     and usuario_id = (select auth.uid());
$$;


-- -----------------------------------------------------------------------------
-- Hook do Supabase Auth: só cria login para e-mail com convite válido (RN-002)
--
-- Pessoas que já têm login (ex.: membro de outra igreja) não passam por aqui;
-- o novo convite é ligado por aceitar_convites. O Admin Master é criado pelo
-- painel/servidor com app_metadata.admin_master, que o app não consegue definir.
-- -----------------------------------------------------------------------------

create function public.hook_antes_de_criar_usuario(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(event -> 'user' ->> 'email');
begin
  if coalesce((event -> 'user' -> 'app_metadata' ->> 'admin_master')::boolean, false) then
    return '{}'::jsonb;
  end if;

  if exists (
    select 1
    from public.convites c
    join public.membros m on m.id = c.membro_id
    where lower(m.email) = v_email
      and m.status = 'convidado'
      and m.usuario_id is null
      and c.aceito_em is null
      and c.expira_em > now()
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'convite_nao_encontrado')
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- Troca de e-mail confirmada no Auth (RN-010) atualiza as fichas do membro.
-- -----------------------------------------------------------------------------

create function public.sincronizar_email_membros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.membros
     set email = lower(new.email)
   where usuario_id = new.id
     and email <> lower(new.email);
  return new;
end;
$$;

create trigger membros_sincronizar_email
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email and new.email is not null)
  execute function public.sincronizar_email_membros();


-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------

revoke all on public.campos_cadastro, public.convites, public.aceites_termos, public.dispositivos from anon;
revoke delete, truncate on public.campos_cadastro from authenticated;
-- Convite registrado não muda pelo app (o aceite é feito por aceitar_convites);
-- aceites são imutáveis; dispositivos só mudam pelas funções acima.
revoke update, delete, truncate on public.convites from authenticated;
revoke update, delete, truncate on public.aceites_termos from authenticated, service_role;
revoke insert, update, delete, truncate on public.dispositivos from authenticated;

-- Funções: só usuários logados chamam; o hook, só o Supabase Auth.
revoke execute on function
  public.convidar_membro(uuid, text, text, text, public.perfil_membro),
  public.reenviar_convite(uuid),
  public.aceitar_convites(),
  public.concluir_cadastro(uuid, text, text, public.tipo_dizimo, jsonb, jsonb, text),
  public.registrar_dispositivo(text, public.plataforma_dispositivo),
  public.desativar_dispositivo(text)
from public, anon;

grant execute on function
  public.convidar_membro(uuid, text, text, text, public.perfil_membro),
  public.reenviar_convite(uuid),
  public.aceitar_convites(),
  public.concluir_cadastro(uuid, text, text, public.tipo_dizimo, jsonb, jsonb, text),
  public.registrar_dispositivo(text, public.plataforma_dispositivo),
  public.desativar_dispositivo(text)
to authenticated;

revoke execute on function public.hook_antes_de_criar_usuario(jsonb) from public, anon, authenticated;
grant execute on function public.hook_antes_de_criar_usuario(jsonb) to supabase_auth_admin;


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.campos_cadastro enable row level security;
alter table public.convites enable row level security;
alter table public.aceites_termos enable row level security;
alter table public.dispositivos enable row level security;

-- campos_cadastro: quem está ligado à igreja lê (para montar o formulário);
-- só o Pastor de Governo define.
create policy campos_cadastro_select on public.campos_cadastro
  for select to authenticated
  using (public.eh_vinculado(igreja_id) or public.eh_tesouraria(igreja_id) or public.eh_admin_master());

create policy campos_cadastro_insert on public.campos_cadastro
  for insert to authenticated
  with check (public.eh_administrador(igreja_id));

create policy campos_cadastro_update on public.campos_cadastro
  for update to authenticated
  using (public.eh_administrador(igreja_id))
  with check (public.eh_administrador(igreja_id));

-- convites: só a tesouraria da igreja (D-055) e o Admin Master.
create policy convites_select on public.convites
  for select to authenticated
  using (public.eh_tesouraria(igreja_id) or public.eh_admin_master());

create policy convites_insert on public.convites
  for insert to authenticated
  with check (public.eh_tesouraria(igreja_id) or public.eh_admin_master());

-- aceites_termos: cada um vê e registra só os próprios.
create policy aceites_termos_select on public.aceites_termos
  for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy aceites_termos_insert on public.aceites_termos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- dispositivos: cada um vê só os próprios. O envio de push usa a chave secreta
-- numa Edge Function.
create policy dispositivos_select on public.dispositivos
  for select to authenticated
  using (usuario_id = (select auth.uid()));
