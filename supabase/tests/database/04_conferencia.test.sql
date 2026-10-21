-- Testes da conferência: fila por ordem de chegada, bloqueio entre
-- tesoureiros, confirmação, divergência (aceita e contestada), bloqueio
-- vencido, reabertura e isolamento entre igrejas.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago e Tânia (tesoureiros), Maria (membro)
--   Igreja B: Bruno (tesoureiro)
--   Fila da Igreja A, por ordem de chegada:
--     L3 (Tiago, 4 h atrás) > L1 (Maria, 3 h) > L2 (Maria, 2 h) > L4 (Maria, 1 h)

begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

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
  ('a0000000-0000-0000-0000-000000000005', 'tania@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000005', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000005', 'Tânia', 'tania@a.test', '5', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '9', 'tesoureiro', 'ativo');

insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda,
                                data_contribuicao, forma, registrado_em, criado_por) values
  ('5a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000002',
   'dizimo', 50000, 'BRL', current_date, 'pix', now() - interval '4 hours', 'a0000000-0000-0000-0000-000000000002'),
  ('5a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003',
   'dizimo', 30000, 'BRL', current_date, 'pix', now() - interval '3 hours', 'a0000000-0000-0000-0000-000000000003'),
  ('5a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003',
   'dizimo', 10000, 'BRL', current_date, 'pix', now() - interval '2 hours', 'a0000000-0000-0000-0000-000000000003'),
  ('5a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003',
   'dizimo', 5000, 'BRL', current_date, 'pix', now() - interval '1 hour', 'a0000000-0000-0000-0000-000000000003');


-- -----------------------------------------------------------------------------
-- Dois tesoureiros na fila ao mesmo tempo
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select is(
  (select id from public.abrir_proximo_da_fila('1a000000-0000-0000-0000-000000000000')),
  '5a000000-0000-0000-0000-000000000001'::uuid,
  'Tiago abre o primeiro da fila, pulando o próprio dízimo (RN-020, RN-034)'
);
select results_eq(
  $$ select status::text, em_conferencia_por from public.lancamentos where id = '5a000000-0000-0000-0000-000000000001' $$,
  $$ values ('em_conferencia', 'a0000000-0000-0000-0000-000000000002'::uuid) $$,
  'Lançamento fica "Em conferência por Tiago"'
);

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000005');
set local role authenticated;

select throws_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000001') $$,
  '55P03', 'em_conferencia_por_outro',
  'Tânia não abre o lançamento que Tiago está conferindo (RN-029)'
);
select is(
  (select id from public.abrir_proximo_da_fila('1a000000-0000-0000-0000-000000000000')),
  '5a000000-0000-0000-0000-000000000003'::uuid,
  'Tânia recebe o próximo, que é o dízimo do Tiago: outro tesoureiro confere'
);

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select throws_ok(
  $$ update public.lancamentos set valor_informado_centavos = 1 where id = '5a000000-0000-0000-0000-000000000001' $$,
  '42501', 'lancamento_bloqueado',
  'Membro não edita enquanto a tesouraria confere'
);
select throws_ok(
  $$ select public.cancelar_lancamento('5a000000-0000-0000-0000-000000000001', 'desisti') $$,
  '42501', 'lancamento_bloqueado',
  'Membro não cancela enquanto a tesouraria confere'
);


-- -----------------------------------------------------------------------------
-- Tiago confirma e registra divergência
-- -----------------------------------------------------------------------------

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select throws_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000003') $$,
  '42501', 'proprio_lancamento',
  'Tesoureiro não abre o próprio lançamento (RN-034)'
);
select throws_ok(
  $$ select public.confirmar_lancamento('5a000000-0000-0000-0000-000000000001', 29000) $$,
  '22023', 'registre_divergencia',
  'Valor diferente não se confirma: vira divergência'
);
select lives_ok(
  $$ select public.confirmar_lancamento('5a000000-0000-0000-0000-000000000001') $$,
  'Tiago confirma o lançamento (passo 7)'
);
select results_eq(
  $$ select status::text, valor_conferido_centavos, confirmado_por, confirmado_por_nome, em_conferencia_por
     from public.lancamentos where id = '5a000000-0000-0000-0000-000000000001' $$,
  $$ values ('confirmado', 30000::bigint, 'a0000000-0000-0000-0000-000000000002'::uuid, 'Tiago', null::uuid) $$,
  'Confirmação grava a assinatura e libera o bloqueio (passo 8)'
);
select throws_ok(
  $$ select public.confirmar_lancamento('5a000000-0000-0000-0000-000000000002') $$,
  '42501', 'conferencia_nao_aberta',
  'Não se confirma sem abrir a conferência'
);
select lives_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000002') $$,
  'Tiago abre um lançamento específico'
);
select throws_ok(
  $$ select public.registrar_divergencia('5a000000-0000-0000-0000-000000000002', 10000, 'igual') $$,
  '22023', 'valor_igual_ao_informado',
  'Divergência exige valor diferente do informado'
);
select throws_ok(
  $$ select public.registrar_divergencia('5a000000-0000-0000-0000-000000000002', 8000, ' ') $$,
  '23502', 'observacao_obrigatoria',
  'Divergência exige observação'
);
select lives_ok(
  $$ select public.registrar_divergencia('5a000000-0000-0000-0000-000000000002', 8000, 'Extrato mostra R$ 80,00') $$,
  'Tiago registra a divergência'
);
select results_eq(
  $$ select status::text, valor_informado_centavos, valor_conferido_centavos, divergencia_por_nome
     from public.lancamentos where id = '5a000000-0000-0000-0000-000000000002' $$,
  $$ values ('divergencia', 10000::bigint, 8000::bigint, 'Tiago') $$,
  'Valor informado não muda; o conferido fica ao lado (RN-018)'
);


