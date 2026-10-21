-- =============================================================================
-- Campanhas, mídias, lançamentos (dízimo e oferta) e comprovantes, com os
-- buckets privados do Storage.
--
-- Esta migration cobre o registro: o membro lança, edita e cancela enquanto
-- aguarda conferência; a tesouraria lança em nome do membro (devolução
-- presencial). As transições da conferência (bloqueio, confirmar,
-- divergência, reabrir) ficam na migration seguinte.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

create type public.status_campanha as enum ('rascunho', 'ativa', 'encerrada');
create type public.tipo_lancamento as enum ('dizimo', 'oferta');
create type public.status_lancamento as enum ('aguardando', 'em_conferencia', 'confirmado', 'divergencia', 'cancelado');
create type public.resposta_divergencia as enum ('aceita', 'contestada');
create type public.formato_comprovante as enum ('pdf', 'jpg', 'png');


-- -----------------------------------------------------------------------------
-- Funções auxiliares
-- -----------------------------------------------------------------------------

-- Converte texto em uuid sem erro (usado nos caminhos do Storage).
create function public.uuid_ou_nulo(p_texto text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_texto::uuid;
exception when others then
  return null;
end;
$$;

-- A ficha é do usuário logado e está ativa.
create function public.eh_minha_ficha(p_membro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membros m
    where m.id = p_membro_id
      and m.usuario_id = (select auth.uid())
      and m.status = 'ativo'
  );
$$;

-- Chaves compostas: garantem que conta, campanha e lançamento ligados entre
-- si sejam da mesma igreja.
alter table public.contas add constraint contas_id_igreja unique (id, igreja_id);


-- -----------------------------------------------------------------------------
-- campanhas (RN-038, D-047)
-- -----------------------------------------------------------------------------

create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  nome text not null check (length(trim(nome)) > 0),
  descricao text,
  objetivo text,
  inicio date,
  fim date,
  status public.status_campanha not null default 'rascunho',
  -- A campanha "Oferta" de cada igreja: criada pelo banco, nunca encerra.
  permanente boolean not null default false,
  link_video text check (link_video ~* '^https?://'),
  -- Sem conta escolhida, a oferta vai para a conta principal da igreja.
  conta_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, igreja_id),
  foreign key (conta_id, igreja_id) references public.contas (id, igreja_id),
  constraint campanhas_periodo check (fim is null or inicio is null or fim >= inicio),
  constraint campanhas_permanente_ativa check (not permanente or status = 'ativa')
);

create unique index campanhas_uma_permanente on public.campanhas (igreja_id) where permanente;
create index campanhas_igreja_status on public.campanhas (igreja_id, status);

comment on table public.campanhas is 'Campanhas de oferta; toda igreja tem a permanente "Oferta".';

create function public.proteger_campanha()
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
    return new;
  end if;

  if new.igreja_id <> old.igreja_id or new.permanente <> old.permanente then
    raise exception 'Igreja e tipo da campanha não podem ser alterados' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger campanhas_a_proteger
  before insert or update on public.campanhas
  for each row execute function public.proteger_campanha();

create trigger campanhas_atualizado_em
  before update on public.campanhas
  for each row execute function public.definir_atualizado_em();

create trigger campanhas_auditoria
  after insert or update or delete on public.campanhas
  for each row execute function public.registrar_auditoria();

-- Toda igreja nasce com a campanha permanente "Oferta" (RN-038).
create function public.criar_campanha_permanente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.campanhas (igreja_id, nome, status, permanente)
  values (new.id, 'Oferta', 'ativa', true);
  return null;
end;
$$;

create trigger igrejas_campanha_permanente
  after insert on public.igrejas
  for each row execute function public.criar_campanha_permanente();

-- Igrejas criadas antes desta migration (ambientes de teste).
insert into public.campanhas (igreja_id, nome, status, permanente)
select i.id, 'Oferta', 'ativa', true
from public.igrejas i
where not exists (select 1 from public.campanhas c where c.igreja_id = i.id and c.permanente);


