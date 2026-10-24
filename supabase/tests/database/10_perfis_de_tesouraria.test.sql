-- Testes de autorizar e suspender tesoureiros (P-01, D-068 e D-090).
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana e Paula (administradoras), Tiago (tesoureiro), Maria
--             (membro), Rui (membro inativo)

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

create function pg_temp.entrar(p_usuario uuid, p_admin_master boolean default false)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_usuario,
      'role', 'authenticated',
      'app_metadata', json_build_object('admin_master', p_admin_master)
    )::text,
    true
  );
$$;

create function pg_temp.perfil_de(p_email text)
returns text
language sql
as $$
  select perfil::text from public.membros where email = p_email;
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'paula@a.test'),
  ('a0000000-0000-0000-0000-000000000005', 'rui@a.test'),
  ('f0000000-0000-0000-0000-000000000001', 'dono@plataforma.test');

insert into public.igrejas (id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Igreja A');

insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status, cadastro_concluido_em) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'Paula', 'paula@a.test', '4', 'administrador', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'Rui', 'rui@a.test', '5', 'membro', 'inativo', now());


-- -----------------------------------------------------------------------------
-- Ana (Pastora de Governo)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ update public.membros set perfil = 'tesoureiro' where email = 'maria@a.test' $$,
  'Pastor de Governo autoriza um membro como tesoureiro'
);
select lives_ok(
  $$ update public.membros set perfil = 'membro' where email = 'tiago@a.test' $$,
  'Pastor de Governo suspende um tesoureiro'
);
select throws_ok(
  $$ update public.membros set perfil = 'membro' where email = 'paula@a.test' $$,
  '42501', 'so_admin_master_define_pastor',
  'Pastor de Governo não rebaixa outro Pastor (D-068)'
);
select throws_ok(
  $$ update public.membros set perfil = 'tesoureiro' where email = 'ana@a.test' $$,
  '42501', 'so_admin_master_define_pastor',
  'Pastor de Governo não rebaixa a si mesmo'
);
select throws_ok(
  $$ update public.membros set perfil = 'administrador' where email = 'maria@a.test' $$,
  '42501', 'so_admin_master_define_pastor',
  'Pastor de Governo não promove a Pastor'
);
select throws_ok(
  $$ update public.membros set perfil = 'tesoureiro' where email = 'rui@a.test' $$,
  '42501', 'membro_inativo',
  'Membro inativo não recebe perfil novo'
);
select lives_ok(
  $$ select public.convidar_membro('1a000000-0000-0000-0000-000000000000', 'Lia', 'lia@a.test', '6', 'tesoureiro') $$,
  'Pastor de Governo convida alguém já como tesoureiro'
);

reset role;

select is(pg_temp.perfil_de('tiago@a.test'), 'membro', 'Suspenso volta a ser membro (D-090)');
select is(
  (select status::text from public.membros where email = 'tiago@a.test'),
  'ativo',
  'Suspenso continua ativo, com o próprio Cartão'
);


-- -----------------------------------------------------------------------------
-- Tiago suspenso e Maria tesoureira
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select is((select count(*) from public.membros), 1::bigint, 'Suspenso perde a tesouraria: só vê a própria ficha');
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select ok((select count(*) from public.membros) > 1, 'Autorizada passa a ver os membros da igreja');
select throws_ok(
  $$ update public.membros set perfil = 'tesoureiro' where email = 'tiago@a.test' $$,
  '42501', 'so_o_pastor_altera_perfil',
  'Tesoureiro não autoriza outro tesoureiro'
);
select throws_ok(
  $$ update public.membros set perfil = 'membro' where email = 'maria@a.test' $$,
  '42501', 'so_o_pastor_altera_perfil',
  'Ninguém além do Pastor muda o próprio perfil'
);
reset role;


-- -----------------------------------------------------------------------------
-- Admin Master
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$ update public.membros set perfil = 'tesoureiro' where email = 'paula@a.test' $$,
  'Admin Master muda o perfil de um Pastor de Governo'
);
reset role;

select * from finish();
rollback;