-- -----------------------------------------------------------------------------
-- Maria contesta a divergência
-- -----------------------------------------------------------------------------

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select results_eq(
  $$ select membro_nome, valor_informado_centavos, valor_conferido_centavos, divergencia_sinalizada
     from public.lancamentos_detalhados where id = '5a000000-0000-0000-0000-000000000002' $$,
  $$ values ('Maria', 10000::bigint, 8000::bigint, false) $$,
  'Membro vê o valor informado e o conferido lado a lado'
);
select throws_ok(
  $$ select public.responder_divergencia('5a000000-0000-0000-0000-000000000002', false, '') $$,
  '23502', 'mensagem_obrigatoria',
  'Contestar exige mensagem'
);
select lives_ok(
  $$ select public.responder_divergencia('5a000000-0000-0000-0000-000000000002', false, 'Paguei R$ 100,00, envio o comprovante') $$,
  'Maria contesta a divergência (RN-030)'
);
select results_eq(
  $$ select status::text, resposta_membro::text from public.lancamentos where id = '5a000000-0000-0000-0000-000000000002' $$,
  $$ values ('divergencia', 'contestada') $$,
  'Contestada continua em divergência, sinalizada para a tesouraria'
);
select throws_ok(
  $$ select public.responder_divergencia('5a000000-0000-0000-0000-000000000002', true) $$,
  '42501', 'divergencia_indisponivel',
  'Divergência só é respondida uma vez por rodada'
);
select throws_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000004') $$,
  '42501', null,
  'Membro não abre conferência'
);
select throws_ok(
  $$ select public.reabrir_lancamento('5a000000-0000-0000-0000-000000000001', 'quero mudar') $$,
  '42501', null,
  'Membro não reabre lançamento confirmado'
);


-- -----------------------------------------------------------------------------
-- Tiago resolve a contestação; nova divergência que Maria aceita
-- -----------------------------------------------------------------------------

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select lives_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000002') $$,
  'Tesouraria reabre a conferência da divergência contestada'
);
select lives_ok(
  $$ select public.liberar_conferencia('5a000000-0000-0000-0000-000000000002') $$,
  'Tesoureiro sai da conferência sem decidir'
);
select is(
  (select status::text from public.lancamentos where id = '5a000000-0000-0000-0000-000000000002'),
  'divergencia',
  'Ao sair sem decidir, a contestada volta a ser divergência (não vai para a fila)'
);
select lives_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000002') $$,
  'Tesouraria abre de novo a contestada'
);
select throws_ok(
  $$ select public.confirmar_lancamento('5a000000-0000-0000-0000-000000000002') $$,
  '23502', 'valor_conferido_obrigatorio',
  'Ao resolver contestação, a tesouraria informa o valor conferido'
);
select lives_ok(
  $$ select public.confirmar_lancamento('5a000000-0000-0000-0000-000000000002', 10000) $$,
  'Tesouraria confirma com o valor que conferiu no comprovante'
);
select results_eq(
  $$ select status::text, valor_informado_centavos, valor_conferido_centavos from public.lancamentos
     where id = '5a000000-0000-0000-0000-000000000002' $$,
  $$ values ('confirmado', 10000::bigint, 10000::bigint) $$,
  'Contestação resolvida: confirmado'
);
select lives_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000004') $$,
  'Tiago abre outro lançamento da Maria'
);
select lives_ok(
  $$ select public.registrar_divergencia('5a000000-0000-0000-0000-000000000004', 4000, 'Chegaram R$ 40,00') $$,
  'Tiago registra nova divergência'
);

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select lives_ok(
  $$ select public.responder_divergencia('5a000000-0000-0000-0000-000000000004', true) $$,
  'Maria aceita a divergência'
);
select results_eq(
  $$ select status::text, valor_informado_centavos, valor_conferido_centavos, confirmado_por, confirmado_por_nome, resposta_membro::text
     from public.lancamentos where id = '5a000000-0000-0000-0000-000000000004' $$,
  $$ values ('confirmado', 5000::bigint, 4000::bigint, 'a0000000-0000-0000-0000-000000000002'::uuid, 'Tiago', 'aceita') $$,
  'Aceite confirma com o valor conferido, assinado por quem conferiu; o original fica guardado'
);


