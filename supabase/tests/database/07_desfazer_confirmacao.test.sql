-- Testes de desfazer confirmação (D-084): só quem confirmou, em até 15
-- minutos, com motivo; não vale para o aceite do membro.
-- Rodar com: npx supabase test db

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

create function pg_temp.entrar(p_usuario uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000005', 'tania@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test');

insert into public.igrejas (id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Igreja A');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000005', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000005', 'Tânia', 'tania@a.test', '5', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo');

-- Lançamentos da Maria confirmados por Tiago:
--   L1 agora; L2 há 16 minutos; L3 confirmado porque Maria aceitou a divergência.
insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, valor_conferido_centavos, moeda,
                                data_contribuicao, forma, status, confirmado_por, confirmado_por_nome, confirmado_em,
                                resposta_membro, criado_por) values
  ('5a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003',
   'dizimo', 30000, 30000, 'BRL', current_date, 'pix', 'confirmado', 'a0000000-0000-0000-0000-000000000002', 'Tiago', now(),
   null, 'a0000000-0000-0000-0000-000000000003'),
  ('5a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003',
   'dizimo', 20000, 20000, 'BRL', current_date, 'pix', 'confirmado', 'a0000000-0000-0000-0000-000000000002', 'Tiago',
   now() - interval '16 minutes', null, 'a0000000-0000-0000-0000-000000000003'),
  ('5a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003',
   'dizimo', 5000, 4000, 'BRL', current_date, 'pix', 'confirmado', 'a0000000-0000-0000-0000-000000000002', 'Tiago', now(),
   'aceita', 'a0000000-0000-0000-0000-000000000003');

-- Tânia: outro tesoureiro
select pg_temp.entrar('a0000000-0000-0000-0000-000000000005');
set local role authenticated;
select throws_ok(
  $$ select public.desfazer_confirmacao('5a000000-0000-0000-0000-000000000001', 'engano') $$,
  '42501', 'desfazer_indisponivel',
  'Só quem confirmou desfaz a própria confirmação'
);
reset role;

-- Maria: membro
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ select public.desfazer_confirmacao('5a000000-0000-0000-0000-000000000001', 'engano') $$,
  '42501', 'lancamento_indisponivel',
  'Membro não desfaz confirmação'
);
reset role;

-- Tiago: quem confirmou
select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ select public.desfazer_confirmacao('5a000000-0000-0000-0000-000000000001', '  ') $$,
  '23502', 'motivo_obrigatorio',
  'Desfazer exige motivo'
);
select throws_ok(
  $$ select public.desfazer_confirmacao('5a000000-0000-0000-0000-000000000002', 'engano') $$,
  '42501', 'prazo_para_desfazer_vencido',
  'Depois de 15 minutos, só o Pastor de Governo reabre (RN-031)'
);
select throws_ok(
  $$ select public.desfazer_confirmacao('5a000000-0000-0000-0000-000000000003', 'engano') $$,
  '42501', 'desfazer_indisponivel',
  'Não se desfaz o aceite de divergência: quem decidiu foi o membro'
);
select lives_ok(
  $$ select public.desfazer_confirmacao('5a000000-0000-0000-0000-000000000001', 'Confirmei o lançamento errado') $$,
  'Quem confirmou desfaz em até 15 minutos'
);
select results_eq(
  $$ select status::text, confirmado_por, valor_conferido_centavos from public.lancamentos
     where id = '5a000000-0000-0000-0000-000000000001' $$,
  $$ values ('aguardando', null::uuid, null::bigint) $$,
  'O lançamento volta para a fila, sem a confirmação'
);
select throws_ok(
  $$ select public.desfazer_confirmacao('5a000000-0000-0000-0000-000000000001', 'de novo') $$,
  '42501', 'desfazer_indisponivel',
  'Não se desfaz duas vezes'
);
reset role;

select ok(
  exists (
    select 1 from public.auditoria
    where tabela = 'lancamentos' and registro_id = '5a000000-0000-0000-0000-000000000001'
      and antes ->> 'status' = 'confirmado' and depois ->> 'status' = 'aguardando'
      and motivo = 'Confirmei o lançamento errado' and perfil = 'tesoureiro'
  ),
  'O log guarda a confirmação desfeita, quem desfez e o motivo'
);

select * from finish();
rollback;
