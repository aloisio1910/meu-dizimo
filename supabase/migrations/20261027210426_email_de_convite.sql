-- E-mail de convite (passo 2 do fluxo principal, RN-027).
--
-- Cada convite novo (convidar ou reenviar) chama a Edge Function
-- enviar-convites, que manda o e-mail com o nome da igreja, como instalar o
-- app e com que e-mail entrar. Mesmo caminho do push (D-096): pg_net depois
-- do commit, novas tentativas pelo pg_cron, até 3.
--
-- Também junta o segredo das funções internas num só: o banco usa o mesmo
-- segredo para chamar o envio do push e o dos convites.

alter table public.convites
  add column email_enviado_em timestamptz,
  add column email_tentativas integer not null default 0,
  add column email_tentado_em timestamptz,
  add column email_erro text;

-- Convites feitos antes deste envio existir não recebem e-mail agora, de
-- surpresa: quem precisar, a tesouraria reenvia.
update public.convites
   set email_tentativas = 3, email_erro = 'antes_do_envio_de_email'
 where email_enviado_em is null
   and aceito_em is null;


-- -----------------------------------------------------------------------------
-- A auditoria ignora os controles do envio (como já ignorava atualizado_em):
-- senão, cada tentativa de e-mail apareceria no log como mudança no convite.
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- Chamar uma Edge Function interna (endereço e segredo no Vault)
-- -----------------------------------------------------------------------------

-- Nunca atrapalha quem gerou o evento: sem configuração ou com qualquer erro,
-- só não chama (o relógio tenta de novo).
create function public.chamar_funcao_interna(p_nome_da_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = p_nome_da_url;
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'segredo_das_funcoes';
  if v_url is null or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo-das-funcoes', v_segredo),
    timeout_milliseconds := 30000
  );
exception when others then
  raise warning 'chamar_funcao_interna(%): %', p_nome_da_url, sqlerrm;
end;
$$;

revoke execute on function public.chamar_funcao_interna(text) from public, anon, authenticated;

create or replace function public.disparar_envio_de_push()
returns void
language sql
security definer
set search_path = ''
as $$
  select public.chamar_funcao_interna('url_do_envio_de_push');
$$;


-- -----------------------------------------------------------------------------
-- Usadas só pela Edge Function enviar-convites (chave service_role)
-- -----------------------------------------------------------------------------

-- Só o convite mais recente de cada pessoa ainda convidada, em validade e não
-- aceito. Um reenvio torna o anterior sem efeito: não manda os dois.
create function public.reservar_convites_para_email(p_limite integer default 50)
returns table (
  id uuid,
  email text,
  nome text,
  igreja_nome text,
  expira_em timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with escolhidos as (
    select c.id
      from public.convites c
      join public.membros m on m.id = c.membro_id
     where c.email_enviado_em is null
       and c.aceito_em is null
       and c.expira_em > now()
       and c.email_tentativas < 3
       and (c.email_tentado_em is null or c.email_tentado_em < now() - interval '2 minutes')
       and m.status = 'convidado'
       and not exists (
         select 1 from public.convites mais_novo
          where mais_novo.membro_id = c.membro_id
            and mais_novo.enviado_em > c.enviado_em
       )
     order by c.enviado_em
     limit p_limite
     for update of c skip locked
  ),
  reservados as (
    update public.convites c
       set email_tentativas = c.email_tentativas + 1,
           email_tentado_em = now()
      from escolhidos e
     where c.id = e.id
    returning c.id, c.membro_id, c.igreja_id, c.expira_em
  )
  select r.id, m.email, m.nome, i.nome, r.expira_em
    from reservados r
    join public.membros m on m.id = r.membro_id
    join public.igrejas i on i.id = r.igreja_id;
$$;

-- Resultado: [{id, ok, erro}].
create function public.concluir_envio_de_convites(p_resultados jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.convites c
     set email_enviado_em = case when (r.valor ->> 'ok')::boolean then now() end,
         email_erro = r.valor ->> 'erro'
    from jsonb_array_elements(p_resultados) as r(valor)
   where c.id = (r.valor ->> 'id')::uuid
     and c.aceito_em is null;
$$;

revoke execute on function public.reservar_convites_para_email(integer) from public, anon, authenticated;
revoke execute on function public.concluir_envio_de_convites(jsonb) from public, anon, authenticated;
grant execute on function public.reservar_convites_para_email(integer) to service_role;
grant execute on function public.concluir_envio_de_convites(jsonb) to service_role;


-- -----------------------------------------------------------------------------
-- Disparos
-- -----------------------------------------------------------------------------

create function public.convites_disparar_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.chamar_funcao_interna('url_do_envio_de_convites');
  return null;
end;
$$;

create trigger convites_z_email
  after insert on public.convites
  for each statement execute function public.convites_disparar_email();

-- Novas tentativas: só chama a função se houver o que enviar (mesma regra
-- da reserva: o convite mais recente de quem ainda é convidado).
select cron.schedule(
  'enviar-convites-pendentes',
  '* * * * *',
  $$
    select public.chamar_funcao_interna('url_do_envio_de_convites')
     where exists (
       select 1
         from public.convites c
         join public.membros m on m.id = c.membro_id
        where c.email_enviado_em is null
          and c.aceito_em is null
          and c.expira_em > now()
          and c.email_tentativas < 3
          and (c.email_tentado_em is null or c.email_tentado_em < now() - interval '2 minutes')
          and m.status = 'convidado'
          and not exists (
            select 1 from public.convites mais_novo
             where mais_novo.membro_id = c.membro_id
               and mais_novo.enviado_em > c.enviado_em
          )
     );
  $$
);
