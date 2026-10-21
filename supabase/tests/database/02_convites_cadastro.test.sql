-- Testes de convite, primeiro acesso, campos do cadastro, aceite dos termos,
-- dispositivos e do hook que bloqueia login sem convite.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro); campos do cadastro:
--             lider (texto, obrigatório), nascimento (data), rede (lista, obrigatório)
--   Igreja B: Bruno (membro)
--   Lucas: convidado pela tesouraria da Igreja A durante o teste

begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

create function pg_temp.entrar(p_usuario uuid, p_email text default null, p_admin_master boolean default false)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_usuario,
      'email', p_email,
      'role', 'authenticated',
      'app_metadata', json_build_object('admin_master', p_admin_master)
    )::text,
    true
  );
$$;


-- -----------------------------------------------------------------------------
-- Cenário
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001',
   'Ana', 'ana@a.test', '11900000001', 'administrador', 'ativo'),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002',
   'Tiago', 'tiago@a.test', '11900000002', 'tesoureiro', 'ativo'),
  ('1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001',
   'Bruno', 'bruno@b.test', '21900000001', 'membro', 'ativo');

insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo, opcoes, obrigatorio, ordem) values
  ('1a000000-0000-0000-0000-000000000000', 'lider', 'Líder', 'texto', '{}', true, 1),
  ('1a000000-0000-0000-0000-000000000000', 'nascimento', 'Data de nascimento', 'data', '{}', false, 2),
  ('1a000000-0000-0000-0000-000000000000', 'rede', 'Rede', 'lista', '{Norte,Sul}', true, 3);


-- -----------------------------------------------------------------------------
-- Tiago (tesoureiro) convida
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002', 'tiago@a.test');
set local role authenticated;

select isnt(
  public.convidar_membro('1a000000-0000-0000-0000-000000000000', 'Lucas', ' Lucas@A.test ', '11900000005'),
  null::uuid,
  'Tesoureiro convida membro e recebe o id da ficha'
);
select results_eq(
  $$ select email, status::text from public.membros where email = 'lucas@a.test' $$,
  $$ values ('lucas@a.test', 'convidado') $$,
  'Ficha nasce convidada, com e-mail normalizado'
);
select results_eq(
  $$ select c.expira_em - c.enviado_em, c.enviado_por
     from public.convites c join public.membros m on m.id = c.membro_id
     where m.email = 'lucas@a.test' $$,
  $$ values (interval '7 days', 'a0000000-0000-0000-0000-000000000002'::uuid) $$,
  'Convite vale 7 dias e registra quem enviou (RN-027)'
);
select throws_ok(
  $$ select public.convidar_membro('1a000000-0000-0000-0000-000000000000', 'Lucas 2', 'LUCAS@a.test', '11900000006') $$,
  '23505', 'email_ja_cadastrado',
  'E-mail já cadastrado na igreja bloqueia o convite com aviso (RN-028)'
);
select throws_ok(
  $$ select public.convidar_membro('1b000000-0000-0000-0000-000000000000', 'Intruso', 'intruso@b.test', '21900000009') $$,
  '42501', null,
  'Tesoureiro não convida para outra igreja'
);
select lives_ok(
  $$ select public.reenviar_convite((select id from public.membros where email = 'lucas@a.test')) $$,
  'Tesoureiro reenvia o convite'
);
select is(
  (select count(*) from public.convites c join public.membros m on m.id = c.membro_id where m.email = 'lucas@a.test'),
  2::bigint,
  'Reenviar cria um novo registro de convite'
);
select throws_ok(
  $$ update public.convites set expira_em = now() + interval '1 year' $$,
  '42501', null,
  'Tesoureiro não altera um convite registrado'
);
select throws_ok(
  $$ insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo)
     values ('1a000000-0000-0000-0000-000000000000', 'setor', 'Setor', 'texto') $$,
  '42501', null,
  'Tesoureiro não define campos do cadastro'
);

