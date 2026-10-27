-- Testes do Admin Master (A-01, A-02 e suporte): o que ele vê, o que faz,
-- o que fica no log, um só Pastor por igreja e igreja inativa.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Dono: Admin Master
--   Igreja A: Ana (Pastora), Tiago (tesoureiro), Maria (membro, também na B)
--   Igreja B: Bruno (Pastor), Maria

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

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

insert into auth.users (id, email, raw_app_meta_data) values
  ('f0000000-0000-0000-0000-000000000001', 'dono@plataforma.test', '{"admin_master": true}'),
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test', '{}'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test', '{}'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test', '{}'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test', '{}');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status, cadastro_concluido_em) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo', now()),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo', now()),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo', now()),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '4', 'administrador', 'ativo', now()),
  ('2b000000-0000-0000-0000-000000000003', '1b000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '5', 'membro', 'ativo', now());

insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'dizimo', 10000, 'BRL', current_date, 'pix');


-- -----------------------------------------------------------------------------
-- Só o Admin Master usa as funções da plataforma
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ select * from public.admin_listar_igrejas() $$, '42501', 'so_admin_master', 'Pastor não lista as igrejas da plataforma');
select throws_ok(
  $$ select public.admin_cadastrar_igreja('Igreja C', 'BR', 'pt-BR', 'BRL', null, null, 'Carlos', 'carlos@c.test', '11999990000') $$,
  '42501', 'so_admin_master', 'Pastor não cadastra igrejas'
);
select throws_ok($$ select * from public.admin_buscar_pessoa('maria@a.test', 'curiosidade') $$, '42501', 'so_admin_master', 'Pastor não usa a busca do suporte');
select throws_ok($$ select * from public.admin_logs_globais() $$, '42501', 'so_admin_master', 'Pastor não vê os logs globais');
reset role;


-- -----------------------------------------------------------------------------
-- O Admin Master não lê os dados dos membros direto
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is((select count(*) from public.membros), 0::bigint, 'Admin Master não lê as fichas direto');
select is((select count(*) from public.lancamentos), 0::bigint, 'Admin Master não lê os lançamentos');
select is((select count(*) from public.auditoria), 0::bigint, 'Admin Master não lê o log das igrejas direto');
select is((select count(*) from public.igrejas where id in ('1a000000-0000-0000-0000-000000000000', '1b000000-0000-0000-0000-000000000000')), 2::bigint, 'Admin Master vê as igrejas');


-- -----------------------------------------------------------------------------
-- A-01: lista e cadastro
-- -----------------------------------------------------------------------------

select is(
  (select pastor_nome || ' / ' || membros_ativos from public.admin_listar_igrejas() where id = '1a000000-0000-0000-0000-000000000000'),
  'Ana / 3',
  'A lista mostra o Pastor e quantos membros ativos'
);

create temporary table nova as
  select public.admin_cadastrar_igreja('  Igreja C  ', '', '', '', 'Até 150', null, 'Carlos', ' Carlos@C.test ', '11999990000') as id;
grant select on nova to authenticated;
reset role;

select is(
  (select nome || ' / ' || pais || ' / ' || idioma || ' / ' || moeda || ' / ' || titulo_administrador || ' / ' || faixa_plano
     from public.igrejas where id = (select id from nova)),
  'Igreja C / BR / pt-BR / BRL / Pastor de Governo / Até 150',
  'Igreja nova com Brasil, português e real quando não informados'
);
select is(
  (select perfil || ' / ' || status || ' / ' || email from public.membros where igreja_id = (select id from nova)),
  'administrador / convidado / carlos@c.test',
  'O Pastor nasce convidado'
);
select is(
  (select count(*) from public.convites where igreja_id = (select id from nova)),
  1::bigint,
  'O convite do Pastor é criado (e o e-mail sai sozinho)'
);
select is(
  (select count(*) from public.campanhas where igreja_id = (select id from nova) and permanente),
  1::bigint,
  'A igreja nova já tem a campanha permanente Oferta'
);
select is(
  (select perfil from public.auditoria where tabela = 'igrejas' and registro_id = (select id from nova) and acao = 'insert'),
  'admin_master',
  'O cadastro fica no log como ação do Admin Master'
);


-- -----------------------------------------------------------------------------
-- Busca do suporte e troca de Pastor
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.admin_buscar_pessoa('maria@a.test', 'ok') $$,
  '22023', 'motivo_obrigatorio', 'A busca exige motivo'
);
select is(
  (select count(*) from public.admin_buscar_pessoa(' Maria@A.test ', 'Pediu ajuda para entrar')),
  2::bigint,
  'Acha a pessoa em todas as igrejas'
);
reset role;
select is(
  (select count(*) from public.auditoria
    where acao = 'acesso_suporte' and motivo = 'Pediu ajuda para entrar'
      and igreja_id in ('1a000000-0000-0000-0000-000000000000', '1b000000-0000-0000-0000-000000000000')),
  2::bigint,
  'Cada ficha encontrada fica no log da igreja dela, com o motivo'
);

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.admin_definir_pastor('2a000000-0000-0000-0000-000000000002', 'Ana se mudou de cidade');
reset role;
select is(
  (select string_agg(nome || ':' || perfil, ', ' order by nome) from public.membros
    where igreja_id = '1a000000-0000-0000-0000-000000000000' and nome in ('Ana', 'Tiago')),
  'Ana:membro, Tiago:administrador',
  'Novo Pastor: o anterior volta a ser membro'
);
select is(
  (select motivo from public.auditoria
    where tabela = 'membros' and registro_id = '2a000000-0000-0000-0000-000000000002' and acao = 'update'
    order by criado_em desc limit 1),
  'Ana se mudou de cidade',
  'A troca de Pastor fica no log com o motivo'
);
select throws_ok(
  $$ update public.membros set perfil = 'administrador' where id = '2a000000-0000-0000-0000-000000000003' $$,
  '23505', null,
  'O banco não deixa haver dois Pastores na mesma igreja'
);

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.admin_convidar_pastor((select id from nova), 'Clara', 'clara@c.test', '11988880000', 'Carlos não vai assumir');
reset role;
select is(
  (select string_agg(nome || ':' || perfil || ':' || status, ', ' order by nome) from public.membros
    where igreja_id = (select id from nova)),
  'Carlos:administrador:inativo, Clara:administrador:convidado',
  'Convidar outro Pastor cancela o convite do anterior'
);


