-- Campos preenchidos pela tesouraria (P-03, D-093).
--
-- Além dos campos que o membro preenche, a igreja pode ter campos que só o
-- tesoureiro e o Pastor de Governo preenchem, para organizar e agrupar os
-- dizimistas (ex.: célula, setor). O membro vê esses valores no perfil,
-- sem editar (transparência e direito de acesso da LGPD, art. 18).
--
-- As respostas ficam em colunas separadas, para o banco aplicar permissões
-- diferentes: campos_extras (o membro informa; só ele altera) e
-- campos_internos (a tesouraria anota; só ela altera).

alter table public.campos_cadastro
  add column preenchido_por text not null default 'membro'
    check (preenchido_por in ('membro', 'tesouraria'));

-- O membro não é cobrado por um campo que não preenche.
alter table public.campos_cadastro
  add constraint campos_cadastro_tesouraria_nao_obrigatorio
    check (not (preenchido_por = 'tesouraria' and obrigatorio));

comment on column public.campos_cadastro.preenchido_por is
  'Quem preenche: o membro (campos_extras) ou a tesouraria (campos_internos).';

alter table public.membros
  add column campos_internos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(campos_internos) = 'object');

comment on column public.membros.campos_internos is
  'Valores dos campos preenchidos pela tesouraria (D-093); o membro só lê.';


-- Validação dos valores: igual à versão de 20261021214739, separando os
-- campos de quem preenche e incluindo campos_internos.
create or replace function public.validar_dados_cadastrais()
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

  if tg_op = 'UPDATE'
     and new.campos_extras = old.campos_extras
     and new.campos_internos = old.campos_internos
     and new.status = old.status then
    return new;
  end if;

  -- Obrigatórios são cobrados ao ativar o cadastro e sempre que o membro mexe
  -- nos campos extras. Reativar um membro não exige campos criados depois.
  -- Na arrumação feita pelo próprio banco (mover respostas de um campo),
  -- nada é cobrado: ninguém está editando a ficha.
  v_verificar_obrigatorios := new.status = 'ativo'
    and (tg_op = 'INSERT' or new.campos_extras is distinct from old.campos_extras or old.status = 'convidado')
    and coalesce(current_setting('meudizimo.movendo_respostas', true), '') <> 'sim';

  -- Cada valor fica na coluna de quem preenche o campo. Campos desativados
  -- continuam aceitos para não invalidar valores antigos.
  for v_chave in select jsonb_object_keys(new.campos_extras) loop
    if not exists (
      select 1 from public.campos_cadastro c
      where c.igreja_id = new.igreja_id and c.chave = v_chave and c.preenchido_por = 'membro'
    ) then
      raise exception 'campo_desconhecido' using errcode = '22023', detail = v_chave;
    end if;
  end loop;

  for v_chave in select jsonb_object_keys(new.campos_internos) loop
    if not exists (
      select 1 from public.campos_cadastro c
      where c.igreja_id = new.igreja_id and c.chave = v_chave and c.preenchido_por = 'tesouraria'
    ) then
      raise exception 'campo_desconhecido' using errcode = '22023', detail = v_chave;
    end if;
  end loop;

  for v_campo in
    select * from public.campos_cadastro c where c.igreja_id = new.igreja_id and c.ativo
  loop
    v_valor := (case when v_campo.preenchido_por = 'tesouraria' then new.campos_internos else new.campos_extras end)
      -> v_campo.chave;

    if v_valor is null
       or v_valor = 'null'::jsonb
       or (jsonb_typeof(v_valor) = 'string' and length(trim(v_valor #>> '{}')) = 0) then
      if v_campo.obrigatorio and v_campo.preenchido_por = 'membro' and v_verificar_obrigatorios then
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


-- Quem altera o quê na ficha: igual à versão de 20261024184933, com a regra
-- de campos_internos no fim.
create or replace function public.validar_membro()
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
    new.cadastro_concluido_em := null;

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
     or new.criado_em <> old.criado_em
     or new.cadastro_concluido_em is distinct from old.cadastro_concluido_em then
    raise exception 'Campos de identificação do membro não podem ser alterados' using errcode = '42501';
  end if;

  if new.perfil <> old.perfil then
    if not (v_admin_master or public.eh_administrador(old.igreja_id)) then
      raise exception 'so_o_pastor_altera_perfil' using errcode = '42501';
    end if;

    if (new.perfil = 'administrador' or old.perfil = 'administrador') and not v_admin_master then
      raise exception 'so_admin_master_define_pastor' using errcode = '42501';
    end if;

    if old.usuario_id = (select auth.uid()) and not v_admin_master then
      raise exception 'perfil_proprio' using errcode = '42501';
    end if;

    if old.status = 'inativo' then
      raise exception 'membro_inativo' using errcode = '42501';
    end if;
  end if;

  if new.status <> old.status then
    if old.usuario_id = (select auth.uid()) and not v_admin_master then
      raise exception 'status_proprio' using errcode = '42501';
    end if;

    if old.status = 'convidado' and new.status = 'inativo' then
      -- Cancelar convite: quem convida também desfaz o engano.
      if not (v_admin_master or public.eh_tesouraria(old.igreja_id)) then
        raise exception 'so_o_pastor_altera_status' using errcode = '42501';
      end if;
    elsif (old.status = 'ativo' and new.status = 'inativo')
       or (old.status = 'inativo' and new.status = 'ativo' and old.cadastro_concluido_em is not null)
       or (old.status = 'inativo' and new.status = 'convidado' and old.cadastro_concluido_em is null) then
      if not (v_admin_master or public.eh_administrador(old.igreja_id)) then
        raise exception 'so_o_pastor_altera_status' using errcode = '42501';
      end if;
    else
      -- Inclui convidado -> ativo, que acontece só ao concluir o cadastro.
      raise exception 'reativacao_invalida' using errcode = '42501';
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

  -- D-093: os campos da tesouraria são só da tesouraria; o membro só lê.
  if new.campos_internos is distinct from old.campos_internos
     and not (v_admin_master or public.eh_tesouraria(old.igreja_id)) then
    raise exception 'so_a_tesouraria_preenche' using errcode = '42501';
  end if;

  return new;
end;
$$;


-- Quando um campo troca de quem preenche, as respostas já dadas mudam de
-- coluna junto, sem se perder. Roda como dono do banco: é uma arrumação do
-- próprio banco, não uma edição de alguém na ficha.
create function public.mover_respostas_do_campo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('meudizimo.movendo_respostas', 'sim', true);
  if new.preenchido_por = 'tesouraria' then
    update public.membros
       set campos_internos = campos_internos || jsonb_build_object(new.chave, campos_extras -> new.chave),
           campos_extras = campos_extras - new.chave
     where igreja_id = new.igreja_id and campos_extras ? new.chave;
  else
    update public.membros
       set campos_extras = campos_extras || jsonb_build_object(new.chave, campos_internos -> new.chave),
           campos_internos = campos_internos - new.chave
     where igreja_id = new.igreja_id and campos_internos ? new.chave;
  end if;
  perform set_config('meudizimo.movendo_respostas', '', true);
  return new;
end;
$$;

revoke execute on function public.mover_respostas_do_campo() from public, anon, authenticated;

create trigger campos_cadastro_b_mover_respostas
  after update of preenchido_por on public.campos_cadastro
  for each row
  when (old.preenchido_por is distinct from new.preenchido_por)
  execute function public.mover_respostas_do_campo();