reset role;


-- -----------------------------------------------------------------------------
-- Bruno (outra igreja) e visitante sem login
-- -----------------------------------------------------------------------------

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');
set local role authenticated;

select is((select count(*) from public.convites), 0::bigint,
  'Membro de outra igreja não vê convites da Igreja A');
select is((select count(*) from public.campos_cadastro), 0::bigint,
  'Membro de outra igreja não vê os campos do cadastro da Igreja A');

reset role;

select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select throws_ok(
  $$ select public.convidar_membro('1a000000-0000-0000-0000-000000000000', 'X', 'x@a.test', '1') $$,
  '42501', null,
  'Sem login não se chama a função de convite'
);

reset role;


-- -----------------------------------------------------------------------------
-- Hook do Auth: só cria login com convite válido (RN-002)
-- -----------------------------------------------------------------------------

select is(
  public.hook_antes_de_criar_usuario('{"user": {"email": "LUCAS@a.test"}}'),
  '{}'::jsonb,
  'Hook libera o login de quem tem convite válido'
);
select is(
  public.hook_antes_de_criar_usuario('{"user": {"email": "desconhecido@x.test"}}') -> 'error' ->> 'message',
  'convite_nao_encontrado',
  'Hook recusa e-mail sem convite'
);

-- Convite vencido: ficha e convite criados direto pelo dono do banco com data antiga.
insert into public.membros (igreja_id, nome, email, celular)
values ('1a000000-0000-0000-0000-000000000000', 'Vencido', 'vencido@a.test', '11900000007');
insert into public.convites (igreja_id, membro_id, enviado_em, expira_em)
select igreja_id, id, now() - interval '8 days', now() - interval '1 day'
from public.membros where email = 'vencido@a.test';

select is(
  public.hook_antes_de_criar_usuario('{"user": {"email": "vencido@a.test"}}') -> 'error' ->> 'http_code',
  '403',
  'Hook recusa convite vencido (mais de 7 dias)'
);
select is(
  public.hook_antes_de_criar_usuario('{"user": {"email": "dono@plataforma.test", "app_metadata": {"admin_master": true}}}'),
  '{}'::jsonb,
  'Hook libera a criação do Admin Master pelo servidor'
);


-- -----------------------------------------------------------------------------
-- Lucas: primeiro acesso
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values ('c0000000-0000-0000-0000-000000000001', 'lucas@a.test');

select pg_temp.entrar('c0000000-0000-0000-0000-000000000001', 'lucas@a.test');
set local role authenticated;

select results_eq(
  $$ select * from public.aceitar_convites() $$,
  $$ values ('1a000000-0000-0000-0000-000000000000'::uuid) $$,
  'Aceitar convites liga o login à Igreja A'
);
select results_eq(
  $$ select usuario_id, status::text from public.membros $$,
  $$ values ('c0000000-0000-0000-0000-000000000001'::uuid, 'convidado') $$,
  'Ficha ligada ao login, ainda convidada até concluir o cadastro'
);
select is((select count(*) from public.campos_cadastro), 3::bigint,
  'Convidado vê os campos do cadastro da sua igreja');
select is((select count(*) from public.aceitar_convites()), 0::bigint,
  'Convite já aceito não é aceito de novo');

