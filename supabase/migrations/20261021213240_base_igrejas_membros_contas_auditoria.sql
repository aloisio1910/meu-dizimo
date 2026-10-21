-- =============================================================================
-- Base multi-igreja: igrejas, membros, contas e auditoria, com RLS.
--
-- Princípios (CLAUDE.md e Requisitos v0.3):
--   * Toda tabela de dados de igreja tem igreja_id; o isolamento é feito pela
--     RLS do banco, nunca só pelo app (RN-022).
--   * Nada se apaga: DELETE é revogado; registros mudam de status (RN-026).
--   * Auditoria gravada por triggers numa tabela sem UPDATE/DELETE (RN-021).
--   * Regras de quem pode mudar o quê ficam em triggers que só agem sobre
--     requisições de usuários (role "authenticated"); funções internas do
--     banco, que rodam como dono (security definer), passam direto.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

-- "administrador" é o perfil técnico do Pastor de Governo; o título exibido
-- fica em igrejas.titulo_administrador.
create type public.perfil_membro as enum ('membro', 'tesoureiro', 'administrador');
create type public.status_membro as enum ('convidado', 'ativo', 'inativo');
create type public.tipo_dizimo as enum ('individual', 'familiar');
create type public.status_igreja as enum ('ativa', 'inativa');
create type public.tipo_chave_pix as enum ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria');


-- -----------------------------------------------------------------------------
-- Utilitário: mantém a coluna atualizado_em
-- -----------------------------------------------------------------------------

create function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- igrejas
-- -----------------------------------------------------------------------------

create table public.igrejas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  denominacao text,
  pais char(2) not null default 'BR',
  idioma text not null default 'pt-BR',
  moeda char(3) not null default 'BRL',
  titulo_administrador text not null default 'Pastor de Governo',
  -- Personalização (seção 17): imagens ficam no Storage; aqui só o caminho.
  logo_path text,
  cor_principal text check (cor_principal ~ '^#[0-9A-Fa-f]{6}$'),
  capa_path text,
  versiculo_referencia text not null default 'Malaquias 3:10',
  versiculo_texto text,
  mensagem_confirmacao text,
  -- Informações da igreja (aba Igreja)
  endereco text,
  horarios_culto text,
  site text,
  redes_sociais jsonb not null default '{}'::jsonb check (jsonb_typeof(redes_sociais) = 'object'),
  whatsapp_contato text,
  -- Cada igreja define as formas aceitas; o lançamento usa uma delas.
  formas_devolucao text[] not null default array['pix', 'cartao', 'dinheiro', 'transferencia']
    check (cardinality(formas_devolucao) > 0),
  status public.status_igreja not null default 'ativa',
  faixa_plano text,
  -- Contador do número sequencial do dizimista (só o banco altera).
  proximo_numero_dizimista integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.igrejas is 'Igrejas clientes da plataforma; raiz do isolamento multi-igreja.';


-- -----------------------------------------------------------------------------
-- membros (um registro por pessoa por igreja; login fica no Supabase Auth)
-- -----------------------------------------------------------------------------

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  -- Preenchido quando a pessoa entra pela primeira vez com o e-mail convidado.
  usuario_id uuid references auth.users (id),
  -- Número do dizimista, sequencial por igreja, definido pelo banco.
  numero integer not null,
  nome text not null check (length(trim(nome)) > 0),                             -- RN-005
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),               -- RN-006
  celular text not null check (length(trim(celular)) > 0),                       -- RN-006
  tipo_dizimo public.tipo_dizimo not null default 'individual',
  -- Dízimo familiar: lista de nomes da família, sem acesso ao cartão.
  familiares jsonb not null default '[]'::jsonb check (jsonb_typeof(familiares) = 'array'),
  -- Valores dos campos definidos em campos_cadastro (RN-004).
  campos_extras jsonb not null default '{}'::jsonb check (jsonb_typeof(campos_extras) = 'object'),
  perfil public.perfil_membro not null default 'membro',
  status public.status_membro not null default 'convidado',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (igreja_id, numero),
  unique (igreja_id, usuario_id)
);

-- RN-028: e-mail já cadastrado na mesma igreja bloqueia novo cadastro.
create unique index membros_email_por_igreja on public.membros (igreja_id, lower(email));
create index membros_usuario_id on public.membros (usuario_id);

comment on table public.membros is 'Vínculo de uma pessoa com uma igreja (D-061): perfil, status e dados cadastrais.';


-- -----------------------------------------------------------------------------
-- Funções de permissão usadas pela RLS
--
-- São "security definer" para poder consultar membros sem cair na própria
-- RLS de membros (o que geraria recursão). Todas respondem apenas sobre o
-- usuário logado, então não vazam dados de terceiros.
-- -----------------------------------------------------------------------------

