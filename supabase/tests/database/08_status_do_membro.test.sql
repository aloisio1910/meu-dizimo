-- Testes de cancelar convite, inativar e reativar membro (D-085).
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro), Marcos (ativo, já
--             concluiu o cadastro), Rita (convidada, sem login) e Paulo
--             (convidado que já entrou com o código, sem concluir o cadastro)
--   Igreja B: Bruno (administrador)

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

create function pg_temp.entrar(p_usuario uuid, p_email text default null)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_usuario, 'email', p_email, 'role', 'authenticated')::text,
    true
  );
$$;

create function pg_temp.status_de(p_email text)
returns text
language sql
as $$
  select status::text from public.membros where email = p_email;
$$;


-- -----------------------------------------------------------------------------
-- Cenário
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'marcos@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'paulo@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status, cadastro_concluido_em) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001',
   'Ana', 'ana@a.test', '11900000001', 'administrador', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002',
   'Tiago', 'tiago@a.test', '11900000002', 'tesoureiro', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003',
   'Marcos', 'marcos@a.test', '11900000003', 'membro', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', null,
   'Rita', 'rita@a.test', '11900000004', 'membro', 'convidado', null),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004',
   'Paulo', 'paulo@a.test', '11900000005', 'membro', 'convidado', null),
  ('1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001',
   'Bruno', 'bruno@b.test', '21900000001', 'administrador', 'ativo', now());


-- -----------------------------------------------------------------------------
-- Tiago (tesoureiro)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select lives_ok(
  $$ update public.membros set status = 'inativo' where email = 'rita@a.test' $$,
  'Tesoureiro cancela o convite de quem ainda é convidado'
);
select throws_ok(
  $$ update public.membros set status = 'inativo' where email = 'marcos@a.test' $$,
  '42501', 'so_o_pastor_altera_status',
  'Tesoureiro não inativa membro ativo'
);
select throws_ok(
  $$ update public.membros set status = 'convidado' where email = 'rita@a.test' $$,
  '42501', 'so_o_pastor_altera_status',
  'Tesoureiro não reativa'
);
select throws_ok(
  $$ update public.membros set status = 'inativo' where email = 'tiago@a.test' $$,
  '42501', 'status_proprio',
  'Ninguém muda o próprio status'
);

reset role;
select is(pg_temp.status_de('rita@a.test'), 'inativo', 'Convite cancelado deixa a ficha inativa');


-- -----------------------------------------------------------------------------
-- Ana (Pastora de Governo)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ update public.membros set status = 'inativo' where email = 'marcos@a.test' $$,
  'Pastor de Governo inativa membro ativo'
);
select lives_ok(
  $$ update public.membros set status = 'ativo' where email = 'marcos@a.test' $$,
  'Quem já concluiu o cadastro volta a Ativo'
);
select throws_ok(
  $$ update public.membros set status = 'ativo' where email = 'rita@a.test' $$,
  '42501', 'reativacao_invalida',
  'Quem nunca concluiu o cadastro não volta direto a Ativo'
);
select lives_ok(
  $$ update public.membros set status = 'convidado' where email = 'rita@a.test' $$,
  'Quem nunca concluiu o cadastro volta a Convidado'
);
select lives_ok(
  $$ select public.reenviar_convite((select id from public.membros where email = 'rita@a.test')) $$,
  'Depois de reativado, o convidado pode receber novo convite'
);
select throws_ok(
  $$ update public.membros set status = 'ativo' where email = 'paulo@a.test' $$,
  '42501', 'reativacao_invalida',
  'Convidado não vira Ativo sem concluir o cadastro'
);
select lives_ok(
  $$ update public.membros set status = 'inativo' where email = 'paulo@a.test' $$,
  'Pastor de Governo também cancela convite'
);
select lives_ok(
  $$ update public.membros set status = 'convidado' where email = 'paulo@a.test' $$,
  'Convidado que já tinha entrado volta a Convidado'
);
select throws_ok(
  $$ update public.membros set status = 'inativo' where email = 'ana@a.test' $$,
  '42501', 'status_proprio',
  'Pastor de Governo não inativa a si mesmo'
);
select throws_ok(
  $$ update public.membros set cadastro_concluido_em = now() where email = 'rita@a.test' $$,
  '42501', null,
  'Ninguém do app marca o cadastro como concluído'
);

reset role;


-- -----------------------------------------------------------------------------
-- Bruno (administrador de outra igreja)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
update public.membros set status = 'inativo' where email = 'marcos@a.test';
reset role;

select is(pg_temp.status_de('marcos@a.test'), 'ativo', 'Administrador de outra igreja não inativa membro da Igreja A');


-- -----------------------------------------------------------------------------
-- Paulo conclui o cadastro depois de reativado
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000004', 'paulo@a.test');
set local role authenticated;

select lives_ok(
  $$ select public.concluir_cadastro((select id from public.membros where usuario_id = 'a0000000-0000-0000-0000-000000000004'),
       'Paulo Lima', '11900000005', 'individual', '[]', '{}', '1.0') $$,
  'Convidado reativado conclui o cadastro'
);

reset role;

select is(pg_temp.status_de('paulo@a.test'), 'ativo', 'Concluir o cadastro deixa o membro ativo');
select isnt(
  (select cadastro_concluido_em from public.membros where email = 'paulo@a.test'),
  null,
  'Concluir o cadastro marca a data da conclusão'
);

select * from finish();
rollback;