-- -----------------------------------------------------------------------------
-- campanha_midias (artes da campanha; vídeos entram por link, D-053)
-- -----------------------------------------------------------------------------

create table public.campanha_midias (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  campanha_id uuid not null,
  arquivo_path text not null unique,
  ordem integer not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  foreign key (campanha_id, igreja_id) references public.campanhas (id, igreja_id),
  constraint campanha_midias_caminho check (arquivo_path like igreja_id::text || '/' || campanha_id::text || '/%')
);

create trigger campanha_midias_a_igreja_fixa
  before update on public.campanha_midias
  for each row execute function public.impedir_troca_de_igreja();

create trigger campanha_midias_auditoria
  after insert or update or delete on public.campanha_midias
  for each row execute function public.registrar_auditoria();


-- -----------------------------------------------------------------------------
-- lancamentos (dízimo e oferta no mesmo modelo, D-050)
-- -----------------------------------------------------------------------------

create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  membro_id uuid not null,
  tipo public.tipo_lancamento not null,
  campanha_id uuid,
  conta_id uuid,
  -- Dinheiro sempre em centavos (inteiro) com o código da moeda.
  valor_informado_centavos bigint not null check (valor_informado_centavos > 0),
  valor_conferido_centavos bigint check (valor_conferido_centavos > 0),
  moeda char(3) not null,
  data_contribuicao date not null,                       -- data do dízimo (RN-011)
  registrado_em timestamptz not null default now(),       -- data do registro (RN-012)
  forma text not null,
  status public.status_lancamento not null default 'aguardando',
  criado_por uuid references auth.users (id),
  registrado_pela_tesouraria boolean not null default false,   -- RN-033
  -- Conferência simultânea (RN-029)
  em_conferencia_por uuid references auth.users (id),
  em_conferencia_desde timestamptz,
  -- A "assinatura" da confirmação; o nome fica gravado para o membro ver.
  confirmado_por uuid references auth.users (id),
  confirmado_por_nome text,
  confirmado_em timestamptz,
  -- Divergência (RN-018, RN-030)
  observacao_tesouraria text,
  divergencia_em timestamptz,
  resposta_membro public.resposta_divergencia,
  mensagem_membro text,
  respondido_em timestamptz,
  -- Cancelamento (RN-016)
  motivo_cancelamento text,
  cancelado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  unique (id, igreja_id),
  foreign key (membro_id, igreja_id) references public.membros (id, igreja_id),
  foreign key (campanha_id, igreja_id) references public.campanhas (id, igreja_id),
  foreign key (conta_id, igreja_id) references public.contas (id, igreja_id),
  -- RN-038: toda oferta pertence a uma campanha; dízimo não tem campanha.
  constraint lancamentos_oferta_tem_campanha check ((tipo = 'oferta') = (campanha_id is not null)),
  constraint lancamentos_cancelado_tem_motivo check (
    status <> 'cancelado' or (motivo_cancelamento is not null and cancelado_em is not null)
  ),
  constraint lancamentos_confirmado_assinado check (
    status <> 'confirmado' or (confirmado_por is not null and confirmado_em is not null)
  )
);

-- Fila da tesouraria em ordem de chegada (RN-020) e Cartão do membro por data.
create index lancamentos_fila on public.lancamentos (igreja_id, status, registrado_em);
create index lancamentos_membro on public.lancamentos (membro_id, data_contribuicao desc);

comment on table public.lancamentos is 'Dízimos e ofertas registrados; nunca apagados, só mudam de status.';

-- Conta que recebe: dízimo vai para a principal; oferta, para a conta da
-- campanha ou, se ela não tiver, para a principal (D-066).
create function public.conta_de_destino(p_igreja_id uuid, p_campanha_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.conta_id from public.campanhas c where c.id = p_campanha_id and c.igreja_id = p_igreja_id),
    (select ct.id from public.contas ct where ct.igreja_id = p_igreja_id and ct.principal)
  );
$$;

