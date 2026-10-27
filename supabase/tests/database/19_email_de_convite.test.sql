-- Testes do e-mail de convite: quais convites a Edge Function reserva, como
-- o resultado volta e o que fica fora do log.
-- Rodar com: npx supabase test db
--
-- Cenário (Igreja A)
--   Carla: convidada, reenviada (dois convites; só o mais novo vale)
--   Davi: convidado com convite vencido
--   Elisa: convidada que já aceitou
--   Fábio: convite cancelado (ficha inativa)

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- Convites do banco de desenvolvimento ficam fora deste teste.
update public.convites set email_tentativas = 3 where email_enviado_em is null and aceito_em is null;

insert into public.igrejas (id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Igreja A');

insert into public.membros (id, igreja_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'Carla', 'carla@a.test', '1', 'membro', 'convidado'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'Davi', 'davi@a.test', '2', 'membro', 'convidado'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'Elisa', 'elisa@a.test', '3', 'membro', 'convidado'),
  ('2a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000', 'Fábio', 'fabio@a.test', '4', 'membro', 'convidado');

insert into public.convites (id, igreja_id, membro_id, enviado_em, expira_em, aceito_em) values
  ('3a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '6 days', null),
  ('3a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000001', now(), now() + interval '7 days', null),
  ('3a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000002', now() - interval '8 days', now() - interval '1 day', null),
  ('3a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', now(), now() + interval '7 days', now()),
  ('3a000000-0000-0000-0000-000000000005', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000004', now(), now() + interval '7 days', null);

-- O convite do Fábio foi cancelado depois de criado.
update public.membros set status = 'inativo' where id = '2a000000-0000-0000-0000-000000000004';


-- -----------------------------------------------------------------------------
-- Só a Edge Function usa estas funções
-- -----------------------------------------------------------------------------

set local role authenticated;
select throws_ok($$ select * from public.reservar_convites_para_email() $$, '42501', null, 'O app não reserva convites');
select throws_ok($$ select public.concluir_envio_de_convites('[]') $$, '42501', null, 'O app não marca convites como enviados');
select throws_ok($$ select public.chamar_funcao_interna('url_do_envio_de_push') $$, '42501', null, 'O app não chama funções internas');
reset role;


-- -----------------------------------------------------------------------------
-- Reserva
-- -----------------------------------------------------------------------------

set local role service_role;
create temporary table reservados as select * from public.reservar_convites_para_email();
reset role;

select set_eq(
  $$ select id from reservados $$,
  array['3a000000-0000-0000-0000-000000000002']::uuid[],
  'Só o convite mais novo de quem ainda é convidado, em validade e não aceito'
);
select is(
  (select email || ' / ' || nome || ' / ' || igreja_nome from reservados),
  'carla@a.test / Carla / Igreja A',
  'Traz o e-mail atual da ficha, o nome e a igreja'
);
set local role service_role;
select is((select count(*) from public.reservar_convites_para_email()), 0::bigint, 'Não pega de novo o que está reservado');
reset role;


-- -----------------------------------------------------------------------------
-- Resultado
-- -----------------------------------------------------------------------------

set local role service_role;
select public.concluir_envio_de_convites('[{"id": "3a000000-0000-0000-0000-000000000002", "ok": true, "erro": null}]');
reset role;
select isnt(
  (select email_enviado_em from public.convites where id = '3a000000-0000-0000-0000-000000000002'),
  null,
  'Convite enviado fica com a data do e-mail'
);
select is(
  (select count(*) from public.auditoria
    where tabela = 'convites' and registro_id = '3a000000-0000-0000-0000-000000000002' and acao = 'update'),
  0::bigint,
  'O envio do e-mail não aparece no log como mudança no convite'
);

-- Falhou: volta depois de 2 minutos, até 3 vezes.
update public.convites
   set email_enviado_em = null, email_tentado_em = now() - interval '3 minutes'
 where id = '3a000000-0000-0000-0000-000000000002';
set local role service_role;
select is((select count(*) from public.reservar_convites_para_email()), 1::bigint, 'Convite que falhou é tentado de novo');
reset role;
update public.convites
   set email_tentativas = 3, email_tentado_em = now() - interval '3 minutes'
 where id = '3a000000-0000-0000-0000-000000000002';
set local role service_role;
select is((select count(*) from public.reservar_convites_para_email()), 0::bigint, 'Depois de 3 tentativas, desiste');
reset role;

-- O aceite continua no log.
update public.convites set aceito_em = now() where id = '3a000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.auditoria
    where tabela = 'convites' and registro_id = '3a000000-0000-0000-0000-000000000001' and acao = 'update'),
  1::bigint,
  'O aceite do convite continua aparecendo no log'
);

select * from finish();
rollback;
