-- Testes das páginas do Log da igreja (P-04).
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro)
--   Igreja B: Bruno (administrador)
--   Registros de auditoria criados à mão, como dono do banco

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

-- Só os registros do cenário, num dia isolado, para as contas serem exatas.
insert into public.auditoria (igreja_id, usuario_id, perfil, acao, tabela, antes, depois, criado_em)
select '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'tesoureiro', 'update', 'lancamentos',
       '{"status": "aguardando"}', '{"status": "confirmado"}', '2030-01-10 12:00:00+00'::timestamptz + (n || ' minutes')::interval
from generate_series(1, 25) as n;

-- Aviso interno ("ainda conferindo"): fica no banco, fora da contagem.
insert into public.auditoria (igreja_id, usuario_id, perfil, acao, tabela, antes, depois, criado_em) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'tesoureiro', 'update', 'lancamentos',
   '{"status": "em_conferencia", "em_conferencia_desde": "10:00"}', '{"status": "em_conferencia", "em_conferencia_desde": "10:02"}',
   '2030-01-10 13:00:00+00'),
  ('1a000000-0000-0000-0000-000000000000', null, 'sistema', 'update', 'campanhas',
   '{"status": "ativa"}', '{"status": "encerrada"}', '2030-01-10 13:30:00+00');


select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select is(
  (select max(total) from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11')),
  26::bigint,
  'O total conta os registros que interessam, sem o aviso interno'
);
select is(
  (select count(*) from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', null, null, 0, 20)),
  20::bigint,
  'A primeira página traz 20 registros'
);
select is(
  (select count(*) from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', null, null, 1, 20)),
  6::bigint,
  'A segunda página traz o resto'
);
select is(
  (select tabela from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', null, null, 0, 1)),
  'campanhas',
  'O mais recente vem primeiro'
);
select is(
  (select max(total) from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', '{campanhas}')),
  1::bigint,
  'Filtra por assunto'
);
select is(
  (select max(total) from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', null, 'sistema')),
  1::bigint,
  'Filtra pelas rotinas automáticas'
);
select is(
  (select max(total) from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11', null, 'a0000000-0000-0000-0000-000000000002')),
  25::bigint,
  'Filtra pela pessoa'
);

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select is(
  (select count(*) from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11')),
  0::bigint,
  'Tesoureiro não lê o log (a RLS continua valendo)'
);
reset role;

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is(
  (select count(*) from public.registros_do_log('1a000000-0000-0000-0000-000000000000', '2030-01-10', '2030-01-11')),
  0::bigint,
  'Administrador de outra igreja não lê o log da Igreja A'
);
reset role;

select * from finish();
rollback;
