-- Testes da retirada de comprovante (D-083): o membro retira sem apagar,
-- só enquanto o lançamento aguarda conferência ou está em divergência.
-- Rodar com: npx supabase test db

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

create function pg_temp.entrar(p_usuario uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'pedro@a.test');

insert into public.igrejas (id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Igreja A');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000004', 'Pedro', 'pedro@a.test', '4', 'membro', 'ativo');

-- L1 aguardando, L2 confirmado (lançamentos da Maria)
insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma,
                                status, confirmado_por, confirmado_em, criado_por) values
  ('5a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003',
   'dizimo', 30000, 'BRL', current_date, 'pix', 'aguardando', null, null, 'a0000000-0000-0000-0000-000000000003'),
  ('5a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003',
   'dizimo', 20000, 'BRL', current_date, 'pix', 'confirmado', 'a0000000-0000-0000-0000-000000000002', now(),
   'a0000000-0000-0000-0000-000000000003');

insert into public.comprovantes (id, igreja_id, lancamento_id, arquivo_path, formato) values
  ('6a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000001',
   '1a000000-0000-0000-0000-000000000000/5a000000-0000-0000-0000-000000000001/errado.jpg', 'jpg'),
  ('6a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000002',
   '1a000000-0000-0000-0000-000000000000/5a000000-0000-0000-0000-000000000002/certo.jpg', 'jpg');

-- Pedro (outro membro)
select pg_temp.entrar('a0000000-0000-0000-0000-000000000004');
set local role authenticated;

select throws_ok(
  $$ select public.retirar_comprovante('6a000000-0000-0000-0000-000000000001') $$,
  '42501', 'comprovante_indisponivel',
  'Outro membro não retira comprovante alheio'
);

reset role;

-- Tiago (tesoureiro): a retirada é do membro, não da tesouraria
select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select throws_ok(
  $$ select public.retirar_comprovante('6a000000-0000-0000-0000-000000000001') $$,
  '42501', 'comprovante_indisponivel',
  'Tesoureiro não retira comprovante do membro'
);

reset role;

-- Maria (dona)
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select throws_ok(
  $$ select public.retirar_comprovante('6a000000-0000-0000-0000-000000000002') $$,
  '42501', 'comprovante_travado',
  'Comprovante de lançamento confirmado não é retirado'
);
select lives_ok(
  $$ select public.retirar_comprovante('6a000000-0000-0000-0000-000000000001') $$,
  'Membro retira o comprovante errado de um lançamento aguardando conferência'
);
select throws_ok(
  $$ select public.retirar_comprovante('6a000000-0000-0000-0000-000000000001') $$,
  '42501', 'comprovante_indisponivel',
  'Comprovante já retirado não é retirado de novo'
);
select throws_ok(
  $$ update public.comprovantes set retirado_em = null where id = '6a000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'Membro não desfaz a retirada por fora da função'
);
select throws_ok(
  $$ delete from public.comprovantes where id = '6a000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'Ninguém apaga o comprovante (RN-026)'
);

reset role;

-- Como dono do banco: o registro continua lá, marcado, e o log guarda a retirada
select results_eq(
  $$ select arquivo_path, retirado_por from public.comprovantes where id = '6a000000-0000-0000-0000-000000000001' $$,
  $$ values ('1a000000-0000-0000-0000-000000000000/5a000000-0000-0000-0000-000000000001/errado.jpg',
             'a0000000-0000-0000-0000-000000000003'::uuid) $$,
  'Comprovante retirado continua guardado, com quem retirou'
);
select ok(
  (select retirado_em is not null from public.comprovantes where id = '6a000000-0000-0000-0000-000000000001'),
  'A data da retirada fica registrada'
);
select ok(
  exists (
    select 1 from public.auditoria
    where tabela = 'comprovantes' and acao = 'update'
      and registro_id = '6a000000-0000-0000-0000-000000000001'
      and antes ->> 'retirado_em' is null and depois ->> 'retirado_em' is not null
  ),
  'O log registra a retirada'
);

select * from finish();
rollback;
