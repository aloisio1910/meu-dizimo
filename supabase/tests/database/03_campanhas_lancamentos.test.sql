-- Testes de campanhas, lançamentos (registro, edição, cancelamento,
-- devolução presencial), comprovantes e arquivos no Storage.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro), Maria e Pedro (membros)
--             Contas: "Dízimos e ofertas" (principal) e "Construção"
--             Campanhas: Oferta (permanente, automática), Construção (ativa,
--             conta Construção) e Natal (rascunho)
--   Igreja B: Bruno (membro)

begin;
create extension if not exists pgtap with schema extensions;

select plan(52);

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


-- -----------------------------------------------------------------------------
-- Cenário
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'pedro@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000004', 'Pedro', 'pedro@a.test', '4', 'membro', 'ativo'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '5', 'membro', 'ativo');

insert into public.contas (id, igreja_id, nome, principal) values
  ('3a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'Dízimos e ofertas', true),
  ('3a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'Construção', false);

insert into public.campanhas (id, igreja_id, nome, status, conta_id) values
  ('4a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000',
   'Construção do templo', 'ativa', '3a000000-0000-0000-0000-000000000002'),
  ('4a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
   'Natal', 'rascunho', null);

select is(
  (select count(*) from public.campanhas where igreja_id = '1a000000-0000-0000-0000-000000000000' and permanente and nome = 'Oferta'),
  1::bigint,
  'Igreja nasce com a campanha permanente Oferta (RN-038)'
);
select is(
  (select count(*) from public.campanhas where igreja_id = '1b000000-0000-0000-0000-000000000000' and permanente),
  1::bigint,
  'Cada igreja tem a sua campanha Oferta'
);


-- -----------------------------------------------------------------------------
-- Maria: registra, edita e cancela
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select is((select count(*) from public.campanhas), 2::bigint,
  'Membro vê as campanhas ativas da igreja, mas não os rascunhos');

select lives_ok(
  $$ insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda,
       data_contribuicao, forma, status, confirmado_por, confirmado_em)
     values ('5a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000',
       '2a000000-0000-0000-0000-000000000003', 'dizimo', 30000, 'USD',
       current_date - 10, 'pix', 'confirmado', 'a0000000-0000-0000-0000-000000000003', now()) $$,
  'Membro registra o próprio dízimo, com data retroativa (RN-011)'
);
select results_eq(
  $$ select status::text, moeda::text, conta_id, criado_por, registrado_pela_tesouraria, confirmado_por
     from public.lancamentos where id = '5a000000-0000-0000-0000-000000000001' $$,
  $$ values ('aguardando', 'BRL', '3a000000-0000-0000-0000-000000000001'::uuid,
             'a0000000-0000-0000-0000-000000000003'::uuid, false, null::uuid) $$,
  'Banco define status, moeda da igreja, conta principal e autor; o app não força confirmação'
);
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'oferta', 5000, 'BRL', current_date, 'pix') $$,
  '22023', 'campanha_indisponivel',
  'Oferta sem campanha é recusada (RN-038)'
);
-- A regra também vale fora do app (ex.: funções internas), pela restrição da tabela.
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, campanha_id, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'dizimo',
       '4a000000-0000-0000-0000-000000000001', 5000, 'BRL', current_date, 'pix') $$,
  '23514', null,
  'Dízimo com campanha é recusado: campanha é só da oferta'
);
select lives_ok(
  $$ insert into public.lancamentos (id, igreja_id, membro_id, tipo, campanha_id, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('5a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
       '2a000000-0000-0000-0000-000000000003', 'oferta', '4a000000-0000-0000-0000-000000000001', 5000, 'BRL', current_date, 'pix') $$,
  'Membro registra oferta numa campanha ativa (RN-036)'
);
select is(
  (select conta_id from public.lancamentos where id = '5a000000-0000-0000-0000-000000000002'),
  '3a000000-0000-0000-0000-000000000002'::uuid,
  'Oferta vai para a conta da campanha (D-066)'
);
select lives_ok(
  $$ insert into public.lancamentos (id, igreja_id, membro_id, tipo, campanha_id, valor_informado_centavos, moeda, data_contribuicao, forma)
     select '5a000000-0000-0000-0000-000000000003', igreja_id, '2a000000-0000-0000-0000-000000000003', 'oferta', id, 2000, 'BRL', current_date, 'dinheiro'
     from public.campanhas where permanente $$,
  'Membro registra oferta comum na campanha Oferta'
);
select is(
  (select conta_id from public.lancamentos where id = '5a000000-0000-0000-0000-000000000003'),
  '3a000000-0000-0000-0000-000000000001'::uuid,
  'Campanha sem conta própria usa a conta principal'
);
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, campanha_id, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'oferta',
       '4a000000-0000-0000-0000-000000000002', 5000, 'BRL', current_date, 'pix') $$,
  '22023', 'campanha_indisponivel',
  'Oferta em campanha de rascunho é recusada'
);
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'dizimo', 1000, 'BRL', current_date, 'cheque') $$,
  '22023', 'forma_invalida',
  'Forma de devolução que a igreja não aceita é recusada'
);
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'dizimo', 1000, 'BRL', current_date + 1, 'pix') $$,
  '22023', 'data_futura',
  'Data no futuro é recusada'
);
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'dizimo', 0, 'BRL', current_date, 'pix') $$,
  '23514', null,
  'Valor zero é recusado'
);
select ok(
  public.existe_lancamento_igual('2a000000-0000-0000-0000-000000000003', 'dizimo', 30000, current_date - 10),
  'Mesmo valor na mesma data é detectado para o alerta de duplicado (RN-032)'
);
select ok(
  not public.existe_lancamento_igual('2a000000-0000-0000-0000-000000000003', 'dizimo', 31000, current_date - 10),
  'Valor diferente não dispara o alerta'
);
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000004', 'dizimo', 1000, 'BRL', current_date, 'pix') $$,
  '42501', null,
  'Membro não lança em nome de outro membro'
);
select lives_ok(
  $$ update public.lancamentos set valor_informado_centavos = 32000 where id = '5a000000-0000-0000-0000-000000000001' $$,
  'Membro edita o valor enquanto aguarda conferência (RN-013)'
);
select throws_ok(
  $$ update public.lancamentos set status = 'confirmado' where id = '5a000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'Membro não muda o status do lançamento'
);
select throws_ok(
  $$ update public.lancamentos set valor_conferido_centavos = 1 where id = '5a000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'Membro não preenche o valor conferido'
);
select throws_ok(
  $$ select public.cancelar_lancamento('5a000000-0000-0000-0000-000000000003', '  ') $$,
  '23502', 'motivo_obrigatorio',
  'Cancelar exige motivo (RN-016)'
);
select lives_ok(
  $$ select public.cancelar_lancamento('5a000000-0000-0000-0000-000000000003', 'Valor digitado errado') $$,
  'Membro cancela lançamento pendente (RN-015)'
);
select results_eq(
  $$ select status::text, motivo_cancelamento from public.lancamentos where id = '5a000000-0000-0000-0000-000000000003' $$,
  $$ values ('cancelado', 'Valor digitado errado') $$,
  'Cancelado continua no histórico, com o motivo (RN-017)'
);
select throws_ok(
  $$ update public.lancamentos set valor_informado_centavos = 2500 where id = '5a000000-0000-0000-0000-000000000003' $$,
  '42501', 'lancamento_bloqueado',
  'Lançamento cancelado não é mais editado'
);
select throws_ok(
  $$ delete from public.lancamentos where id = '5a000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'Ninguém apaga lançamento (RN-014)'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('comprovantes', '1a000000-0000-0000-0000-000000000000/5a000000-0000-0000-0000-000000000001/pix.pdf',
             'a0000000-0000-0000-0000-000000000003') $$,
  'Membro envia o arquivo do comprovante para o próprio lançamento'
);
select lives_ok(
  $$ insert into public.comprovantes (igreja_id, lancamento_id, arquivo_path, formato)
     values ('1a000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000001',
             '1a000000-0000-0000-0000-000000000000/5a000000-0000-0000-0000-000000000001/pix.pdf', 'pdf') $$,
  'Membro registra o comprovante no lançamento'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('comprovantes', '1a000000-0000-0000-0000-000000000000/5a000000-0000-0000-0000-000000000003/x.pdf',
             'a0000000-0000-0000-0000-000000000003') $$,
  '42501', null,
  'Não se anexa comprovante a lançamento cancelado'
);

