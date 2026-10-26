-- Testes da pesquisa e do download do Log da igreja (D-095).
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro), José Antônio (membro)
--   Igreja B: Bruno (administrador)
--   Registros de auditoria criados à mão, num dia isolado

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

create function pg_temp.achados(p_busca text)
returns bigint
language sql
as $$
  select coalesce(max(total), 0)
  from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', null, null, 0, 20, p_busca);
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', null, 'José Antônio', 'jose@a.test', '3', 'membro', 'ativo'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '4', 'administrador', 'ativo');

insert into public.auditoria (igreja_id, usuario_id, perfil, acao, tabela, registro_id, antes, depois, motivo, criado_em) values
  -- Tiago confirma o dízimo de R$ 1.500,50 do José.
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'tesoureiro', 'update', 'lancamentos', null,
   '{"membro_id": "2a000000-0000-0000-0000-000000000003", "status": "aguardando", "valor_informado_centavos": 150050}',
   '{"membro_id": "2a000000-0000-0000-0000-000000000003", "status": "confirmado", "valor_informado_centavos": 150050}',
   null, '2030-01-10 12:00:00+00'),
  -- Ana troca a chave Pix da conta Construção.
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'administrador', 'update', 'contas', null,
   '{"nome": "Construção", "chave_pix": "a@x.test"}', '{"nome": "Construção", "chave_pix": "b@x.test"}',
   null, '2030-01-10 13:00:00+00'),
  -- Tiago desfaz uma confirmação, com motivo.
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'tesoureiro', 'update', 'lancamentos', null,
   '{"membro_id": "2a000000-0000-0000-0000-000000000001", "status": "confirmado", "valor_informado_centavos": 15000}',
   '{"membro_id": "2a000000-0000-0000-0000-000000000001", "status": "aguardando", "valor_informado_centavos": 15000}',
   'Confirmei por engano', '2030-01-10 14:00:00+00');


select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select is(pg_temp.achados(null), 3::bigint, 'Sem pesquisa, vêm todos do período');
select is(pg_temp.achados('jose antonio'), 1::bigint, 'Acha pelo nome de quem é o registro, sem acento');
select is(pg_temp.achados('TIAGO'), 2::bigint, 'Acha pelo nome de quem fez, sem maiúscula');
select is(pg_temp.achados('construcao'), 1::bigint, 'Acha pelo nome da conta');
select is(pg_temp.achados('engano'), 1::bigint, 'Acha pelo motivo');
select is(pg_temp.achados('1.500,50'), 1::bigint, 'Acha pelo valor com ponto de milhar e vírgula');
select is(pg_temp.achados('150'), 1::bigint, 'Valor redondo: 150 acha R$ 150,00, não R$ 1.500,50');
select is(pg_temp.achados('ninguem'), 0::bigint, 'Sem resultado quando nada combina');

select lives_ok(
  $$ select public.registrar_download_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', 3, 'tiago') $$,
  'Pastor de Governo registra o download do log'
);

reset role;
select results_eq(
  $$ select usuario_id, acao, tabela, (depois ->> 'quantidade')::int, depois ->> 'busca'
     from public.auditoria where acao = 'download' and igreja_id = '1a000000-0000-0000-0000-000000000000' $$,
  $$ values ('a0000000-0000-0000-0000-000000000001'::uuid, 'download', 'auditoria', 3, 'tiago') $$,
  'O download fica no log: quem, quantos registros e a pesquisa usada'
);

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ select public.registrar_download_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', 3) $$,
  '42501', 'so_o_pastor_baixa_o_log',
  'Tesoureiro não baixa o log'
);
reset role;

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok(
  $$ select public.registrar_download_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', 3) $$,
  '42501', 'so_o_pastor_baixa_o_log',
  'Administrador de outra igreja não baixa o log da Igreja A'
);
reset role;

select * from finish();
rollback;
