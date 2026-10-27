-- Avisos, parte 2: envio do push para a tela do celular (D-096).
--
-- Caminho: um aviso novo em notificacoes chama a Edge Function enviar-push
-- (pg_net, depois do commit), que reserva os avisos pendentes, manda pelo
-- serviço de push do Expo e devolve o resultado. Um relógio (pg_cron) chama
-- a função de novo a cada minuto para as novas tentativas.
--
-- Endereço e segredo da função ficam no Vault (cofre do Supabase), nunca no
-- código: url_do_envio_de_push e segredo_do_envio_de_push. Sem eles (ex.: na
-- nuvem antes de configurar), nada é chamado e os avisos seguem no sino.

create extension if not exists pg_net;

-- Última tentativa: a próxima espera 2 minutos, para duas chamadas da função
-- ao mesmo tempo não mandarem o mesmo aviso duas vezes.
alter table public.notificacoes add column push_tentado_em timestamptz;


-- -----------------------------------------------------------------------------
-- Usadas só pela Edge Function (chave service_role)
-- -----------------------------------------------------------------------------

-- Reserva os avisos a enviar e devolve o que a função precisa para montar o
-- texto. Fica de fora o aviso já lido no app, o de mais de um dia (chegaria
-- fora de hora) e o que já falhou 3 vezes.
create function public.reservar_avisos_para_push(p_limite integer default 100)
returns table (
  id uuid,
  igreja_id uuid,
  tipo text,
  dados jsonb,
  igreja_nome text,
  titulo_administrador text,
  idioma text,
  tokens text[]
)
language sql
security definer
set search_path = ''
as $$
  with escolhidos as (
    select n.id
      from public.notificacoes n
     where n.push_enviado_em is null
       and n.lida_em is null
       and n.push_tentativas < 3
       and n.criado_em > now() - interval '1 day'
       and (n.push_tentado_em is null or n.push_tentado_em < now() - interval '2 minutes')
     order by n.criado_em
     limit p_limite
     for update skip locked
  ),
  reservados as (
    update public.notificacoes n
       set push_tentativas = n.push_tentativas + 1,
           push_tentado_em = now()
      from escolhidos e
     where n.id = e.id
    returning n.id, n.igreja_id, n.usuario_id, n.tipo, n.dados
  )
  select r.id, r.igreja_id, r.tipo, r.dados, i.nome, i.titulo_administrador, i.idioma,
         array(
           select d.token
             from public.dispositivos d
            where d.usuario_id = r.usuario_id
              and d.ativo
         )
    from reservados r
    join public.igrejas i on i.id = r.igreja_id;
$$;

-- Resultado do envio: [{id, ok, erro}]. Sem aparelho não há o que tentar de
-- novo. Aparelho que o serviço diz não existir mais (app desinstalado) deixa
-- de receber.
create function public.concluir_envio_de_push(p_resultados jsonb, p_tokens_invalidos text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notificacoes n
     set push_enviado_em = case when (r.valor ->> 'ok')::boolean then now() end,
         push_erro = r.valor ->> 'erro',
         push_tentativas = case when r.valor ->> 'erro' = 'sem_aparelho' then 3 else n.push_tentativas end
    from jsonb_array_elements(p_resultados) as r(valor)
   where n.id = (r.valor ->> 'id')::uuid;

  update public.dispositivos
     set ativo = false
   where token = any(p_tokens_invalidos)
     and ativo;
end;
$$;

revoke execute on function public.reservar_avisos_para_push(integer) from public, anon, authenticated;
revoke execute on function public.concluir_envio_de_push(jsonb, text[]) from public, anon, authenticated;
grant execute on function public.reservar_avisos_para_push(integer) to service_role;
grant execute on function public.concluir_envio_de_push(jsonb, text[]) to service_role;


-- -----------------------------------------------------------------------------
-- Chamar a Edge Function
-- -----------------------------------------------------------------------------

-- Nunca atrapalha quem gerou o aviso: sem configuração ou com qualquer erro,
-- só não chama (o relógio tenta de novo).
create function public.disparar_envio_de_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'url_do_envio_de_push';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'segredo_do_envio_de_push';
  if v_url is null or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo-do-envio', v_segredo),
    timeout_milliseconds := 30000
  );
exception when others then
  raise warning 'disparar_envio_de_push: %', sqlerrm;
end;
$$;

revoke execute on function public.disparar_envio_de_push() from public, anon, authenticated;

-- Um aviso de campanha nova cria um aviso por membro num só comando: a
-- função é chamada uma vez por comando, não uma por aviso.
create function public.notificacoes_disparar_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.disparar_envio_de_push();
  return null;
end;
$$;

create trigger notificacoes_z_push
  after insert on public.notificacoes
  for each statement execute function public.notificacoes_disparar_push();

-- Novas tentativas: só chama a função se houver o que enviar.
select cron.schedule(
  'enviar-push-pendente',
  '* * * * *',
  $$
    select public.disparar_envio_de_push()
     where exists (
       select 1
         from public.notificacoes
        where push_enviado_em is null
          and lida_em is null
          and push_tentativas < 3
          and criado_em > now() - interval '1 day'
          and (push_tentado_em is null or push_tentado_em < now() - interval '2 minutes')
     );
  $$
);