reset role;


-- -----------------------------------------------------------------------------
-- Pedro: outro membro da mesma igreja
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000004');
set local role authenticated;

select is((select count(*) from public.lancamentos), 0::bigint,
  'Membro não vê lançamentos de outro membro');
select is((select count(*) from storage.objects where bucket_id = 'comprovantes'), 0::bigint,
  'Membro não vê comprovantes de outro membro');

reset role;


-- -----------------------------------------------------------------------------
-- Tiago: tesoureiro
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select is((select count(*) from public.lancamentos), 3::bigint,
  'Tesoureiro vê todos os lançamentos da igreja');
select is((select count(*) from storage.objects where bucket_id = 'comprovantes'), 1::bigint,
  'Tesoureiro vê os comprovantes da igreja');
select lives_ok(
  $$ insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('5a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000',
       '2a000000-0000-0000-0000-000000000004', 'dizimo', 15000, 'BRL', current_date, 'dinheiro') $$,
  'Tesoureiro lança em nome do membro (devolução presencial)'
);
select results_eq(
  $$ select status::text, registrado_pela_tesouraria, confirmado_por, confirmado_por_nome, criado_por
     from public.lancamentos where id = '5a000000-0000-0000-0000-000000000004' $$,
  $$ values ('confirmado', true, 'a0000000-0000-0000-0000-000000000002'::uuid, 'Tiago',
             'a0000000-0000-0000-0000-000000000002'::uuid) $$,
  'Devolução presencial nasce confirmada e registra quem lançou (RN-033)'
);
select lives_ok(
  $$ insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('5a000000-0000-0000-0000-000000000005', '1a000000-0000-0000-0000-000000000000',
       '2a000000-0000-0000-0000-000000000002', 'dizimo', 50000, 'BRL', current_date, 'pix') $$,
  'Tesoureiro registra o próprio dízimo'
);
select is(
  (select status::text from public.lancamentos where id = '5a000000-0000-0000-0000-000000000005'),
  'aguardando',
  'Dízimo do próprio tesoureiro vai para a fila; ele não se confirma (RN-034)'
);
select lives_ok(
  $$ insert into public.lancamentos (id, igreja_id, membro_id, tipo, campanha_id, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('5a000000-0000-0000-0000-000000000006', '1a000000-0000-0000-0000-000000000000',
       '2a000000-0000-0000-0000-000000000004', 'oferta', '4a000000-0000-0000-0000-000000000001', 7000, 'BRL', current_date, 'dinheiro') $$,
  'Tesoureiro lança oferta presencial numa campanha'
);
select results_eq(
  $$ select status::text, conta_id from public.lancamentos where id = '5a000000-0000-0000-0000-000000000006' $$,
  $$ values ('confirmado', '3a000000-0000-0000-0000-000000000002'::uuid) $$,
  'Oferta presencial nasce confirmada, na conta da campanha'
);
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1b000000-0000-0000-0000-000000000000', '2b000000-0000-0000-0000-000000000001', 'dizimo', 1000, 'BRL', current_date, 'dinheiro') $$,
  '42501', null,
  'Tesoureiro não lança para membro de outra igreja'
);
reset role;
update public.membros set status = 'inativo' where id = '2a000000-0000-0000-0000-000000000004';
set local role authenticated;
select throws_ok(
  $$ insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
     values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000004', 'dizimo', 1000, 'BRL', current_date, 'dinheiro') $$,
  '42501', 'membro_indisponivel',
  'Membro inativo não recebe lançamento (RN-035)'
);
reset role;
update public.membros set status = 'ativo' where id = '2a000000-0000-0000-0000-000000000004';
set local role authenticated;
update public.lancamentos set valor_informado_centavos = 1 where id = '5a000000-0000-0000-0000-000000000001';
select is(
  (select valor_informado_centavos from public.lancamentos where id = '5a000000-0000-0000-0000-000000000001'),
  32000::bigint,
  'Tesoureiro não altera o valor informado pelo membro (RN-018)'
);
select throws_ok(
  $$ insert into public.campanhas (igreja_id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Missões') $$,
  '42501', null,
  'Tesoureiro não cria campanha'
);

reset role;


-- -----------------------------------------------------------------------------
-- Bruno: outra igreja
-- -----------------------------------------------------------------------------

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;

select is((select count(*) from public.lancamentos where igreja_id = '1a000000-0000-0000-0000-000000000000'), 0::bigint,
  'Membro de outra igreja não vê lançamentos da Igreja A');
select is((select count(*) from public.campanhas where igreja_id = '1a000000-0000-0000-0000-000000000000'), 0::bigint,
  'Membro de outra igreja não vê campanhas da Igreja A');
select is((select count(*) from public.comprovantes), 0::bigint,
  'Membro de outra igreja não vê comprovantes da Igreja A');
select is((select count(*) from storage.objects), 0::bigint,
  'Membro de outra igreja não vê arquivos da Igreja A');

reset role;


-- -----------------------------------------------------------------------------
-- Ana: Pastora de Governo
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ insert into public.campanhas (igreja_id, nome, status, link_video)
     values ('1a000000-0000-0000-0000-000000000000', 'Missões', 'ativa', 'https://youtu.be/abc') $$,
  'Pastor de Governo cria campanha'
);
select throws_ok(
  $$ update public.campanhas set status = 'encerrada' where permanente $$,
  '23514', null,
  'A campanha permanente Oferta não pode ser encerrada'
);
select throws_ok(
  $$ insert into public.campanhas (igreja_id, nome, status, permanente)
     values ('1a000000-0000-0000-0000-000000000000', 'Outra permanente', 'ativa', true) $$,
  '42501', null,
  'Não se cria outra campanha permanente pelo app'
);
select is((select count(*) from public.campanhas where status = 'rascunho'), 1::bigint,
  'Pastor de Governo vê os rascunhos de campanha');

reset role;


-- -----------------------------------------------------------------------------
-- Auditoria (como dono do banco)
-- -----------------------------------------------------------------------------

select ok(
  exists (
    select 1 from public.auditoria
    where tabela = 'lancamentos'
      and registro_id = '5a000000-0000-0000-0000-000000000003'
      and depois ->> 'status' = 'cancelado'
      and motivo = 'Valor digitado errado'
      and usuario_id = 'a0000000-0000-0000-0000-000000000003'
  ),
  'O log registra o cancelamento com o motivo e quem cancelou'
);

select * from finish();
rollback;
