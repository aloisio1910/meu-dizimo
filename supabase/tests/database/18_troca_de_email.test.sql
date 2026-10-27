-- Testes da troca de e-mail pela tesouraria (D-097): quem troca o e-mail de
-- quem, o motivo no log e o caminho único da troca.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (Pastora), Tiago e Tânia (tesoureiros), Maria (membro),
--             Carla (convidada), Rui (inativo), Paulo (membro também na B)
--   Igreja B: Bruno (tesoureiro), Paulo

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

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

-- A troca como a Edge Function faz: chave service_role, em nome de alguém.
create function pg_temp.trocar(p_autor uuid, p_membro uuid, p_email text, p_motivo text default 'Perdeu o acesso')
returns jsonb
language plpgsql
as $$
declare
  v jsonb;
begin
  set local role service_role;
  v := public.trocar_email_do_membro(p_autor, p_membro, p_email, p_motivo);
  reset role;
  return v;
end;
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000005', 'tania@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'rui@a.test'),
  ('a0000000-0000-0000-0000-000000000006', 'paulo@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome, titulo_administrador) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A', 'Pastor Presidente'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B', 'Pastor de Governo');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000005', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'Tânia', 'tania@a.test', '5', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'Rui', 'rui@a.test', '4', 'membro', 'inativo'),
  ('2a000000-0000-0000-0000-000000000006', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000006', 'Paulo', 'paulo@a.test', '6', 'membro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000007', '1a000000-0000-0000-0000-000000000000', null, 'Carla', 'carla@a.test', '7', 'membro', 'convidado'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '8', 'tesoureiro', 'ativo'),
  ('2b000000-0000-0000-0000-000000000006', '1b000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000006', 'Paulo', 'paulo@a.test', '9', 'membro', 'ativo');


-- -----------------------------------------------------------------------------
-- Quem troca o e-mail de quem
-- -----------------------------------------------------------------------------

select is(
  pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000003', ' Maria.Nova@Gmail.com ') ->> 'email_antigo',
  'maria@a.test',
  'Tesoureiro troca o e-mail de um membro ativo e recebe o e-mail antigo de volta'
);
select is(
  (select email from public.membros where id = '2a000000-0000-0000-0000-000000000003'),
  'maria.nova@gmail.com',
  'O e-mail novo fica gravado em minúsculas e sem espaços'
);
select is(
  (select motivo || ' / ' || perfil from public.auditoria
    where tabela = 'membros' and registro_id = '2a000000-0000-0000-0000-000000000003' and acao = 'update'
    order by criado_em desc limit 1),
  'Perdeu o acesso / tesoureiro',
  'A troca fica no log com o motivo e quem trocou'
);
select is(
  pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000007', 'carla.certo@a.test') ->> 'usuario_id',
  null,
  'Convidado (ainda sem login) também pode ter o e-mail trocado'
);
select lives_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000005', 'tania.nova@a.test') $$,
  'Tesoureiro troca o e-mail de outro tesoureiro'
);
select lives_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000002', 'tiago.novo@a.test') $$,
  'Pastor troca o e-mail de um tesoureiro'
);
select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000002', 'eu@a.test') $$,
  '42501', 'email_proprio',
  'Ninguém troca o próprio e-mail'
);
select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000001', 'pastor@a.test') $$,
  '42501', 'pastor_pelo_suporte',
  'O e-mail do Pastor de Governo só pelo suporte'
);
select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000003', '2a000000-0000-0000-0000-000000000006', 'x@a.test') $$,
  '42501', 'sem_permissao',
  'Membro não troca o e-mail de ninguém'
);
select throws_ok(
  $$ select pg_temp.trocar('b0000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000006', 'x@a.test') $$,
  '42501', 'sem_permissao',
  'Tesoureiro de outra igreja não troca'
);
select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000006', 'paulo.novo@a.test') $$,
  '42501', 'esta_em_outra_igreja',
  'Quem também está em outra igreja, só pelo suporte'
);
select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000004', 'rui.novo@a.test') $$,
  '42501', 'membro_inativo',
  'Inativo precisa ser reativado antes'
);


-- -----------------------------------------------------------------------------
-- Conferências do pedido
-- -----------------------------------------------------------------------------

select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000006', 'p@a.test', ' ok ') $$,
  '22023', 'motivo_obrigatorio',
  'Motivo é obrigatório'
);
select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000006', 'sem-arroba') $$,
  '22023', 'email_invalido',
  'E-mail precisa ser válido'
);
select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000007', 'tania.nova@a.test') $$,
  '23505', 'email_ja_cadastrado',
  'E-mail de outra pessoa da igreja é recusado'
);
select throws_ok(
  $$ select pg_temp.trocar('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000007', 'bruno@b.test') $$,
  '23505', 'email_ja_tem_login',
  'E-mail que já é login de alguém é recusado (juntar contas é com o suporte)'
);


-- -----------------------------------------------------------------------------
-- Caminho único: só pela troca, nunca direto na tabela
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ update public.membros set email = 'direto@a.test' where id = '2a000000-0000-0000-0000-000000000007' $$,
  '42501', 'use_a_troca_de_email',
  'A tesouraria não troca e-mail direto na tabela, nem de convidado'
);
select throws_ok(
  $$ select public.trocar_email_do_membro('a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000006', 'x@a.test', 'motivo') $$,
  '42501', null,
  'O app não chama a função da troca direto (só a Edge Function)'
);
reset role;


-- -----------------------------------------------------------------------------
-- Aviso no celular e desfazer
-- -----------------------------------------------------------------------------

set local role service_role;
select public.avisar_troca_de_email('2a000000-0000-0000-0000-000000000003');
reset role;
select is(
  (select dados ->> 'email' from public.notificacoes
    where usuario_id = 'a0000000-0000-0000-0000-000000000003' and tipo = 'email_alterado'),
  'maria.nova@gmail.com',
  'A pessoa recebe o aviso com o novo e-mail'
);

set local role service_role;
select public.desfazer_troca_de_email(
  'a0000000-0000-0000-0000-000000000002', '2a000000-0000-0000-0000-000000000003', 'maria@a.test'
);
reset role;
select is(
  (select email from public.membros where id = '2a000000-0000-0000-0000-000000000003'),
  'maria@a.test',
  'Se a troca do login falhar, a ficha volta ao e-mail de antes'
);

select * from finish();
rollback;
