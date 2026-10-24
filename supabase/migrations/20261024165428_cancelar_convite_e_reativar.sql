-- Cancelar convite e reativar membro (D-085).
--
-- Antes, um convidado inativado e depois reativado ia direto para Ativo,
-- sem ter feito o cadastro nem aceitado os termos. Agora o banco guarda
-- quando o cadastro foi concluído e decide para onde a reativação leva:
--   convidado -> inativo   cancelar convite: tesoureiro ou Pastor de Governo
--   ativo     -> inativo   inativar: só o Pastor de Governo
--   inativo   -> ativo     reativar quem concluiu o cadastro: só o Pastor
--   inativo   -> convidado reativar quem nunca concluiu: só o Pastor
-- Ninguém muda o próprio status (o Pastor não se tranca fora por engano).

alter table public.membros add column cadastro_concluido_em timestamptz;

comment on column public.membros.cadastro_concluido_em is
  'Quando o membro concluiu o primeiro acesso; definido só pelo banco (concluir_cadastro).';

-- Ativos e inativos de antes desta coluna já tinham concluído o cadastro.
update public.membros
   set cadastro_concluido_em = criado_em
 where status in ('ativo', 'inativo');

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
      raise exception 'Só o Pastor de Governo altera perfil ou status do membro' using errcode = '42501';
    end if;

    if new.perfil = 'administrador' and old.perfil <> 'administrador' and not v_admin_master then
      raise exception 'Só o Admin Master define o Pastor de Governo' using errcode = '42501';
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

  return new;
end;
$$;

-- Passo 4: igual a antes, agora marcando quando o cadastro foi concluído.
create or replace function public.concluir_cadastro(
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
         status = 'ativo',
         cadastro_concluido_em = now()
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
