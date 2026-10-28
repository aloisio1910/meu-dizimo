-- Testes da importação de membros por planilha (B2): quem importa, o
-- resultado de cada linha e o que fica no log.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Tiago (tesoureiro), Maria (membro)

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
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test');

insert into public.igrejas (id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Igreja A');

insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status, cadastro_concluido_em) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '1', 'tesoureiro', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '2', 'membro', 'ativo', now());


select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ select public.importar_membros('1a000000-0000-0000-0000-000000000000', '[{"linha": 2, "nome": "X", "email": "x@a.test", "celular": "1"}]') $$,
  '42501', 'sem_permissao', 'Membro não importa'
);
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
create temporary table resultado as
  select public.importar_membros('1a000000-0000-0000-0000-000000000000', '[
    {"linha": 2, "nome": "Carla", "email": "Carla@A.test", "celular": "62999990001"},
    {"linha": 3, "nome": "Davi", "email": "davi@a.test", "celular": "62999990002"},
    {"linha": 4, "nome": "Maria de novo", "email": "maria@a.test", "celular": "62999990003"},
    {"linha": 5, "nome": "", "email": "sem-arroba", "celular": ""}
  ]') as r;
select throws_ok(
  $$ select public.importar_membros('1a000000-0000-0000-0000-000000000000', '[]') $$,
  '22023', 'lista_vazia', 'Lista vazia é recusada'
);
select throws_ok(
  $$ select public.importar_membros('1a000000-0000-0000-0000-000000000000',
       (select jsonb_agg(jsonb_build_object('linha', i, 'nome', 'P', 'email', 'p' || i || '@a.test', 'celular', '1'))
          from generate_series(1, 501) i)) $$,
  '22023', 'lista_grande_demais', 'Mais de 500 de uma vez é recusado'
);
reset role;

select is(
  (select string_agg((e ->> 'linha') || ':' || (e ->> 'resultado'), ', ' order by (e ->> 'linha')::int)
     from resultado, jsonb_array_elements(r) e),
  '2:convidado, 3:convidado, 4:email_ja_cadastrado, 5:dados_invalidos',
  'Cada linha volta com o seu resultado, e uma linha ruim não impede as outras'
);
select is(
  (select count(*) from public.membros
    where igreja_id = '1a000000-0000-0000-0000-000000000000' and status = 'convidado' and perfil = 'membro'),
  2::bigint,
  'Os novos entram como convidados, com perfil de membro'
);
select is(
  (select email from public.membros where nome = 'Carla'),
  'carla@a.test',
  'O e-mail é gravado em minúsculas'
);
select is(
  (select count(*) from public.convites c join public.membros m on m.id = c.membro_id where m.nome in ('Carla', 'Davi')),
  2::bigint,
  'Cada convidado recebe o seu convite de 7 dias'
);
select is(
  (select count(*) from public.auditoria
    where tabela = 'membros' and acao = 'insert' and perfil = 'tesoureiro'
      and depois ->> 'nome' in ('Carla', 'Davi')),
  2::bigint,
  'Cada convite fica no log, com quem importou'
);
select is(
  current_setting('meudizimo.importando', true),
  '',
  'Ao terminar, os convites voltam a chamar o e-mail um a um'
);

select * from finish();
rollback;