-- Regras de registro e edição pelo app.
create function public.validar_lancamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_usuario_id uuid := (select auth.uid());
  v_membro record;
  v_igreja record;
  v_campanha record;
  -- Únicos campos que o membro edita enquanto aguarda conferência (RN-013).
  v_editaveis text[] := array[
    'valor_informado_centavos', 'data_contribuicao', 'forma', 'campanha_id', 'conta_id', 'atualizado_em'
  ];
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'aguardando' then
      raise exception 'lancamento_bloqueado' using errcode = '42501';
    end if;
    if (to_jsonb(new) - v_editaveis) <> (to_jsonb(old) - v_editaveis) then
      raise exception 'Só valor, data, forma e campanha podem ser editados' using errcode = '42501';
    end if;
  end if;

  -- A ficha precisa estar visível para quem lança (própria ou da tesouraria).
  select m.id, m.usuario_id, m.status into v_membro
  from public.membros m
  where m.id = new.membro_id and m.igreja_id = new.igreja_id;

  if v_membro.id is null or v_membro.status = 'inativo' then
    raise exception 'membro_indisponivel' using errcode = '42501';
  end if;

  select i.moeda, i.formas_devolucao into v_igreja
  from public.igrejas i
  where i.id = new.igreja_id;

  if not (new.forma = any (v_igreja.formas_devolucao)) then
    raise exception 'forma_invalida' using errcode = '22023';
  end if;

  if new.data_contribuicao > current_date then
    raise exception 'data_futura' using errcode = '22023';
  end if;

  if new.tipo = 'oferta' and (tg_op = 'INSERT' or new.campanha_id is distinct from old.campanha_id) then
    select c.id, c.status into v_campanha
    from public.campanhas c
    where c.id = new.campanha_id and c.igreja_id = new.igreja_id;

    if v_campanha.id is null or v_campanha.status <> 'ativa' then
      raise exception 'campanha_indisponivel' using errcode = '22023';
    end if;
  end if;

  new.conta_id := public.conta_de_destino(new.igreja_id, new.campanha_id);

  if tg_op = 'INSERT' then
    -- Campos definidos pelo banco, não pelo app.
    new.moeda := v_igreja.moeda;
    new.criado_por := v_usuario_id;
    new.registrado_em := now();
    new.valor_conferido_centavos := null;
    new.em_conferencia_por := null;
    new.em_conferencia_desde := null;
    new.observacao_tesouraria := null;
    new.divergencia_em := null;
    new.resposta_membro := null;
    new.mensagem_membro := null;
    new.respondido_em := null;
    new.motivo_cancelamento := null;
    new.cancelado_em := null;

    if v_membro.usuario_id = v_usuario_id then
      -- O próprio membro registra: vai para a fila (passo 6 do fluxo).
      -- Vale também para tesoureiro e Pastor de Governo (RN-034).
      new.status := 'aguardando';
      new.registrado_pela_tesouraria := false;
      new.confirmado_por := null;
      new.confirmado_por_nome := null;
      new.confirmado_em := null;
    elsif public.eh_tesouraria(new.igreja_id) then
      -- Devolução presencial: já nasce confirmada (RN-033).
      new.status := 'confirmado';
      new.registrado_pela_tesouraria := true;
      new.confirmado_por := v_usuario_id;
      new.confirmado_em := now();
      new.confirmado_por_nome := (
        select m.nome from public.membros m
        where m.igreja_id = new.igreja_id and m.usuario_id = v_usuario_id
      );
    else
      raise exception 'membro_indisponivel' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger lancamentos_a_validar
  before insert or update on public.lancamentos
  for each row execute function public.validar_lancamento();

create trigger lancamentos_atualizado_em
  before update on public.lancamentos
  for each row execute function public.definir_atualizado_em();

create trigger lancamentos_auditoria
  after insert or update or delete on public.lancamentos
  for each row execute function public.registrar_auditoria();


-- -----------------------------------------------------------------------------
-- comprovantes (sempre ligados a um lançamento; arquivo no bucket privado)
-- -----------------------------------------------------------------------------

