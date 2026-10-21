-- Testes da base: isolamento entre igrejas e entre membros, permissões por
-- perfil, número do dizimista, limite de contas e auditoria imutável.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora / Pastor de Governo), Tiago (tesoureiro),
--             Maria e Pedro (membros)
--   Igreja B: Bruno e Maria (Maria frequenta as duas igrejas)

begin;
create extension if not exists pgtap with schema extensions;

select plan(43);

-- "Entra" no banco como um usuário: define o token (JWT) da requisição.
create function pg_temp.entrar(p_usuario uuid, p_admin_master boolean default false)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_usuario,
      'role', 'authenticated',
      'app_metadata', json_build_object('admin_master', p_admin_master)
    )::text,
    true
  );
$$;


-- -----------------------------------------------------------------------------
-- Cenário (como dono do banco, sem RLS)
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@teste.test'),
  ('a0000000-0000-0000-0000-000000000004', 'pedro@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '11900000001', 'administrador', 'ativo'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '11900000002', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@teste.test', '11900000003', 'membro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000004', 'Pedro', 'pedro@a.test', '11900000004', 'membro', 'ativo'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '21900000001', 'membro', 'ativo'),
  ('2b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@teste.test', '11900000003', 'membro', 'ativo');

insert into public.contas (igreja_id, nome, principal, chave_pix, tipo_chave_pix, nome_recebedor, cidade) values
  ('1a000000-0000-0000-0000-000000000000', 'Dízimos e ofertas', true,
   'financeiro@a.test', 'email', 'IGREJA A', 'SAO PAULO'),
  ('1b000000-0000-0000-0000-000000000000', 'Dízimos e ofertas', true,
   'financeiro@b.test', 'email', 'IGREJA B', 'RIO DE JANEIRO');

select results_eq(
  $$ select numero from public.membros where igreja_id = '1a000000-0000-0000-0000-000000000000' order by numero $$,
  $$ values (1), (2), (3), (4) $$,
  'Número do dizimista é sequencial na Igreja A'
);

select results_eq(
  $$ select numero from public.membros where igreja_id = '1b000000-0000-0000-0000-000000000000' order by numero $$,
  $$ values (1), (2) $$,
  'Número do dizimista recomeça em cada igreja'
);

select throws_ok(
  $$ insert into public.membros (igreja_id, nome, email, celular)
     values ('1a000000-0000-0000-0000-000000000000', 'Outra Maria', 'MARIA@teste.test', '11900000009') $$,
  '23505', null,
  'E-mail já cadastrado na mesma igreja bloqueia novo cadastro, sem diferenciar maiúsculas (RN-028)'
);


-- -----------------------------------------------------------------------------
-- Maria: membro nas duas igrejas
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select is((select count(*) from public.igrejas), 2::bigint,
  'Maria vê as duas igrejas em que é membro (D-061)');
select is((select count(*) from public.membros), 2::bigint,
  'Maria vê só os próprios cadastros, um por igreja');
select is((select count(*) from public.membros where id = '2a000000-0000-0000-0000-000000000002'), 0::bigint,
  'Maria não vê o cadastro de outro membro da mesma igreja');

reset role;


-- -----------------------------------------------------------------------------
-- Bruno: membro da Igreja B
-- -----------------------------------------------------------------------------

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;

select is((select count(*) from public.igrejas where id = '1a000000-0000-0000-0000-000000000000'), 0::bigint,
  'Membro da Igreja B não vê a Igreja A');
select is((select count(*) from public.igrejas), 1::bigint,
  'Membro da Igreja B vê só a própria igreja');
select is((select count(*) from public.membros where igreja_id = '1a000000-0000-0000-0000-000000000000'), 0::bigint,
  'Membro da Igreja B não vê membros da Igreja A');
select is((select count(*) from public.contas where igreja_id = '1a000000-0000-0000-0000-000000000000'), 0::bigint,
  'Membro da Igreja B não vê as contas da Igreja A');
select is((select count(*) from public.contas), 1::bigint,
  'Membro vê as contas ativas da própria igreja (aba Igreja)');

select throws_ok(
  $$ insert into public.contas (igreja_id, nome) values ('1b000000-0000-0000-0000-000000000000', 'Conta falsa') $$,
  '42501', null,
  'Membro não cadastra conta da igreja'
);
select throws_ok(
  $$ update public.membros set perfil = 'tesoureiro' where id = '2b000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'Membro não muda o próprio perfil'
);
select lives_ok(
  $$ update public.membros set celular = '21988887777' where id = '2b000000-0000-0000-0000-000000000001' $$,
  'Membro altera os próprios dados (RN-009)'
);
select throws_ok(
  $$ delete from public.membros where id = '2b000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'Ninguém apaga cadastro de membro (RN-026)'
);
select is((select count(*) from public.auditoria), 0::bigint,
  'Membro não vê o log da igreja');

reset role;


-- -----------------------------------------------------------------------------
-- Tiago: tesoureiro da Igreja A
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select is((select count(*) from public.membros where igreja_id = '1a000000-0000-0000-0000-000000000000'), 4::bigint,
  'Tesoureiro vê todos os membros da própria igreja (D-057)');
select is((select count(*) from public.membros where igreja_id = '1b000000-0000-0000-0000-000000000000'), 0::bigint,
  'Tesoureiro não vê membros de outra igreja');