select throws_ok(
  $$ select public.concluir_cadastro((select id from public.membros), 'Lucas Silva', '11900000005',
       'individual', '[]', '{"lider": "Carlos"}', '1.0') $$,
  '23502', 'campo_obrigatorio',
  'Cadastro não conclui sem campo obrigatório da igreja'
);
select throws_ok(
  $$ select public.concluir_cadastro((select id from public.membros), 'Lucas Silva', '11900000005',
       'individual', '[]', '{"lider": "Carlos", "rede": "Leste"}', '1.0') $$,
  '22023', 'campo_invalido',
  'Valor fora da lista de opções é recusado'
);
select throws_ok(
  $$ select public.concluir_cadastro((select id from public.membros), 'Lucas Silva', '11900000005',
       'individual', '[]', '{"lider": "Carlos", "rede": "Sul", "nascimento": "2026-02-30"}', '1.0') $$,
  '22008', null,
  'Data inexistente é recusada'
);
select throws_ok(
  $$ select public.concluir_cadastro((select id from public.membros), 'Lucas Silva', '11900000005',
       'individual', '[]', '{"lider": "Carlos", "rede": "Sul", "time": "X"}', '1.0') $$,
  '22023', 'campo_desconhecido',
  'Campo que a igreja não definiu é recusado'
);
select throws_ok(
  $$ select public.concluir_cadastro((select id from public.membros), 'Lucas Silva', '11900000005',
       'familiar', '[]', '{"lider": "Carlos", "rede": "Sul"}', '1.0') $$,
  '23502', 'familiares_obrigatorios',
  'Dízimo familiar exige os nomes da família'
);
select lives_ok(
  $$ select public.concluir_cadastro((select id from public.membros), 'Lucas Silva', '11900000005',
       'familiar', '[{"nome": "Joana", "parentesco": "esposa"}]',
       '{"lider": "Carlos", "rede": "Sul", "nascimento": "1990-05-17"}', '1.0') $$,
  'Cadastro completo é concluído'
);
select results_eq(
  $$ select status::text, tipo_dizimo::text from public.membros $$,
  $$ values ('ativo', 'familiar') $$,
  'Membro fica ativo após concluir o cadastro'
);
select results_eq(
  $$ select versao from public.aceites_termos $$,
  $$ values ('1.0') $$,
  'Aceite dos termos registrado com a versão (RN-041)'
);
select throws_ok(
  $$ update public.aceites_termos set versao = '0.9' $$,
  '42501', null,
  'Aceite dos termos não pode ser alterado'
);
select throws_ok(
  $$ select public.reenviar_convite((select id from public.membros)) $$,
  'P0002', 'convite_indisponivel',
  'Não há reenvio de convite para membro já ativo'
);

select lives_ok(
  $$ select public.registrar_dispositivo('ExponentPushToken[abc]', 'android') $$,
  'Membro registra o aparelho para receber push'
);
select is((select count(*) from public.dispositivos), 1::bigint,
  'Membro vê o próprio aparelho');

reset role;


-- -----------------------------------------------------------------------------
-- Tiago e Ana
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002', 'tiago@a.test');
set local role authenticated;

select is((select count(*) from public.dispositivos), 0::bigint,
  'Ninguém vê os aparelhos de outra pessoa');
select lives_ok(
  $$ select public.registrar_dispositivo('ExponentPushToken[abc]', 'android') $$,
  'Aparelho que troca de conta passa para o novo usuário'
);

reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001', 'ana@a.test');
set local role authenticated;

select throws_ok(
  $$ update public.campos_cadastro set tipo = 'numero' where chave = 'lider' $$,
  '42501', null,
  'Tipo do campo não muda depois de criado'
);

reset role;


-- -----------------------------------------------------------------------------
-- Auditoria e troca de e-mail (como dono do banco)
-- -----------------------------------------------------------------------------

select ok(
  exists (
    select 1 from public.auditoria
    where tabela = 'convites' and acao = 'insert'
      and usuario_id = 'a0000000-0000-0000-0000-000000000002' and perfil = 'tesoureiro'
  ),
  'O log registra o convite enviado pelo tesoureiro'
);

update auth.users set email = 'lucas.novo@a.test' where id = 'c0000000-0000-0000-0000-000000000001';

select is(
  (select email from public.membros where usuario_id = 'c0000000-0000-0000-0000-000000000001'),
  'lucas.novo@a.test',
  'E-mail confirmado no login atualiza a ficha do membro (RN-010)'
);

select * from finish();
rollback;
