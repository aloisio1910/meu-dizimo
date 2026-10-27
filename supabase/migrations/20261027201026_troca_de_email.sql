-- Troca de e-mail pela tesouraria (D-097, substitui a D-069).
--
-- Perder o acesso ao e-mail é comum. A tesouraria (tesoureiro ou Pastor de
-- Governo) troca o e-mail de membros e de outros tesoureiros, com motivo.
-- Ninguém troca o próprio; o do Pastor de Governo e o de quem também está em
-- outra igreja, só pelo suporte (Admin Master).
--
-- O e-mail de quem já entrou é o login do Supabase Auth, que só se troca com
-- a chave service_role. Por isso a troca passa pela Edge Function
-- trocar-email: ela confere quem pediu (o login), chama as funções abaixo
-- em nome dessa pessoa e troca o login. O app nunca as chama direto.

alter table public.notificacoes drop constraint notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo in (
  'lancamento_confirmado', 'divergencia_registrada', 'lancamento_reaberto', 'nova_campanha',
  'novo_lancamento', 'novo_comprovante', 'divergencia_contestada', 'pix_alterado', 'email_alterado'
));


-- A Edge Function age em nome de quem pediu: com isto, auth.uid() devolve
-- essa pessoa (permissões e auditoria) até o fim da transação.
create function public.agir_como(p_usuario uuid)
returns void
language sql
set search_path = ''
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_usuario, 'role', 'authenticated')::text,
    true
  );
$$;

revoke execute on function public.agir_como(uuid) from public, anon, authenticated;


-- Confere as regras e troca o e-mail da ficha (com o motivo na auditoria).
-- Devolve o que a função precisa para trocar o login e avisar a pessoa.
create function public.trocar_email_do_membro(p_autor uuid, p_membro_id uuid, p_email text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.membros;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  perform public.agir_como(p_autor);

  select * into v_membro from public.membros where id = p_membro_id for update;
  if not found or not public.eh_tesouraria(v_membro.igreja_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if v_membro.usuario_id = p_autor then
    raise exception 'email_proprio' using errcode = '42501';
  end if;
  if v_membro.perfil = 'administrador' then
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
  if exists (select 1 from public.membros m where m.igreja_id = v_membro.igreja_id and m.email = v_email) then
    raise exception 'email_ja_cadastrado' using errcode = '23505';
  end if;
  -- Juntar duas contas é com o suporte.
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'email_ja_tem_login' using errcode = '23505';
  end if;
  -- O login vale para todas as igrejas da pessoa: uma igreja não decide pelas outras.
  if v_membro.usuario_id is not null
     and exists (
       select 1 from public.membros m
        where m.usuario_id = v_membro.usuario_id
          and m.igreja_id <> v_membro.igreja_id
     ) then
    raise exception 'esta_em_outra_igreja' using errcode = '42501';
  end if;

  perform set_config('app.motivo', v_motivo, true);
  update public.membros set email = v_email where id = p_membro_id;
  perform set_config('app.motivo', '', true);

  return jsonb_build_object(
    'usuario_id', v_membro.usuario_id,
    'email_antigo', v_membro.email,
    'nome', v_membro.nome,
    'igreja_nome', (select i.nome from public.igrejas i where i.id = v_membro.igreja_id),
    'titulo_administrador', (select i.titulo_administrador from public.igrejas i where i.id = v_membro.igreja_id)
  );
end;
$$;

-- Se a troca do login falhar, a ficha volta ao e-mail de antes.
create function public.desfazer_troca_de_email(p_autor uuid, p_membro_id uuid, p_email_antigo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.agir_como(p_autor);
  perform set_config('app.motivo', 'falha_ao_trocar_o_login', true);
  update public.membros set email = p_email_antigo where id = p_membro_id;
  perform set_config('app.motivo', '', true);
end;
$$;

-- Aviso no celular da pessoa (não desliga), depois de o login já ter mudado.
create function public.avisar_troca_de_email(p_membro_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.avisar_ficha(p_membro_id, 'email_alterado', jsonb_build_object('email', m.email))
    from public.membros m
   where m.id = p_membro_id;
$$;

revoke execute on function public.trocar_email_do_membro(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.desfazer_troca_de_email(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.avisar_troca_de_email(uuid) from public, anon, authenticated;
grant execute on function public.trocar_email_do_membro(uuid, uuid, text, text) to service_role;
grant execute on function public.desfazer_troca_de_email(uuid, uuid, text) to service_role;
grant execute on function public.avisar_troca_de_email(uuid) to service_role;


-- Pelo app, o e-mail da ficha só muda pela troca acima (com motivo). Antes,
-- a tesouraria podia corrigir o de convidado direto na tabela (D-069).
create function public.exigir_troca_de_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- As funções da troca (security definer) e a sincronização com o login
  -- rodam como dono do banco e passam direto.
  if new.email is distinct from old.email and current_user = 'authenticated' then
    raise exception 'use_a_troca_de_email' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger membros_a0_exigir_troca_de_email
  before update of email on public.membros
  for each row execute function public.exigir_troca_de_email();