-- -----------------------------------------------------------------------------
-- Convite do Pastor que ainda não entrou
-- -----------------------------------------------------------------------------

-- O Admin Master não lê as fichas: o id vem de antes de entrar como ele.
create temporary table clara as select id from public.membros where email = 'clara@c.test';
grant select on clara to authenticated, service_role;
select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.admin_reenviar_convite((select id from clara));
select throws_ok(
  $$ select public.admin_reenviar_convite('2a000000-0000-0000-0000-000000000001') $$,
  'P0002', 'convite_indisponivel', 'Quem já entrou não tem convite para reenviar'
);
reset role;
select is(
  (select count(*) from public.convites c join public.membros m on m.id = c.membro_id where m.email = 'clara@c.test'),
  2::bigint,
  'O suporte reenvia o convite do Pastor que ainda não entrou'
);

set local role service_role;
select public.trocar_email_do_membro(
  'f0000000-0000-0000-0000-000000000001', (select id from clara),
  'clara.certa@c.test', 'Digitou o e-mail errado'
);
reset role;
select is(
  (select count(*) from public.convites c join public.membros m on m.id = c.membro_id where m.email = 'clara.certa@c.test'),
  3::bigint,
  'Trocar o e-mail de quem ainda é convidado manda um convite novo para o e-mail certo'
);


-- -----------------------------------------------------------------------------
-- Troca de e-mail pelo suporte (D-097)
-- -----------------------------------------------------------------------------

set local role service_role;
select public.trocar_email_do_membro(
  'f0000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', 'bruno.novo@b.test', 'Perdeu o e-mail antigo'
);
select public.trocar_email_do_membro(
  'f0000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000003', 'maria.nova@a.test', 'Perdeu o e-mail antigo'
);
reset role;
select is(
  (select email from public.membros where id = '2b000000-0000-0000-0000-000000000001'),
  'bruno.novo@b.test',
  'O suporte troca o e-mail do Pastor'
);
select is(
  (select count(*) from public.membros where usuario_id = 'a0000000-0000-0000-0000-000000000003' and email = 'maria.nova@a.test'),
  2::bigint,
  'Quem está em duas igrejas: o suporte troca, e as duas fichas mudam juntas'
);
select is(
  (select count(*) from public.auditoria
    where tabela = 'membros' and acao = 'update' and perfil = 'admin_master' and motivo = 'Perdeu o e-mail antigo'
      and registro_id in ('2a000000-0000-0000-0000-000000000003', '2b000000-0000-0000-0000-000000000003')),
  2::bigint,
  'Cada ficha trocada fica no log da sua igreja'
);


-- -----------------------------------------------------------------------------
-- A-02
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select ok(
  (select count(*) from public.admin_logs_globais(1, 100) where acao = 'acesso_suporte') >= 2,
  'Os logs globais mostram as buscas do suporte'
);
select ok(
  (select bool_and(igreja_nome is not null) from public.admin_logs_globais(1, 100) where igreja_id is not null),
  'Cada linha diz de que igreja é'
);
-- No teste tudo acontece no mesmo instante (uma transação só): vale a ordem de gravação.
select is(
  (select id from public.admin_logs_globais(1, 100) limit 1),
  (select max(id) from public.admin_logs_globais(1, 100)),
  'Ações do mesmo instante: a gravada por último aparece primeiro'
);
reset role;


-- -----------------------------------------------------------------------------
-- Igreja inativa: ninguém entra, nada se apaga
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.admin_atualizar_igreja(
  '1a000000-0000-0000-0000-000000000000', 'Igreja A', 'inativa', null, 'BR', 'pt-BR', 'BRL', 'Pastor de Governo'
);
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select is(
  (select count(*) from public.lancamentos where igreja_id = '1a000000-0000-0000-0000-000000000000'),
  0::bigint,
  'Membro de igreja inativa não vê o próprio Cartão'
);
select is(
  (select array_agg(n) from public.igrejas_inativas_onde_estou() as n),
  array['Igreja A'],
  'O app sabe dizer qual igreja está inativa'
);
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select is(public.eh_tesouraria('1a000000-0000-0000-0000-000000000000'), false, 'A tesouraria de igreja inativa perde o acesso');
reset role;

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.admin_atualizar_igreja(
  '1a000000-0000-0000-0000-000000000000', 'Igreja A', 'ativa', null, 'BR', 'pt-BR', 'BRL', 'Pastor de Governo'
);
reset role;
select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select is(
  (select count(*) from public.lancamentos where igreja_id = '1a000000-0000-0000-0000-000000000000'),
  1::bigint,
  'Reativada, tudo volta como estava'
);
reset role;

select * from finish();
rollback;