-- Admin Master: marca no app_metadata do usuário, que só a chave secreta grava.
create function public.eh_admin_master()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'admin_master')::boolean, false);
$$;

-- Perfil do usuário logado na igreja, se ele for membro ATIVO dela.
create function public.perfil_na_igreja(p_igreja_id uuid)
returns public.perfil_membro
language sql
stable
security definer
set search_path = ''
as $$
  select m.perfil
  from public.membros m
  where m.igreja_id = p_igreja_id
    and m.usuario_id = (select auth.uid())
    and m.status = 'ativo';
$$;

-- Usuário logado tem vínculo com a igreja (convidado concluindo o cadastro ou
-- ativo). Inativo perde o acesso (RN-035).
create function public.eh_vinculado(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membros m
    where m.igreja_id = p_igreja_id
      and m.usuario_id = (select auth.uid())
      and m.status in ('convidado', 'ativo')
  );
$$;

-- Tesouraria = tesoureiro ou administrador (o Pastor de Governo tem tudo do tesoureiro).
create function public.eh_tesouraria(p_igreja_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.perfil_na_igreja(p_igreja_id) in ('tesoureiro', 'administrador'), false);
$$;

create function public.eh_administrador(p_igreja_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.perfil_na_igreja(p_igreja_id) = 'administrador', false);
$$;


-- -----------------------------------------------------------------------------
-- Regras de igrejas
-- -----------------------------------------------------------------------------

-- Status e plano são da plataforma (Admin Master); o contador é só do banco.
create function public.proteger_campos_igreja()
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

  return new;
end;
$$;

create trigger igrejas_a_proteger
  before update on public.igrejas
  for each row execute function public.proteger_campos_igreja();

create trigger igrejas_atualizado_em
  before update on public.igrejas
  for each row execute function public.definir_atualizado_em();


-- -----------------------------------------------------------------------------
-- Regras de membros
-- -----------------------------------------------------------------------------

-- Quem pode cadastrar e alterar o quê. Só age sobre requisições de usuários.
create function public.validar_membro()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_admin_master boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  v_admin_master := public.eh_admin_master();

  if tg_op = 'INSERT' then
    -- Todo membro nasce convidado e sem login; o vínculo é feito no primeiro acesso.
    new.status := 'convidado';
    new.usuario_id := null;

    if new.perfil = 'administrador' and not v_admin_master then
      raise exception 'Só o Admin Master cadastra o Pastor de Governo' using errcode = '42501';
    end if;

    if new.perfil = 'tesoureiro' and not (v_admin_master or public.eh_administrador(new.igreja_id)) then
      raise exception 'Só o Pastor de Governo cadastra tesoureiros' using errcode = '42501';
    end if;

    return new;
  end if;

  -- UPDATE
  if new.id <> old.id
     or new.igreja_id <> old.igreja_id
     or new.numero <> old.numero
     or new.usuario_id is distinct from old.usuario_id
     or new.criado_em <> old.criado_em then
    raise exception 'Campos de identificação do membro não podem ser alterados' using errcode = '42501';
  end if;

  if new.perfil <> old.perfil or new.status <> old.status then
    if not (v_admin_master or public.eh_administrador(old.igreja_id)) then
      raise exception 'Só o Pastor de Governo altera perfil ou status do membro' using errcode = '42501';
    end if;

    if new.perfil = 'administrador' and old.perfil <> 'administrador' and not v_admin_master then
      raise exception 'Só o Admin Master define o Pastor de Governo' using errcode = '42501';
    end if;

    -- Inativar e reativar; convidado -> ativo acontece só ao concluir o cadastro.
    if new.status <> old.status and not (
         (old.status in ('ativo', 'inativo') and new.status in ('ativo', 'inativo'))
         or (old.status = 'convidado' and new.status = 'inativo')
       ) then
      raise exception 'Mudança de status do membro não permitida' using errcode = '42501';
    end if;
  end if;

  -- O membro troca o e-mail pela confirmação de código (fluxo do Auth, RN-010).
  -- A tesouraria só corrige o e-mail enquanto o convite está pendente.
  if new.email <> old.email
     and not (old.status = 'convidado' and (v_admin_master or public.eh_tesouraria(old.igreja_id))) then
    raise exception 'Alteração de e-mail não permitida por este caminho' using errcode = '42501';
  end if;

  -- RN-009: o próprio membro altera seus dados cadastrais.
  if (new.nome, new.celular, new.tipo_dizimo, new.familiares, new.campos_extras)
       is distinct from (old.nome, old.celular, old.tipo_dizimo, old.familiares, old.campos_extras)
     and old.usuario_id is distinct from (select auth.uid()) then
    raise exception 'Somente o próprio membro altera seus dados cadastrais' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Número sequencial por igreja. Roda como dono do banco para poder atualizar