select lives_ok(
  $$ insert into public.membros (igreja_id, nome, email, celular, status)
     values ('1a000000-0000-0000-0000-000000000000', 'Lucas', 'lucas@a.test', '11900000005', 'ativo') $$,
  'Tesoureiro convida membro na própria igreja'
);
select results_eq(
  $$ select numero, status::text from public.membros where email = 'lucas@a.test' $$,
  $$ values (5, 'convidado') $$,
  'Convidado recebe o próximo número e nasce com status convidado, mesmo que o app peça outro'
);
select throws_ok(
  $$ insert into public.membros (igreja_id, nome, email, celular)
     values ('1b000000-0000-0000-0000-000000000000', 'Intruso', 'intruso@b.test', '21900000009') $$,
  '42501', null,
  'Tesoureiro não cadastra membro em outra igreja'
);
select throws_ok(
  $$ insert into public.membros (igreja_id, nome, email, celular, perfil)
     values ('1a000000-0000-0000-0000-000000000000', 'Novo Tesoureiro', 'novo@a.test', '11900000006', 'tesoureiro') $$,
  '42501', null,
  'Tesoureiro não cadastra outro tesoureiro'
);
select throws_ok(
  $$ update public.membros set perfil = 'tesoureiro' where id = '2a000000-0000-0000-0000-000000000003' $$,
  '42501', null,
  'Tesoureiro não altera perfil de membro'
);
select throws_ok(
  $$ update public.membros set nome = 'Maria Alterada' where id = '2a000000-0000-0000-0000-000000000003' $$,
  '42501', null,
  'Tesoureiro não altera dados cadastrais do membro'
);
select is((select count(*) from public.auditoria), 0::bigint,
  'Tesoureiro não vê o log da igreja (é do Pastor de Governo)');
select throws_ok(
  $$ insert into public.contas (igreja_id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Conta nova') $$,
  '42501', null,
  'Tesoureiro não cadastra conta da igreja'
);

reset role;


-- -----------------------------------------------------------------------------
-- Ana: Pastora de Governo (administradora) da Igreja A
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ update public.membros set perfil = 'tesoureiro' where id = '2a000000-0000-0000-0000-000000000003' $$,
  'Pastor de Governo autoriza um novo tesoureiro'
);
select throws_ok(
  $$ update public.membros set perfil = 'administrador' where id = '2a000000-0000-0000-0000-000000000002' $$,
  '42501', null,
  'Pastor de Governo não cria outro administrador (é do Admin Master)'
);
select lives_ok(
  $$ update public.membros set status = 'inativo' where id = '2a000000-0000-0000-0000-000000000004' $$,
  'Pastor de Governo inativa um membro'
);
select ok((select count(*) from public.auditoria where igreja_id = '1a000000-0000-0000-0000-000000000000') > 0,
  'Pastor de Governo vê o log da própria igreja');
select is((select count(*) from public.auditoria where igreja_id is distinct from '1a000000-0000-0000-0000-000000000000'), 0::bigint,
  'Pastor de Governo não vê o log de outra igreja');
select throws_ok(
  $$ update public.auditoria set motivo = 'adulterado' $$,
  '42501', null,
  'Ninguém do app altera o log'
);
select throws_ok(
  $$ insert into public.contas (igreja_id, nome, principal) values ('1a000000-0000-0000-0000-000000000000', 'Outra principal', true) $$,
  '23505', null,
  'Só pode haver uma conta principal por igreja'
);
select lives_ok(
  $$ insert into public.contas (igreja_id, nome) values
       ('1a000000-0000-0000-0000-000000000000', 'Construção do templo'),
       ('1a000000-0000-0000-0000-000000000000', 'Missões'),
       ('1a000000-0000-0000-0000-000000000000', 'Ação social'),
       ('1a000000-0000-0000-0000-000000000000', 'Jovens') $$,
  'Pastor de Governo cadastra contas até o limite de 5'
);
select throws_ok(
  $$ insert into public.contas (igreja_id, nome) values ('1a000000-0000-0000-0000-000000000000', 'Sexta conta') $$,
  '23514', null,
  'A sexta conta ativa é bloqueada (D-066)'
);
select throws_ok(
  $$ update public.igrejas set status = 'inativa' where id = '1a000000-0000-0000-0000-000000000000' $$,
  '42501', null,
  'Pastor de Governo não altera o status da igreja (é do Admin Master)'
);
select lives_ok(
  $$ update public.igrejas set cor_principal = '#1A5E3A' where id = '1a000000-0000-0000-0000-000000000000' $$,
  'Pastor de Governo personaliza a cor da igreja'
);

reset role;


-- -----------------------------------------------------------------------------
-- Pedro: membro inativado
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000004');
set local role authenticated;

select is((select count(*) from public.igrejas), 0::bigint,
  'Membro inativo perde o acesso à igreja (RN-035)');
select is((select count(*) from public.membros), 0::bigint,
  'Membro inativo não vê mais o próprio cadastro pelo app');

reset role;


-- -----------------------------------------------------------------------------
-- Visitante sem login e Admin Master
-- -----------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select throws_ok(
  $$ select count(*) from public.igrejas $$,
  '42501', null,
  'Sem login não se acessa nenhum dado'
);

reset role;

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select is((select count(*) from public.igrejas), 2::bigint,
  'Admin Master vê todas as igrejas');

reset role;


-- -----------------------------------------------------------------------------
-- Auditoria (como dono do banco)
-- -----------------------------------------------------------------------------

select ok(
  exists (
    select 1 from public.auditoria
    where tabela = 'membros'
      and acao = 'update'
      and usuario_id = 'a0000000-0000-0000-0000-000000000001'
      and perfil = 'administrador'
      and antes ->> 'perfil' = 'membro'
      and depois ->> 'perfil' = 'tesoureiro'
  ),
  'O log guarda quem, perfil, antes e depois da mudança de perfil'
);
select throws_ok(
  $$ delete from public.auditoria $$,
  '42501', null,
  'Nem o dono do banco apaga o log'
);

select * from finish();
rollback;
