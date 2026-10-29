-- Testes do novo aceite dos termos (RN-041, D-104): quem já usa o app aceita
-- a versão nova pela função, com a declaração de maioridade.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Maria aceitou a versão 0.1, sem a declaração de maioridade.
--   João aceitou a versão 0.1 e não aceita a nova neste teste.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

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

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'joao@a.test');

insert into public.aceites_termos (usuario_id, versao) values
  ('a0000000-0000-0000-0000-000000000003', '0.1'),
  ('a0000000-0000-0000-0000-000000000004', '0.1');


set local role anon;
select throws_ok(
  $$ select public.aceitar_termos('0.2', true) $$,
  '42501', null, 'Sem login, não há aceite'
);
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select throws_ok(
  $$ insert into public.aceites_termos (usuario_id, versao) values ('a0000000-0000-0000-0000-000000000003', '0.2') $$,
  '42501', null, 'O app não grava o aceite direto na tabela (sem a declaração de maioridade)'
);
select throws_ok(
  $$ select public.aceitar_termos('0.2', false) $$,
  '23502', 'maioridade_obrigatoria', 'Sem declarar 18 anos ou mais, não aceita'
);
select throws_ok(
  $$ select public.aceitar_termos('  ', true) $$,
  '23502', 'termos_obrigatorios', 'A versão é obrigatória'
);
select lives_ok(
  $$ select public.aceitar_termos(' 0.2 ', true) $$,
  'Maria aceita a versão nova'
);
select lives_ok(
  $$ select public.aceitar_termos('0.2', true) $$,
  'Aceitar de novo a mesma versão não dá erro (dois aparelhos, toque duplo)'
);
select results_eq(
  $$ select versao, declarou_maioridade from public.aceites_termos order by versao $$,
  $$ values ('0.1', false), ('0.2', true) $$,
  'Maria vê só os próprios aceites: o antigo fica, e o novo tem a declaração'
);
select throws_ok(
  $$ update public.aceites_termos set versao = '0.3' $$,
  '42501', null, 'O aceite não muda depois de gravado'
);
reset role;

select is(
  (select count(*) from public.aceites_termos where usuario_id = 'a0000000-0000-0000-0000-000000000004'),
  1::bigint,
  'O aceite da Maria não vale para o João'
);

select * from finish();
rollback;