create table public.comprovantes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas (id),
  lancamento_id uuid not null,
  -- Caminho no bucket "comprovantes": <igreja_id>/<lancamento_id>/<arquivo>
  arquivo_path text not null unique,
  formato public.formato_comprovante not null,
  enviado_por uuid references auth.users (id),
  enviado_em timestamptz not null default now(),
  foreign key (lancamento_id, igreja_id) references public.lancamentos (id, igreja_id),
  constraint comprovantes_caminho check (arquivo_path like igreja_id::text || '/' || lancamento_id::text || '/%')
);

create index comprovantes_lancamento on public.comprovantes (lancamento_id);

create function public.preparar_comprovante()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if not exists (
      select 1 from public.lancamentos l
      where l.id = new.lancamento_id and l.status <> 'cancelado'
    ) then
      raise exception 'lancamento_indisponivel' using errcode = '42501';
    end if;

    new.enviado_por := (select auth.uid());
    new.enviado_em := now();
  end if;

  return new;
end;
$$;

create trigger comprovantes_a_preparar
  before insert on public.comprovantes
  for each row execute function public.preparar_comprovante();

create trigger comprovantes_auditoria
  after insert or update or delete on public.comprovantes
  for each row execute function public.registrar_auditoria();


-- -----------------------------------------------------------------------------
-- Funções chamadas pelo app (RPC)
-- -----------------------------------------------------------------------------

-- RN-032: o app pergunta antes de registrar o mesmo valor na mesma data.
create function public.existe_lancamento_igual(
  p_membro_id uuid,
  p_tipo public.tipo_lancamento,
  p_valor_centavos bigint,
  p_data date
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.lancamentos l
    where l.membro_id = p_membro_id
      and l.tipo = p_tipo
      and l.valor_informado_centavos = p_valor_centavos
      and l.data_contribuicao = p_data
      and l.status <> 'cancelado'
  );
$$;