-- o contador; a linha da igreja fica travada até o fim da transação, então
-- dois cadastros simultâneos nunca recebem o mesmo número.
create function public.numerar_membro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.igrejas
     set proximo_numero_dizimista = proximo_numero_dizimista + 1
   where id = new.igreja_id
  returning proximo_numero_dizimista - 1 into new.numero;

  if new.numero is null then
    raise exception 'Igreja não encontrada' using errcode = '23503';
  end if;

  return new;
end;
$$;

-- Triggers do mesmo momento rodam em ordem alfabética: validar antes de numerar.
create trigger membros_a_validar
  before insert or update on public.membros
  for each row execute function public.validar_membro();

create trigger membros_b_numerar
  before insert on public.membros
  for each row execute function public.numerar_membro();

create trigger membros_atualizado_em
  before update on public.membros
  for each row execute function public.definir_atualizado_em();


-- -----------------------------------------------------------------------------
-- contas (meios de pagamento da igreja, D-064 e D-066)
-- -----------------------------------------------------------------------------

create table public.contas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  nome text not null check (length(trim(nome)) > 0),   -- ex.: "Construção do templo"
  finalidade text,
  principal boolean not null default false,
  banco text,
  agencia text,
  numero_conta text,
  chave_pix text,
  tipo_chave_pix public.tipo_chave_pix,
  -- Limites do padrão BR Code (Pix Copia e Cola): nome até 25, cidade até 15.
  nome_recebedor text check (length(nome_recebedor) <= 25),
  cidade text check (length(cidade) <= 15),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Para gerar o código Pix são exigidos chave, tipo, nome e cidade.
  constraint contas_pix_completo check (
    chave_pix is null
    or (tipo_chave_pix is not null and nome_recebedor is not null and cidade is not null)
  ),
  constraint contas_principal_ativa check (not principal or ativa)
);

-- Uma única conta principal por igreja.
create unique index contas_uma_principal on public.contas (igreja_id) where principal;
create index contas_igreja_id on public.contas (igreja_id);

comment on table public.contas is 'Até 5 contas ativas por igreja, uma principal (dízimo usa a principal).';

-- Até 5 contas ativas por igreja. A trava evita que dois cadastros
-- simultâneos passem juntos do limite.
create function public.limitar_contas_ativas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ativa and (tg_op = 'INSERT' or not old.ativa) then
    perform pg_advisory_xact_lock(hashtext('contas:' || new.igreja_id::text));

    if (select count(*) from public.contas c where c.igreja_id = new.igreja_id and c.ativa) >= 5 then
      raise exception 'Limite de 5 contas ativas por igreja' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Um registro nunca muda de igreja.
create function public.impedir_troca_de_igreja()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.igreja_id <> old.igreja_id then
    raise exception 'Um registro não pode mudar de igreja' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger contas_a_igreja_fixa
  before update on public.contas
  for each row execute function public.impedir_troca_de_igreja();

create trigger contas_b_limite
  before insert or update on public.contas
  for each row execute function public.limitar_contas_ativas();

create trigger contas_atualizado_em
  before update on public.contas
  for each row execute function public.definir_atualizado_em();


-- -----------------------------------------------------------------------------
-- auditoria (log da igreja; gravado só por triggers)
-- -----------------------------------------------------------------------------

create table public.auditoria (
  id bigint generated always as identity primary key,
  igreja_id uuid references public.igrejas (id),
  usuario_id uuid,
  perfil text,              -- membro, tesoureiro, administrador, admin_master, usuario ou sistema
  acao text not null,       -- insert, update ou delete
  tabela text not null,
  registro_id uuid,
  antes jsonb,
  depois jsonb,
  motivo text,              -- justificativa (cancelamento, reabertura...), quando houver
  criado_em timestamptz not null default now()
);

create index auditoria_igreja_data on public.auditoria (igreja_id, criado_em desc);

comment on table public.auditoria is 'Log imutável: sem UPDATE, DELETE ou TRUNCATE para ninguém.';

-- Grava antes/depois de cada alteração. O motivo vem da configuração local
-- "app.motivo", que as funções de negócio definem quando há justificativa.
create function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_registro jsonb := coalesce(v_depois, v_antes);
  v_igreja_id uuid;
  v_usuario_id uuid := auth.uid();
  v_perfil text;
