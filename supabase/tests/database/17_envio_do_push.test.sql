-- Testes do envio do push (D-096): o que a Edge Function reserva, como o
-- resultado volta ao banco e quem pode chamar essas funções.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Maria (membro, com celular), Rui (membro, sem celular)

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

create function pg_temp.entrar(p_usuario uuid)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_usuario, 'role', 'authenticated')::text,
    true
  );
$$;

-- Avisos do banco de desenvolvimento ficam fora deste teste.
update public.notificacoes set push_enviado_em = now() where push_enviado_em is null;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'rui@a.test');

insert into public.igrejas (id, nome, titulo_administrador) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A', 'Pastor Presidente');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'Rui', 'rui@a.test', '4', 'membro', 'ativo');

insert into public.dispositivos (usuario_id, token, plataforma) values
  ('a0000000-0000-0000-0000-000000000003', 'ExponentPushToken[maria-1]', 'android'),
  ('a0000000-0000-0000-0000-000000000003', 'ExponentPushToken[maria-2]', 'android');
insert into public.dispositivos (usuario_id, token, plataforma, ativo) values
  ('a0000000-0000-0000-0000-000000000003', 'ExponentPushToken[maria-antigo]', 'android', false);

insert into public.notificacoes (id, igreja_id, usuario_id, tipo, dados, criado_em, lida_em, push_tentativas) values
  -- a enviar
  ('6a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'nova_campanha', '{"campanha_nome": "Missões"}', now(), null, 0),
  ('6a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'nova_campanha', '{"campanha_nome": "Missões"}', now(), null, 0),
  -- fora: já lido no app, velho demais, tentativas esgotadas
  ('6a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'nova_campanha', '{}', now(), now(), 0),
  ('6a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'nova_campanha', '{}', now() - interval '2 days', null, 0),
  ('6a000000-0000-0000-0000-000000000005', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'nova_campanha', '{}', now(), null, 3);


-- -----------------------------------------------------------------------------
-- Só a Edge Function (service_role) usa estas funções
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ select * from public.reservar_avisos_para_push() $$,
  '42501', null,
  'Membro não consegue reservar avisos'
);
select throws_ok(
  $$ select public.concluir_envio_de_push('[]', '{}') $$,
  '42501', null,
  'Membro não consegue marcar avisos como enviados'
);
select throws_ok(
  $$ select public.disparar_envio_de_push() $$,
  '42501', null,
  'Membro não consegue chamar o envio'
);
reset role;


-- -----------------------------------------------------------------------------
-- Reserva
-- -----------------------------------------------------------------------------

set local role service_role;
create temporary table reservados as select * from public.reservar_avisos_para_push();
reset role;

select set_eq(
  $$ select id from reservados $$,
  array['6a000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-000000000002']::uuid[],
  'Reserva só os pendentes: fora o já lido, o de mais de um dia e o que falhou 3 vezes'
);
select set_eq(
  $$ select unnest(tokens) from reservados where id = '6a000000-0000-0000-0000-000000000001' $$,
  array['ExponentPushToken[maria-1]', 'ExponentPushToken[maria-2]'],
  'Traz todos os celulares ativos da pessoa, e só os ativos'
);
select is(
  (select cardinality(tokens) from reservados where id = '6a000000-0000-0000-0000-000000000002'),
  0,
  'Quem não tem celular vem sem token'
);
select is(
  (select titulo_administrador || ' / ' || igreja_nome from reservados limit 1),
  'Pastor Presidente / Igreja A',
  'Traz o nome da igreja (título do push) e o título do administrador'
);
select is(
  (select push_tentativas from public.notificacoes where id = '6a000000-0000-0000-0000-000000000001'),
  1,
  'A reserva conta a tentativa'
);

set local role service_role;
select is(
  (select count(*) from public.reservar_avisos_para_push()),
  0::bigint,
  'Chamada logo em seguida não pega de novo o que já está reservado'
);
reset role;


-- -----------------------------------------------------------------------------
-- Resultado do envio
-- -----------------------------------------------------------------------------

set local role service_role;
select public.concluir_envio_de_push(
  '[{"id": "6a000000-0000-0000-0000-000000000001", "ok": true, "erro": null},
    {"id": "6a000000-0000-0000-0000-000000000002", "ok": false, "erro": "sem_aparelho"}]',
  array['ExponentPushToken[maria-2]']
);
reset role;

select isnt(
  (select push_enviado_em from public.notificacoes where id = '6a000000-0000-0000-0000-000000000001'),
  null,
  'Aviso enviado fica com a data do envio'
);
select is(
  (select push_tentativas || ' ' || push_erro from public.notificacoes where id = '6a000000-0000-0000-0000-000000000002'),
  '3 sem_aparelho',
  'Sem celular, não tenta de novo'
);
select is(
  (select ativo from public.dispositivos where token = 'ExponentPushToken[maria-2]'),
  false,
  'Celular que não existe mais (app desinstalado) deixa de receber'
);
select is(
  (select ativo from public.dispositivos where token = 'ExponentPushToken[maria-1]'),
  true,
  'Os outros celulares continuam'
);

-- Falhou agora: volta depois de 2 minutos, até 3 tentativas.
update public.notificacoes
   set push_enviado_em = null, push_tentado_em = now() - interval '3 minutes'
 where id = '6a000000-0000-0000-0000-000000000001';
set local role service_role;
select is(
  (select count(*) from public.reservar_avisos_para_push() where id = '6a000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Aviso que falhou é tentado de novo depois de 2 minutos'
);
reset role;

select * from finish();
rollback;