-- RN-015 e RN-016: o membro cancela o próprio lançamento pendente, com motivo.
create function public.cancelar_lancamento(p_lancamento_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo_obrigatorio' using errcode = '23502';
  end if;

  perform set_config('app.motivo', trim(p_motivo), true);

  update public.lancamentos l
     set status = 'cancelado',
         motivo_cancelamento = trim(p_motivo),
         cancelado_em = now()
   where l.id = p_lancamento_id
     and l.status = 'aguardando'
     and public.eh_minha_ficha(l.membro_id);

  if not found then
    raise exception 'lancamento_bloqueado' using errcode = '42501';
  end if;

  perform set_config('app.motivo', '', true);
end;
$$;


-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------

revoke all on public.campanhas, public.campanha_midias, public.lancamentos, public.comprovantes from anon;
revoke delete, truncate on public.campanhas, public.campanha_midias, public.lancamentos, public.comprovantes from authenticated;
revoke update on public.comprovantes from authenticated;

revoke execute on function
  public.existe_lancamento_igual(uuid, public.tipo_lancamento, bigint, date),
  public.cancelar_lancamento(uuid, text)
from public, anon;

grant execute on function
  public.existe_lancamento_igual(uuid, public.tipo_lancamento, bigint, date),
  public.cancelar_lancamento(uuid, text)
to authenticated;


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.campanhas enable row level security;
alter table public.campanha_midias enable row level security;
alter table public.lancamentos enable row level security;
alter table public.comprovantes enable row level security;

-- campanhas: o membro vê as ativas e as encerradas (histórico); rascunhos só a
-- tesouraria. Só o Pastor de Governo cria e altera.
create policy campanhas_select on public.campanhas
  for select to authenticated
  using (
    (status <> 'rascunho' and public.eh_vinculado(igreja_id))
    or public.eh_tesouraria(igreja_id)
    or public.eh_admin_master()
  );

create policy campanhas_insert on public.campanhas
  for insert to authenticated
  with check (public.eh_administrador(igreja_id));

create policy campanhas_update on public.campanhas
  for update to authenticated
  using (public.eh_administrador(igreja_id))
  with check (public.eh_administrador(igreja_id));

-- campanha_midias: segue a visibilidade da campanha.
create policy campanha_midias_select on public.campanha_midias
  for select to authenticated
  using (exists (select 1 from public.campanhas c where c.id = campanha_id));

create policy campanha_midias_insert on public.campanha_midias
  for insert to authenticated
  with check (public.eh_administrador(igreja_id));

create policy campanha_midias_update on public.campanha_midias
  for update to authenticated
  using (public.eh_administrador(igreja_id))
  with check (public.eh_administrador(igreja_id));

-- lancamentos: o membro vê e registra os próprios; a tesouraria vê todos da
-- igreja e lança em nome do membro. A conferência usa funções próprias.
create policy lancamentos_select on public.lancamentos
  for select to authenticated
  using (
    public.eh_minha_ficha(membro_id)
    or public.eh_tesouraria(igreja_id)
    or public.eh_admin_master()
  );

create policy lancamentos_insert on public.lancamentos
  for insert to authenticated
  with check (public.eh_minha_ficha(membro_id) or public.eh_tesouraria(igreja_id));

create policy lancamentos_update on public.lancamentos
  for update to authenticated
  using (public.eh_minha_ficha(membro_id))
  with check (public.eh_minha_ficha(membro_id));

-- comprovantes: só o dono do lançamento e a tesouraria da igreja (seção 10).
create policy comprovantes_select on public.comprovantes
  for select to authenticated
  using (
    public.eh_tesouraria(igreja_id)
    or exists (select 1 from public.lancamentos l where l.id = lancamento_id and public.eh_minha_ficha(l.membro_id))
    or public.eh_admin_master()
  );

create policy comprovantes_insert on public.comprovantes
  for insert to authenticated
  with check (
    public.eh_tesouraria(igreja_id)
    or exists (select 1 from public.lancamentos l where l.id = lancamento_id and public.eh_minha_ficha(l.membro_id))
  );


-- -----------------------------------------------------------------------------
-- Storage: buckets privados, acessados por links temporários (signed URLs)
--
--   comprovantes: <igreja_id>/<lancamento_id>/<arquivo>  (PDF, JPG, PNG; 10 MB)
--   campanhas:    <igreja_id>/<campanha_id>/<arquivo>    (artes; 5 MB)
--   igrejas:      <igreja_id>/<arquivo>                  (logo e capa; 5 MB)
--
-- Nenhum arquivo é alterado ou apagado pelo app: não há políticas de
-- UPDATE ou DELETE.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('comprovantes', 'comprovantes', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('campanhas', 'campanhas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('igrejas', 'igrejas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy comprovantes_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and exists (
      select 1 from public.lancamentos l
      where l.id = public.uuid_ou_nulo((storage.foldername(name))[2])
        and l.igreja_id = public.uuid_ou_nulo((storage.foldername(name))[1])
    )
  );

create policy comprovantes_enviar on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprovantes'
    and exists (
      select 1 from public.lancamentos l
      where l.id = public.uuid_ou_nulo((storage.foldername(name))[2])
        and l.igreja_id = public.uuid_ou_nulo((storage.foldername(name))[1])
        and l.status <> 'cancelado'
        and (public.eh_tesouraria(l.igreja_id) or public.eh_minha_ficha(l.membro_id))
    )
  );

create policy campanhas_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'campanhas'
    and exists (
      select 1 from public.campanhas c
      where c.id = public.uuid_ou_nulo((storage.foldername(name))[2])
        and c.igreja_id = public.uuid_ou_nulo((storage.foldername(name))[1])
    )
  );

create policy campanhas_enviar on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'campanhas'
    and public.eh_administrador(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );

create policy igrejas_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'igrejas'
    and (
      public.eh_vinculado(public.uuid_ou_nulo((storage.foldername(name))[1]))
      or public.eh_admin_master()
    )
  );

create policy igrejas_enviar on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'igrejas'
    and public.eh_administrador(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );
