-- Testes das contas de demonstração (revisores das lojas): quem pode entrar
-- com o código fixo, o bloqueio após 5 erros e a preparação da igreja
-- fictícia, que pode rodar várias vezes e recria a conta excluída.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja Demonstração (preparada aqui; pode já existir no banco local)
--   Igreja A, de verdade: Maria; João está nas duas igrejas.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

-- Cria os logins que a preparação pedir, como o script faz pelo Auth.
create function pg_temp.preparar()
returns void
language plpgsql
as $$
declare
  v_email text;
begin
  for v_email in
    select jsonb_array_elements_text(public.preparar_demonstracao('0.2-piloto') -> 'faltam_logins')
  loop
    insert into auth.users (id, email) values (gen_random_uuid(), v_email);
  end loop;
  perform public.preparar_demonstracao('0.2-piloto');
end;
$$;

select pg_temp.preparar();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'joao@a.test');
insert into public.igrejas (id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Igreja A');
insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status, cadastro_concluido_em) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '1', 'membro', 'ativo', now()),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'João', 'joao@a.test', '1', 'membro', 'ativo', now()),
  ('de000000-0000-4000-8000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'João', 'joao@a.test', '1', 'membro', 'ativo', now());


-- -----------------------------------------------------------------------------
-- A preparação
-- -----------------------------------------------------------------------------

select is(
  (select count(*) from public.membros m join auth.users u on u.id = m.usuario_id
    where m.igreja_id = 'de000000-0000-4000-8000-000000000001' and m.status = 'ativo'
      and m.email in ('membro@demonstracao.invalid', 'pastor@demonstracao.invalid')),
  2::bigint,
  'O membro e o Pastor da demonstração ficam ativos, com login'
);
select is(
  (select perfil::text from public.membros where email = 'pastor@demonstracao.invalid'),
  'administrador',
  'A conta do Pastor é o Pastor de Governo da igreja fictícia'
);
select is(
  (select bool_and(a.declarou_maioridade) from public.aceites_termos a join auth.users u on u.id = a.usuario_id
    where u.email in ('membro@demonstracao.invalid', 'pastor@demonstracao.invalid') and a.versao = '0.2-piloto'),
  true,
  'As duas contas já aceitaram a versão atual dos termos (o revisor não para no novo aceite)'
);
select ok(
  (select demonstracao from public.igrejas where id = 'de000000-0000-4000-8000-000000000001'),
  'A igreja fictícia é marcada como demonstração'
);
select is(
  (select count(*) from public.lancamentos l join public.membros m on m.id = l.membro_id
    where m.email = 'membro@demonstracao.invalid' and l.status = 'aguardando'),
  1::bigint,
  'Há um dízimo na fila para o Pastor conferir'
);

select lives_ok($$ select pg_temp.preparar() $$, 'Preparar de novo não dá erro');
select is(
  (select count(*) from public.lancamentos l join public.membros m on m.id = l.membro_id
    where m.email = 'membro@demonstracao.invalid'),
  3::bigint,
  'Preparar de novo não repete os lançamentos de exemplo'
);


-- -----------------------------------------------------------------------------
-- Quem pode entrar com o código fixo
-- -----------------------------------------------------------------------------

set local role service_role;
select is(public.situacao_da_demonstracao(' Membro@Demonstracao.invalid '), 'sim', 'O membro da demonstração pode');
select is(public.situacao_da_demonstracao('maria@a.test'), 'nao', 'Um membro de igreja de verdade nunca');
select is(public.situacao_da_demonstracao('joao@a.test'), 'nao', 'Quem também está numa igreja de verdade nunca');
select is(public.situacao_da_demonstracao('ninguem@demonstracao.invalid'), 'nao', 'Um e-mail sem login, nunca');

select public.registrar_tentativa_de_demonstracao('pastor@demonstracao.invalid', false) from generate_series(1, 4);
select is(public.situacao_da_demonstracao('pastor@demonstracao.invalid'), 'sim', 'Com 4 erros, ainda pode tentar');
select public.registrar_tentativa_de_demonstracao('pastor@demonstracao.invalid', false);
select is(public.situacao_da_demonstracao('pastor@demonstracao.invalid'), 'bloqueado', 'No 5º erro, bloqueia');
reset role;

-- Um acerto zera a contagem (os erros passam a contar a partir dele).
update public.tentativas_de_demonstracao set em = now() - interval '2 seconds' where email = 'pastor@demonstracao.invalid';
set local role service_role;
select public.registrar_tentativa_de_demonstracao('pastor@demonstracao.invalid', true);
select is(public.situacao_da_demonstracao('pastor@demonstracao.invalid'), 'sim', 'Depois de um acerto, volta a poder');
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ select public.situacao_da_demonstracao('membro@demonstracao.invalid') $$,
  '42501', null, 'O app não consulta a demonstração direto (só a Edge Function)'
);
select throws_ok(
  $$ select count(*) from public.tentativas_de_demonstracao $$,
  '42501', null, 'Ninguém do app lê as tentativas'
);
reset role;


-- -----------------------------------------------------------------------------
-- O revisor excluiu a conta de membro
-- -----------------------------------------------------------------------------

select set_config('teste.membro', (select id::text from auth.users where email = 'membro@demonstracao.invalid'), true);
set local role service_role;
select public.anonimizar_conta(current_setting('teste.membro')::uuid);
reset role;
update auth.users set deleted_at = now(), email = 'apagado-' || id where email = 'membro@demonstracao.invalid';

select pg_temp.preparar();
select is(
  (select count(*) from public.membros m join auth.users u on u.id = m.usuario_id
    where m.email = 'membro@demonstracao.invalid' and m.status = 'ativo' and u.deleted_at is null),
  1::bigint,
  'Preparar de novo recria a conta de membro, com ficha e lançamentos novos'
);

select * from finish();
rollback;