begin
  -- Ignora atualizações que só mexem em controles internos.
  if tg_op = 'UPDATE'
     and (v_antes - 'atualizado_em' - 'proximo_numero_dizimista')
       = (v_depois - 'atualizado_em' - 'proximo_numero_dizimista') then
    return null;
  end if;

  v_igreja_id := case
    when tg_table_name = 'igrejas' then (v_registro ->> 'id')::uuid
    else (v_registro ->> 'igreja_id')::uuid
  end;

  v_perfil := case
    when v_usuario_id is null then 'sistema'
    when public.eh_admin_master() then 'admin_master'
    else coalesce(public.perfil_na_igreja(v_igreja_id)::text, 'usuario')
  end;

  insert into public.auditoria (igreja_id, usuario_id, perfil, acao, tabela, registro_id, antes, depois, motivo)
  values (
    v_igreja_id,
    v_usuario_id,
    v_perfil,
    lower(tg_op),
    tg_table_name,
    (v_registro ->> 'id')::uuid,
    v_antes,
    v_depois,
    nullif(current_setting('app.motivo', true), '')
  );

  return null;
end;
$$;

create function public.impedir_alteracao_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A auditoria não pode ser alterada nem apagada' using errcode = '42501';
end;
$$;

create trigger auditoria_imutavel
  before update or delete on public.auditoria
  for each row execute function public.impedir_alteracao_auditoria();

create trigger auditoria_sem_truncate
  before truncate on public.auditoria
  for each statement execute function public.impedir_alteracao_auditoria();

create trigger igrejas_auditoria
  after insert or update or delete on public.igrejas
  for each row execute function public.registrar_auditoria();

create trigger membros_auditoria
  after insert or update or delete on public.membros
  for each row execute function public.registrar_auditoria();

create trigger contas_auditoria
  after insert or update or delete on public.contas
  for each row execute function public.registrar_auditoria();


-- -----------------------------------------------------------------------------
-- Permissões das tabelas
--
-- anon (sem login) não acessa nada. Ninguém do app apaga registros.
-- -----------------------------------------------------------------------------

revoke all on public.igrejas, public.membros, public.contas, public.auditoria from anon;
revoke delete, truncate on public.igrejas, public.membros, public.contas from authenticated;
revoke all on public.auditoria from authenticated, service_role;
grant select on public.auditoria to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.igrejas enable row level security;
alter table public.membros enable row level security;
alter table public.contas enable row level security;
alter table public.auditoria enable row level security;

-- igrejas: cada um vê só as igrejas a que está vinculado.
create policy igrejas_select on public.igrejas
  for select to authenticated
  using (public.eh_vinculado(id) or public.eh_admin_master());

create policy igrejas_insert on public.igrejas
  for insert to authenticated
  with check (public.eh_admin_master());

create policy igrejas_update on public.igrejas
  for update to authenticated
  using (public.eh_administrador(id) or public.eh_admin_master())
  with check (public.eh_administrador(id) or public.eh_admin_master());

-- membros: o membro vê só o próprio registro; a tesouraria vê os da sua igreja (D-057).
create policy membros_select on public.membros
  for select to authenticated
  using (
    (usuario_id = (select auth.uid()) and status <> 'inativo')
    or public.eh_tesouraria(igreja_id)
    or public.eh_admin_master()
  );

create policy membros_insert on public.membros
  for insert to authenticated
  with check (public.eh_tesouraria(igreja_id) or public.eh_admin_master());

create policy membros_update on public.membros
  for update to authenticated
  using (
    (usuario_id = (select auth.uid()) and status <> 'inativo')
    or public.eh_tesouraria(igreja_id)
    or public.eh_admin_master()
  )
  with check (
    (usuario_id = (select auth.uid()) and status <> 'inativo')
    or public.eh_tesouraria(igreja_id)
    or public.eh_admin_master()
  );

-- contas: membros veem as ativas (aba Igreja); tesouraria vê todas; só o
-- Pastor de Governo cadastra e altera.
create policy contas_select on public.contas
  for select to authenticated
  using (
    (ativa and public.eh_vinculado(igreja_id))
    or public.eh_tesouraria(igreja_id)
    or public.eh_admin_master()
  );

create policy contas_insert on public.contas
  for insert to authenticated
  with check (public.eh_administrador(igreja_id));

create policy contas_update on public.contas
  for update to authenticated
  using (public.eh_administrador(igreja_id))
  with check (public.eh_administrador(igreja_id));

-- auditoria: o log da igreja é do Pastor de Governo (P-04); o global, do Admin Master.
create policy auditoria_select on public.auditoria
  for select to authenticated
  using (public.eh_administrador(igreja_id) or public.eh_admin_master());
