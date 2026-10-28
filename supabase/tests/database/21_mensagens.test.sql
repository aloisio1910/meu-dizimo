-- Testes das mensagens aos membros e dos avisos da plataforma (D-102): quem
-- envia, quem recebe, o limite de 1 por semana e o que fica no log.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Dono: Admin Master
--   Igreja A: Ana (Pastora), Tiago (tesoureiro), Maria (Célula Norte),
--             João (Célula Sul, desligou as mensagens), Rui (inativo)
--   Igreja B: Bruno (tesoureiro), e Maria também

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

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

create function pg_temp.recebeu(p_email text, p_tipo text)
returns bigint
language sql
as $$
  select count(*) from public.notificacoes n join auth.users u on u.id = n.usuario_id
   where u.email = p_email and n.tipo = p_tipo;
$$;

insert into auth.users (id, email, raw_app_meta_data) values
  ('f0000000-0000-0000-0000-000000000001', 'dono@plataforma.test', '{"admin_master": true}'),
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test', '{}'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test', '{}'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test', '{}'),
  ('a0000000-0000-0000-0000-000000000004', 'joao@a.test', '{}'),
  ('a0000000-0000-0000-0000-000000000005', 'rui@a.test', '{}'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test', '{}');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo, opcoes, obrigatorio, ordem) values
  ('1a000000-0000-0000-0000-000000000000', 'celula', 'Célula', 'lista', array['Norte', 'Sul'], false, 1);

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status, cadastro_concluido_em, campos_extras, avisos_desligados) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo', now(), '{}', '{}'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo', now(), '{}', '{}'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo', now(), '{"celula": "Norte"}', '{}'),
  ('2a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'João', 'joao@a.test', '4', 'membro', 'ativo', now(), '{"celula": "Sul"}', '{mensagem_da_igreja}'),
  ('2a000000-0000-0000-0000-000000000005', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'Rui', 'rui@a.test', '5', 'membro', 'inativo', now(), '{"celula": "Norte"}', '{}'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '6', 'tesoureiro', 'ativo', now(), '{}', '{}'),
  ('2b000000-0000-0000-0000-000000000003', '1b000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '7', 'membro', 'ativo', now(), '{}', '{}');

-- Avisos do cenário (ex.: campanha permanente) ficam de fora da contagem.
delete from public.notificacoes;


-- -----------------------------------------------------------------------------
-- Quem envia
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok(
  $$ select public.enviar_mensagem_da_igreja('1a000000-0000-0000-0000-000000000000', 'Mensagem de teste') $$,
  '42501', 'sem_permissao', 'Membro não envia mensagens'
);
select throws_ok(
  $$ select public.previa_da_mensagem('1a000000-0000-0000-0000-000000000000') $$,
  '42501', 'sem_permissao', 'Membro não vê a prévia'
);
select throws_ok(
  $$ select public.admin_enviar_aviso_da_plataforma('Manutenção amanhã') $$,
  '42501', 'so_admin_master', 'Só o Admin Master envia avisos da plataforma'
);
reset role;


-- -----------------------------------------------------------------------------
-- Prévia e envio (Pastora Ana)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is(
  (public.previa_da_mensagem('1a000000-0000-0000-0000-000000000000') ->> 'destinatarios')::int,
  2,
  'Todos: os membros ativos, menos quem desligou, o inativo e quem envia'
);
select is(
  (public.previa_da_mensagem('1a000000-0000-0000-0000-000000000000', 'celula', 'Norte') ->> 'destinatarios')::int,
  1,
  'Grupo: só quem está na Célula Norte'
);
select throws_ok(
  $$ select public.enviar_mensagem_da_igreja('1a000000-0000-0000-0000-000000000000', 'Oi') $$,
  '22023', 'texto_invalido', 'Texto curto demais é recusado'
);
select throws_ok(
  $$ select public.enviar_mensagem_da_igreja('1a000000-0000-0000-0000-000000000000', 'Mensagem de teste', 'dizimo_em_dia', 'sim') $$,
  '22023', 'grupo_invalido', 'Só campos do cadastro servem de grupo'
);
select is(
  (public.enviar_mensagem_da_igreja(
    '1a000000-0000-0000-0000-000000000000', 'Trazei todos os dízimos à casa do tesouro. Malaquias 3:10', 'celula', 'Norte'
  ) ->> 'destinatarios')::int,
  1,
  'A mensagem vai para o grupo escolhido'
);
select ok(
  (public.previa_da_mensagem('1a000000-0000-0000-0000-000000000000') ->> 'proxima_em') is not null,
  'Depois de enviar, a prévia diz quando a próxima pode sair'
);
reset role;

select is(pg_temp.recebeu('maria@a.test', 'mensagem_da_igreja'), 1::bigint, 'Maria, da Célula Norte, recebe');
select is(pg_temp.recebeu('joao@a.test', 'mensagem_da_igreja'), 0::bigint, 'João, de outra célula, não recebe');
select is(pg_temp.recebeu('rui@a.test', 'mensagem_da_igreja'), 0::bigint, 'Inativo não recebe');
select is(
  (select dados ->> 'texto' from public.notificacoes where tipo = 'mensagem_da_igreja' limit 1),
  'Trazei todos os dízimos à casa do tesouro. Malaquias 3:10',
  'O aviso leva o texto da mensagem'
);
select is(
  (select perfil from public.auditoria where tabela = 'mensagens' and acao = 'insert'),
  'administrador',
  'O envio fica no log da igreja, com quem enviou'
);


-- -----------------------------------------------------------------------------
-- Limite de 1 por semana, e quem vê o histórico
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ select public.enviar_mensagem_da_igreja('1a000000-0000-0000-0000-000000000000', 'Outra mensagem na mesma semana') $$,
  '22023', 'limite_semanal', 'Segunda mensagem na mesma semana é recusada, mesmo por outra pessoa'
);
select is((select count(*) from public.mensagens), 1::bigint, 'Tesoureiro vê as mensagens da igreja');
reset role;

update public.mensagens set criado_em = now() - interval '8 days';
select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select is(
  (public.enviar_mensagem_da_igreja('1a000000-0000-0000-0000-000000000000', 'Semeai com fartura. 2 Coríntios 9:6') ->> 'destinatarios')::int,
  2,
  'Passada a semana, pode enviar de novo (para todos: Ana e Maria; quem envia não recebe)'
);
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*) from public.mensagens), 0::bigint, 'Membro não vê o histórico de mensagens');
reset role;
select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is((select count(*) from public.mensagens), 0::bigint, 'Tesoureiro de outra igreja não vê as mensagens');
reset role;


-- -----------------------------------------------------------------------------
-- Avisos da plataforma
-- -----------------------------------------------------------------------------

delete from public.notificacoes;
select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.admin_enviar_aviso_da_plataforma('Amanhã, das 23h à 0h, o app ficará em manutenção.');
reset role;
-- Só as pessoas deste cenário (o banco de desenvolvimento tem outras).
select is(
  (select count(*) from public.notificacoes where tipo = 'aviso_da_plataforma'
     and usuario_id::text like any (array['a0000000-%', 'b0000000-%'])),
  5::bigint,
  'Para todas as igrejas: cada pessoa ativa recebe (o inativo, não)'
);
select is(pg_temp.recebeu('maria@a.test', 'aviso_da_plataforma'), 1::bigint, 'Quem está em duas igrejas recebe uma vez só');
select is(pg_temp.recebeu('joao@a.test', 'aviso_da_plataforma'), 1::bigint, 'O aviso da plataforma não respeita o desligar: é aviso de serviço');

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (public.admin_enviar_aviso_da_plataforma('Aviso só para a Igreja B.', '1b000000-0000-0000-0000-000000000000') ->> 'destinatarios')::int,
  2,
  'Para uma igreja só: os membros ativos dela'
);
reset role;

select * from finish();
rollback;
