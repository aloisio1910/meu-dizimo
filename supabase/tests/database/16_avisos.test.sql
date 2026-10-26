-- Testes dos avisos (D-096): quem recebe cada aviso, quem pode desligar e
-- quem lê.
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro), Maria (membro),
--             Rui (membro inativo); conta principal com Pix
--   Igreja B: Bruno (membro)

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

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

-- Avisos de um tipo que a pessoa (pelo e-mail) recebeu, contados como dono do banco.
create function pg_temp.avisos(p_email text, p_tipo text)
returns bigint
language sql
as $$
  select count(*) from public.notificacoes n
  join auth.users u on u.id = n.usuario_id
  where u.email = p_email and n.tipo = p_tipo;
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'rui@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (id, igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo'),
  ('2a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000003', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo'),
  ('2a000000-0000-0000-0000-000000000004', '1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'Rui', 'rui@a.test', '4', 'membro', 'inativo'),
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '5', 'membro', 'ativo');

insert into public.contas (id, igreja_id, nome, principal, chave_pix, tipo_chave_pix, nome_recebedor, cidade) values
  ('3a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'Dízimos', true, 'igreja@a.test', 'email', 'IGREJA A', 'GOIANIA');

insert into public.campanhas (id, igreja_id, nome, status) values
  ('4a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000', 'Missões', 'rascunho');

-- Criar a conta com Pix já avisou a tesouraria (como deve): começa do zero.
delete from public.notificacoes;


-- -----------------------------------------------------------------------------
-- Maria registra um dízimo: a tesouraria é avisada
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
values ('5a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000000',
        '2a000000-0000-0000-0000-000000000003', 'dizimo', 15000, 'BRL', current_date, 'pix');
reset role;

select is(pg_temp.avisos('tiago@a.test', 'novo_lancamento'), 1::bigint, 'Tesoureiro é avisado do novo lançamento');
select is(pg_temp.avisos('ana@a.test', 'novo_lancamento'), 1::bigint, 'Pastor também é avisado');
select is(pg_temp.avisos('maria@a.test', 'novo_lancamento'), 0::bigint, 'Quem registrou não é avisado do próprio lançamento');
select is(
  (select dados ->> 'membro_nome' from public.notificacoes where tipo = 'novo_lancamento' limit 1),
  'Maria',
  'O aviso traz o nome do membro e os dados do lançamento'
);


-- -----------------------------------------------------------------------------
-- Tiago confere: confirma um, registra divergência em outro
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select public.abrir_conferencia('5a000000-0000-0000-0000-000000000001');
select public.confirmar_lancamento('5a000000-0000-0000-0000-000000000001');
reset role;

select is(pg_temp.avisos('maria@a.test', 'lancamento_confirmado'), 1::bigint, 'Maria é avisada da confirmação');
select is(
  (select dados ->> 'confirmado_por' from public.notificacoes where tipo = 'lancamento_confirmado' limit 1),
  'Tiago',
  'O aviso diz quem confirmou'
);

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
insert into public.lancamentos (id, igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
values ('5a000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000000',
        '2a000000-0000-0000-0000-000000000003', 'dizimo', 20000, 'BRL', current_date, 'pix');
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select public.abrir_conferencia('5a000000-0000-0000-0000-000000000002');
select public.registrar_divergencia('5a000000-0000-0000-0000-000000000002', 18000, 'Extrato mostra R$ 180');
reset role;

select is(pg_temp.avisos('maria@a.test', 'divergencia_registrada'), 1::bigint, 'Maria é avisada da divergência');

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select public.responder_divergencia('5a000000-0000-0000-0000-000000000002', false, 'Paguei 200, tenho o comprovante');
reset role;

select is(pg_temp.avisos('tiago@a.test', 'divergencia_contestada'), 1::bigint, 'A tesouraria é avisada da contestação');


-- -----------------------------------------------------------------------------
-- Devolução presencial, comprovante, campanha e Pix
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
insert into public.lancamentos (igreja_id, membro_id, tipo, valor_informado_centavos, moeda, data_contribuicao, forma)
values ('1a000000-0000-0000-0000-000000000000', '2a000000-0000-0000-0000-000000000003', 'dizimo', 5000, 'BRL', current_date, 'dinheiro');
reset role;
select is(pg_temp.avisos('maria@a.test', 'lancamento_confirmado'), 2::bigint, 'Devolução presencial avisa a Maria, já confirmada');

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
-- Maria desliga o aviso de nova campanha.
select lives_ok(
  $$ update public.membros set avisos_desligados = '{nova_campanha}' where id = '2a000000-0000-0000-0000-000000000003' $$,
  'Maria desliga o aviso de nova campanha'
);
insert into public.comprovantes (igreja_id, lancamento_id, arquivo_path, formato)
values ('1a000000-0000-0000-0000-000000000000', '5a000000-0000-0000-0000-000000000002',
        '1a000000-0000-0000-0000-000000000000/5a000000-0000-0000-0000-000000000002/c.pdf', 'pdf');
reset role;
select is(pg_temp.avisos('tiago@a.test', 'novo_comprovante'), 1::bigint, 'A tesouraria é avisada do comprovante');

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;
update public.campanhas set status = 'ativa' where id = '4a000000-0000-0000-0000-000000000001';
update public.contas set chave_pix = 'nova@a.test' where id = '3a000000-0000-0000-0000-000000000001';
reset role;

select is(pg_temp.avisos('tiago@a.test', 'nova_campanha'), 1::bigint, 'Campanha publicada avisa os membros');
select is(pg_temp.avisos('maria@a.test', 'nova_campanha'), 0::bigint, 'Quem desligou não recebe o aviso de nova campanha');
select is(pg_temp.avisos('rui@a.test', 'nova_campanha'), 0::bigint, 'Membro inativo não recebe avisos');
select is(pg_temp.avisos('bruno@b.test', 'nova_campanha'), 0::bigint, 'Outra igreja não recebe avisos da Igreja A');
select is(pg_temp.avisos('tiago@a.test', 'pix_alterado'), 1::bigint, 'Troca da chave Pix avisa o tesoureiro (RN-040)');
select is(pg_temp.avisos('ana@a.test', 'pix_alterado'), 0::bigint, 'Quem trocou a chave não é avisado de si mesmo');


-- -----------------------------------------------------------------------------
-- Quem lê, quem marca como lido, quem muda as preferências
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;
select is(
  (select count(*) from public.notificacoes where usuario_id <> 'a0000000-0000-0000-0000-000000000003'),
  0::bigint,
  'Maria vê só os próprios avisos'
);
select throws_ok(
  $$ insert into public.notificacoes (igreja_id, usuario_id, tipo) values
     ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'pix_alterado') $$,
  '42501', null,
  'Ninguém do app cria avisos'
);
select public.marcar_avisos_como_lidos();
select is(
  (select count(*) from public.notificacoes where lida_em is null),
  0::bigint,
  'Maria marca os próprios avisos como lidos'
);
reset role;
select ok(
  (select count(*) from public.notificacoes n join auth.users u on u.id = n.usuario_id
    where u.email = 'tiago@a.test' and n.lida_em is null) > 0,
  'Os avisos do Tiago continuam não lidos'
);

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ update public.membros set avisos_desligados = '{}' where id = '2a000000-0000-0000-0000-000000000003' $$,
  '42501', 'so_a_pessoa_muda_os_avisos',
  'Tesoureiro não muda as preferências de aviso da Maria'
);
select throws_ok(
  $$ update public.membros set avisos_desligados = '{pix_alterado}' where id = '2a000000-0000-0000-0000-000000000002' $$,
  '23514', null,
  'Aviso obrigatório (troca de Pix) não pode ser desligado'
);
reset role;

select * from finish();
rollback;