-- -----------------------------------------------------------------------------
-- Bloqueio parado por mais de 10 minutos (RN-029)
-- -----------------------------------------------------------------------------

reset role;

-- Tânia abriu L3 e saiu sem fechar há 11 minutos.
update public.lancamentos set em_conferencia_desde = now() - interval '11 minutes'
where id = '5a000000-0000-0000-0000-000000000003';

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000003') $$,
  'Bloqueio parado há mais de 10 minutos pode ser assumido por outro'
);
select is(
  (select em_conferencia_por from public.lancamentos where id = '5a000000-0000-0000-0000-000000000003'),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Agora o lançamento está em conferência pela Ana'
);

reset role;

update public.lancamentos set em_conferencia_desde = now() - interval '11 minutes'
where id = '5a000000-0000-0000-0000-000000000003';

select is(public.liberar_conferencias_paradas(), 1,
  'A rotina automática libera o bloqueio parado');
select is(
  (select status::text from public.lancamentos where id = '5a000000-0000-0000-0000-000000000003'),
  'aguardando',
  'O lançamento liberado volta para a fila'
);
select ok(
  exists (select 1 from cron.job where jobname = 'liberar-conferencias-paradas' and schedule = '* * * * *'),
  'A rotina está agendada para rodar a cada minuto'
);


-- -----------------------------------------------------------------------------
-- Reabertura (RN-031)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select throws_ok(
  $$ select public.reabrir_lancamento('5a000000-0000-0000-0000-000000000001', 'erro') $$,
  '42501', null,
  'Tesoureiro não reabre lançamento confirmado'
);

reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select throws_ok(
  $$ select public.reabrir_lancamento('5a000000-0000-0000-0000-000000000001', '') $$,
  '23502', 'justificativa_obrigatoria',
  'Reabrir exige justificativa'
);
select lives_ok(
  $$ select public.reabrir_lancamento('5a000000-0000-0000-0000-000000000001', 'Lançado na conta errada') $$,
  'Pastor de Governo reabre o lançamento confirmado'
);
select results_eq(
  $$ select status::text, valor_conferido_centavos, confirmado_por from public.lancamentos
     where id = '5a000000-0000-0000-0000-000000000001' $$,
  $$ values ('aguardando', null::bigint, null::uuid) $$,
  'Reaberto volta para a fila, sem a confirmação anterior'
);

reset role;

select ok(
  exists (
    select 1 from public.auditoria
    where tabela = 'lancamentos'
      and registro_id = '5a000000-0000-0000-0000-000000000001'
      and antes ->> 'status' = 'confirmado'
      and depois ->> 'status' = 'aguardando'
      and motivo = 'Lançado na conta errada'
      and perfil = 'administrador'
  ),
  'O log guarda a reabertura com a justificativa e a confirmação anterior'
);


-- -----------------------------------------------------------------------------
-- Divergência sem resposta há 15 dias (D-056)
-- -----------------------------------------------------------------------------

update public.lancamentos
   set status = 'divergencia',
       valor_conferido_centavos = 1000,
       divergencia_em = now() - interval '16 days',
       divergencia_por = 'a0000000-0000-0000-0000-000000000002'
 where id = '5a000000-0000-0000-0000-000000000003';

select pg_temp.entrar('a0000000-0000-0000-0000-000000000005');
set local role authenticated;

select ok(
  (select divergencia_sinalizada from public.lancamentos_detalhados where id = '5a000000-0000-0000-0000-000000000003'),
  'Divergência sem resposta há mais de 15 dias fica sinalizada para a tesouraria'
);

reset role;


-- -----------------------------------------------------------------------------
-- Outra igreja
-- -----------------------------------------------------------------------------

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;

select throws_ok(
  $$ select public.abrir_proximo_da_fila('1a000000-0000-0000-0000-000000000000') $$,
  '42501', null,
  'Tesoureiro de outra igreja não acessa a fila da Igreja A'
);
select throws_ok(
  $$ select public.abrir_conferencia('5a000000-0000-0000-0000-000000000004') $$,
  '42501', null,
  'Tesoureiro de outra igreja não abre lançamento da Igreja A'
);
select is((select count(*) from public.lancamentos_detalhados), 0::bigint,
  'Tesoureiro de outra igreja não vê lançamentos da Igreja A na visão da fila');

reset role;

select * from finish();
rollback;
