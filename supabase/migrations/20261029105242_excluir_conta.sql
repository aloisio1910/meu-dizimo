-- Excluir a conta pelo app (exigido pela Apple, regra 5.1.1(v), e pela
-- Google). Decisões do desenvolvedor (29/10/2026):
-- - na hora, com dupla confirmação (digitar EXCLUIR);
-- - em todas as igrejas da pessoa, os dados pessoais são apagados (nome,
--   e-mail, celular, respostas do cadastro, familiares, anotações da
--   tesouraria); a ficha vira "Membro excluído" e fica inativa;
-- - os lançamentos e os comprovantes ficam com a igreja, sem o nome
--   (contabilidade e prestação de contas; LGPD, art. 16, I);
-- - o Pastor de Governo só exclui depois que o suporte definir outro.
--
-- O login não é apagado de verdade, porque lançamentos, convites e o log
-- apontam para ele: a Edge Function excluir-conta usa a exclusão com
-- anonimização do próprio Supabase Auth, que tira o e-mail e impede o login.

alter table public.membros add column excluido_em timestamptz;

comment on column public.membros.excluido_em is
  'Quando a pessoa excluiu a conta: os dados pessoais da ficha foram apagados (anonimização).';


-- O log da exclusão não pode guardar de novo o que acabou de ser apagado:
-- nessa hora ele registra só que a ficha foi anonimizada.
create or replace function public.registrar_auditoria()
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
  v_controles text[] := array[
    'atualizado_em', 'proximo_numero_dizimista',
    'email_enviado_em', 'email_tentativas', 'email_tentado_em', 'email_erro'
  ];
begin
  -- Ignora atualizações que só mexem em controles internos.
  if tg_op = 'UPDATE' and (v_antes - v_controles) = (v_depois - v_controles) then
    return null;
  end if;

  if current_setting('meudizimo.anonimizando', true) = 'sim' then
    v_antes := jsonb_build_object('id', v_registro -> 'id');
    v_depois := jsonb_build_object('id', v_registro -> 'id', 'anonimizado', true);
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


-- Usada só pela Edge Function excluir-conta (chave service_role), depois de
-- conferir o login de quem pede. Devolve quantas fichas foram anonimizadas.
create function public.anonimizar_conta(p_usuario uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantas integer;
begin
  if exists (
    select 1 from auth.users u
     where u.id = p_usuario and coalesce((u.raw_app_meta_data ->> 'admin_master')::boolean, false)
  ) then
    raise exception 'admin_master_pelo_suporte' using errcode = '42501';
  end if;
  -- A igreja nunca fica sem responsável (decisão do desenvolvedor).
  if exists (
    select 1 from public.membros m
     where m.usuario_id = p_usuario and m.perfil = 'administrador' and m.status <> 'inativo'
  ) then
    raise exception 'pastor_precisa_trocar' using errcode = '42501';
  end if;

  perform public.agir_como(p_usuario);
  perform set_config('app.motivo', 'exclusao_de_conta', true);
  perform set_config('meudizimo.anonimizando', 'sim', true);

  update public.membros
     set nome = 'Membro excluído',
         email = 'excluido-' || id || '@excluido.invalid',
         celular = '-',
         tipo_dizimo = 'individual',
         familiares = '[]'::jsonb,
         campos_extras = '{}'::jsonb,
         campos_internos = '{}'::jsonb,
         avisos_desligados = '{}',
         perfil = 'membro',
         status = 'inativo',
         excluido_em = coalesce(excluido_em, now())
   where usuario_id = p_usuario;
  get diagnostics v_quantas = row_count;

  update public.dispositivos set ativo = false where usuario_id = p_usuario and ativo;

  perform set_config('meudizimo.anonimizando', '', true);
  perform set_config('app.motivo', '', true);
  return v_quantas;
end;
$$;

revoke execute on function public.anonimizar_conta(uuid) from public, anon, authenticated;
grant execute on function public.anonimizar_conta(uuid) to service_role;

-- Para a tela de exclusão avisar antes, sem a pessoa tentar à toa.
create function public.sou_pastor_em_alguma_igreja()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
     where m.usuario_id = (select auth.uid()) and m.perfil = 'administrador' and m.status <> 'inativo'
  );
$$;

revoke execute on function public.sou_pastor_em_alguma_igreja() from public, anon;
grant execute on function public.sou_pastor_em_alguma_igreja() to authenticated;

-- Ao anonimizar o login, o Supabase Auth troca o e-mail dele; essa troca não
-- deve voltar para as fichas, que já foram anonimizadas acima.
create or replace function public.sincronizar_email_membros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.membros
     set email = lower(new.email)
   where usuario_id = new.id
     and excluido_em is null
     and email <> lower(new.email);
  return new;
end;
$$;
