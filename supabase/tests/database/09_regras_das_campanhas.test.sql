-- Testes das regras de status das campanhas (D-088 e D-089).
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro), Maria (membro)
--   Igreja B: Bruno (administrador)

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

create function pg_temp.status_de(p_nome text)
returns text
language sql
as $$
  select status::text from public.campanhas where nome = p_nome;
$$;


-- -----------------------------------------------------------------------------
-- Cenário
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo'),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo'),
  ('1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '4', 'administrador', 'ativo');


-- -----------------------------------------------------------------------------
-- Ana (Pastora de Governo): publicar, encerrar e reabrir
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

insert into public.campanhas (igreja_id, nome, status) values ('1a000000-0000-0000-0000-000000000000', 'Missões', 'ativa');
select is(pg_temp.status_de('Missões'), 'rascunho', 'Campanha nova nasce rascunho, mesmo pedindo ativa');

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*) from public.campanhas where nome = 'Missões'), 0::bigint, 'Membro não vê o rascunho (D-074)');

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ update public.campanhas set status = 'ativa' where nome = 'Missões' $$,
  'Pastor de Governo publica o rascunho'
);
select throws_ok(
  $$ update public.campanhas set status = 'rascunho' where nome = 'Missões' $$,
  '42501', 'status_invalido',
  'Campanha publicada não volta a rascunho'
);
select lives_ok(
  $$ update public.campanhas set status = 'encerrada' where nome = 'Missões' $$,
  'Pastor de Governo encerra a campanha'
);
select lives_ok(
  $$ update public.campanhas set status = 'ativa' where nome = 'Missões' $$,
  'Pastor de Governo reabre a campanha encerrada (D-088)'
);
select lives_ok(
  $$ update public.campanhas set descricao = 'Viagem missionária', link_video = 'https://youtu.be/xyz' where nome = 'Missões' $$,
  'Pastor de Governo edita a campanha'
);
select throws_ok(
  $$ update public.campanhas set fim = public.hoje_na_igreja() - 1 where nome = 'Missões' $$,
  '22023', 'fim_no_passado',
  'Campanha ativa não fica com a data de fim no passado'
);
update public.campanhas set status = 'encerrada', fim = public.hoje_na_igreja() - 1 where nome = 'Missões';
select throws_ok(
  $$ update public.campanhas set status = 'ativa' where nome = 'Missões' $$,
  '22023', 'fim_no_passado',
  'Para reabrir, a data de fim precisa ser hoje ou depois'
);
select lives_ok(
  $$ update public.campanhas set status = 'ativa', fim = public.hoje_na_igreja() + 30 where nome = 'Missões' $$,
  'Reabre ajustando a data de fim'
);
select throws_ok(
  $$ update public.campanhas set status = 'encerrada' where permanente $$,
  '23514', null,
  'A campanha permanente Oferta continua sem poder encerrar'
);

reset role;


-- -----------------------------------------------------------------------------
-- Tiago (tesoureiro) e Bruno (outra igreja) não alteram
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
update public.campanhas set status = 'encerrada' where nome = 'Missões';
reset role;
select is(pg_temp.status_de('Missões'), 'ativa', 'Tesoureiro não encerra campanha');

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
update public.campanhas set status = 'encerrada' where nome = 'Missões';
reset role;
select is(pg_temp.status_de('Missões'), 'ativa', 'Administrador de outra igreja não encerra campanha da Igreja A');


-- -----------------------------------------------------------------------------
-- Encerramento automático (D-089)
-- -----------------------------------------------------------------------------

insert into public.campanhas (igreja_id, nome, status, fim) values
  ('1a000000-0000-0000-0000-000000000000', 'Acabou ontem', 'ativa', public.hoje_na_igreja() - 1),
  ('1a000000-0000-0000-0000-000000000000', 'Acaba hoje', 'ativa', public.hoje_na_igreja()),
  ('1a000000-0000-0000-0000-000000000000', 'Sem data de fim', 'ativa', null);

select is(public.encerrar_campanhas_vencidas(), 1, 'A rotina encerra só a campanha vencida');
select is(pg_temp.status_de('Acabou ontem'), 'encerrada', 'Campanha com fim ontem foi encerrada');
select is(pg_temp.status_de('Acaba hoje'), 'ativa', 'No último dia a campanha continua aberta');

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok(
  $$ select public.encerrar_campanhas_vencidas() $$,
  '42501', null,
  'Ninguém do app chama a rotina automática'
);
reset role;

select * from finish();
rollback;
