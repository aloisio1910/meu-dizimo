-- Testes da visão da fila (T-01): nome de quem confere, conta de destino,
-- comprovante retirado não conta, e o membro não vê o nome do tesoureiro.
-- Rodar com: npx supabase test db

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

create function pg_temp.entrar(p_usuario uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test');

insert into public.igrejas (id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Igreja A');
insert into public.contas (igreja_id, nome, principal) values ('1a000000-0000-0000-0000-000000000000', 'Dízimos e ofertas', true);

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo');

-- Maria registra; o comprovante dela é retirado em seguida.
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
values ('5a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000',
        '2a000000-0000-0000-0000-000000000003', 'dizimo', 30000, 'BRL', current_date, 'pix');
reset role;

insert into public.comprovantes (id, igreja_id, lancamento_id, arquivo_path, formato, retirado_em, retirado_por) values
  ('6a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000001',
   '1a000000-0000-0000-0000-000000000000/5a000000-0000-0000-0000-000000000001/errado.jpg', 'jpg',
   now(), 'a0000000-0000-0000-0000-000000000003');

-- Tiago abre a conferência
select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select public.abrir_proximo_da_fila('1a000000-0000-0000-0000-000000000000');

select is(
  (select em_conferencia_por_nome from public.lancamentos_detalhados where id = '5a000000-0000-0000-0000-000000000001'),
  'Tiago',
  'A fila mostra quem está conferindo'
);
select is(
  (select conta_nome from public.lancamentos_detalhados where id = '5a000000-0000-0000-0000-000000000001'),
  'Dízimos e ofertas',
  'A fila mostra a conta de destino'
);
select is(
  (select tem_comprovante from public.lancamentos_detalhados where id = '5a000000-0000-0000-0000-000000000001'),
  false,
  'Comprovante retirado pelo membro não conta como comprovante na fila'
);

reset role;

-- Maria vê o próprio lançamento na visão, mas não o nome do tesoureiro
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select is((select count(*) from public.lancamentos_detalhados), 1::bigint,
  'Membro vê o próprio lançamento na visão');
select is(
  (select em_conferencia_por_nome from public.lancamentos_detalhados where id = '5a000000-0000-0000-0000-000000000001'),
  null,
  'Membro não vê o nome de quem está conferindo (a ficha do tesoureiro é invisível para ele)'
);

reset role;

select * from finish();
rollback;
