-- Testes das contas e do Pix da igreja (P-03, D-091).
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro)
--             Contas: Dízimos (principal), Construção (usada pela campanha
--             ativa "Templo"), Missões (sem campanha)
--   Igreja B: Bruno (administrador)

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

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

create function pg_temp.principal()
returns text
language sql
as $$
  select string_agg(nome, ',') from public.contas
  where igreja_id = '1a000000-0000-0000-0000-000000000000' and principal;
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo'),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '3', 'administrador', 'ativo');

insert into public.contas (id, igreja_id, nome, principal) values
  ('3a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'Dízimos', true),
  ('3a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'Construção', false),
  ('3a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'Missões', false);

insert into public.campanhas (igreja_id, nome, status, conta_id) values
  ('1a000000-0000-0000-0000-000000000000', 'Templo', 'ativa', '3a000000-0000-0000-0000-000000000002');


-- -----------------------------------------------------------------------------
-- Ana (Pastora de Governo)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ select public.definir_conta_principal('3a000000-0000-0000-0000-000000000003') $$,
  'Pastor de Governo troca a conta principal'
);
select is(pg_temp.principal(), 'Missões', 'Fica uma única principal, a nova');
select lives_ok(
  $$ select public.definir_conta_principal('3a000000-0000-0000-0000-000000000003') $$,
  'Marcar de novo a mesma principal não quebra nada'
);
select throws_ok(
  $$ update public.contas set ativa = false where id = '3a000000-0000-0000-0000-000000000003' $$,
  '23514', null,
  'A conta principal não é desativada'
);
select throws_ok(
  $$ update public.contas set ativa = false where id = '3a000000-0000-0000-0000-000000000002' $$,
  '23514', 'conta_em_uso',
  'Conta usada por campanha ativa não é desativada'
);
select lives_ok(
  $$ update public.contas set ativa = false where id = '3a000000-0000-0000-0000-000000000001' $$,
  'Conta sem campanha e que não é principal é desativada'
);
select throws_ok(
  $$ select public.definir_conta_principal('3a000000-0000-0000-0000-000000000001') $$,
  '42501', 'conta_indisponivel',
  'Conta inativa não vira principal'
);
select lives_ok(
  $$ update public.contas set chave_pix = 'igreja@a.test', tipo_chave_pix = 'email', nome_recebedor = 'IGREJA A', cidade = 'GOIANIA'
     where id = '3a000000-0000-0000-0000-000000000003' $$,
  'Pastor de Governo cadastra a chave Pix'
);

reset role;

select ok(
  exists (select 1 from public.auditoria where tabela = 'contas' and depois->>'chave_pix' = 'igreja@a.test'),
  'A troca da chave Pix fica no log (RN-040)'
);


-- -----------------------------------------------------------------------------
-- Tiago (tesoureiro) e Bruno (outra igreja)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ select public.definir_conta_principal('3a000000-0000-0000-0000-000000000002') $$,
  '42501', 'conta_indisponivel',
  'Tesoureiro não troca a conta principal'
);
update public.contas set chave_pix = 'golpe@x.test' where id = '3a000000-0000-0000-0000-000000000003';
reset role;
select is(
  (select chave_pix from public.contas where id = '3a000000-0000-0000-0000-000000000003'),
  'igreja@a.test',
  'Tesoureiro não troca a chave Pix'
);

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok(
  $$ select public.definir_conta_principal('3a000000-0000-0000-0000-000000000002') $$,
  '42501', 'conta_indisponivel',
  'Administrador de outra igreja não troca a conta principal'
);
reset role;

select * from finish();
rollback;
