-- Testes da exclusão de conta (Apple 5.1.1(v), Google): o que é apagado, o
-- que fica com a igreja, quem não pode excluir e o que o log guarda.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (Pastora), Maria (membro, também na B, com familiares,
--             respostas e anotações da tesouraria, um dízimo com comprovante)
--   Igreja B: Maria

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

insert into auth.users (id, email, raw_app_meta_data) values
  ('f0000000-0000-0000-0000-000000000001', 'dono@plataforma.test', '{"admin_master": true}'),
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test', '{}'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test', '{}');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo, opcoes, obrigatorio, ordem) values
  ('1a000000-0000-0000-0000-000000000000', 'celula', 'Célula', 'texto', '{}', true, 1);
insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo, opcoes, obrigatorio, ordem, preenchido_por) values
  ('1a000000-0000-0000-0000-000000000000', 'anotacao', 'Anotação', 'texto', '{}', false, 2, 'tesouraria');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status, cadastro_concluido_em, tipo_dizimo, familiares, campos_extras, campos_internos) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo', now(), 'individual', '[]', '{"celula": "Sede"}', '{}'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '62999990000', 'membro', 'ativo', now(), 'familiar', '[{"nome": "Pedro"}]', '{"celula": "Norte"}', '{"anotacao": "visitar"}'),
  ('2b000000-0000-0000-0000-000000000003', '1b000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '62999990000', 'membro', 'ativo', now(), 'individual', '[]', '{}', '{}');

insert into public.dispositivos (usuario_id, token, plataforma) values
  ('a0000000-0000-0000-0000-000000000003', 'ExponentPushToken[maria]', 'android');

insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
values ('5a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'dizimo', 30000, 'BRL', current_date, 'pix');


-- -----------------------------------------------------------------------------
-- Quem não pode excluir, e quem chama
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ select public.anonimizar_conta('a0000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'O app não chama a anonimização direto (só a Edge Function, depois de conferir o login)'
);
select is(public.sou_pastor_em_alguma_igreja(), false, 'Maria não é Pastora');
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is(public.sou_pastor_em_alguma_igreja(), true, 'A tela sabe que a Ana é Pastora');
reset role;

set local role service_role;
select throws_ok(
  $$ select public.anonimizar_conta('a0000000-0000-0000-0000-000000000001') $$,
  '42501', 'pastor_precisa_trocar', 'A Pastora só exclui depois que o suporte definir outro Pastor'
);
select throws_ok(
  $$ select public.anonimizar_conta('f0000000-0000-0000-0000-000000000001') $$,
  '42501', 'admin_master_pelo_suporte', 'O Admin Master não se exclui pelo app'
);


-- -----------------------------------------------------------------------------
-- A exclusão da Maria
-- -----------------------------------------------------------------------------

select is(public.anonimizar_conta('a0000000-0000-0000-0000-000000000003'), 2, 'As fichas das duas igrejas são anonimizadas');
reset role;

select is(
  (select string_agg(distinct nome || '|' || celular || '|' || status || '|' || perfil, ',') from public.membros
    where usuario_id = 'a0000000-0000-0000-0000-000000000003'),
  'Membro excluído|-|inativo|membro',
  'Nome e celular apagados; a ficha fica inativa'
);
select is(
  (select count(*) from public.membros
    where usuario_id = 'a0000000-0000-0000-0000-000000000003'
      and email like 'excluido-%@excluido.invalid' and familiares = '[]' and campos_extras = '{}'
      and campos_internos = '{}' and excluido_em is not null),
  2::bigint,
  'E-mail, familiares, respostas do cadastro e anotações da tesouraria apagados'
);
select is(
  (select count(*) from public.membros where email = 'maria@a.test' or nome = 'Maria'),
  0::bigint,
  'Não sobra o nome nem o e-mail em nenhuma ficha'
);
select is(
  (select valor_informado_centavos from public.lancamentos where id = '5a000000-0000-0000-0000-000000000001'),
  30000::bigint,
  'O dízimo continua na contabilidade da igreja'
);
select is(
  (select ativo from public.dispositivos where token = 'ExponentPushToken[maria]'),
  false,
  'O celular deixa de receber avisos'
);
select is(
  (select motivo from public.auditoria
    where tabela = 'membros' and registro_id = '2a000000-0000-0000-0000-000000000003' and acao = 'update'
    order by criado_em desc, id desc limit 1),
  'exclusao_de_conta',
  'A exclusão fica no log da igreja'
);
select is(
  (select depois from public.auditoria
    where tabela = 'membros' and registro_id = '2a000000-0000-0000-0000-000000000003' and acao = 'update'
    order by criado_em desc, id desc limit 1),
  '{"id": "2a000000-0000-0000-0000-000000000003", "anonimizado": true}'::jsonb,
  'O log da exclusão não guarda de novo os dados apagados'
);
select is(
  current_setting('meudizimo.anonimizando', true),
  '',
  'Depois da exclusão, o log volta a guardar o que mudou'
);

set local role service_role;
select lives_ok(
  $$ select public.anonimizar_conta('a0000000-0000-0000-0000-000000000003') $$,
  'Repetir a exclusão não dá erro (se a troca do login falhar, dá para tentar de novo)'
);
reset role;

-- O Supabase Auth troca o e-mail do login ao anonimizar: isso não volta para as fichas.
update auth.users set email = 'aleatorio-qualquer' where id = 'a0000000-0000-0000-0000-000000000003';
select is(
  (select count(*) from public.membros where usuario_id = 'a0000000-0000-0000-0000-000000000003' and email like 'excluido-%'),
  2::bigint,
  'A troca do e-mail do login, ao anonimizar, não mexe nas fichas já anonimizadas'
);

select * from finish();
rollback;
