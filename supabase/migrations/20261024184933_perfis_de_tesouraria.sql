-- Perfis da tesouraria (P-01, D-068 e D-090).
--
-- O Pastor de Governo autoriza (membro -> tesoureiro) e suspende
-- (tesoureiro -> membro) tesoureiros. O suspenso volta a ser membro: perde
-- a tesouraria na hora e continua com o próprio Cartão.
--
-- Fecha uma brecha: antes, um Pastor de Governo conseguia rebaixar outro
-- Pastor, ou a si mesmo. Agora tudo que envolve o perfil de administrador
-- (dar ou tirar) é só do Admin Master, ninguém muda o próprio perfil e
-- ficha inativa não recebe perfil novo.
-- Igual à versão de 20261024165428, mudando só o bloco do perfil.

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

  return new;
end;
$$;
