-- Testes dos campos preenchidos pela tesouraria (D-093).
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro), Maria (membro ativo)
--             Campos: lider (membro, obrigatório), celula (tesouraria, lista
--             Norte/Sul), batismo (membro, data)
--   Igreja B: Bruno (administrador)

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

create function pg_temp.da_maria(p_coluna text)
returns jsonb
language sql
as $$
  select case when p_coluna = 'internos' then campos_internos else campos_extras end
  from public.membros where email = 'maria@a.test';
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'maria@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo, opcoes, obrigatorio, preenchido_por, ordem) values
  ('1a000000-0000-0000-0000-000000000000', 'lider', 'Líder', 'texto', '{}', true, 'membro', 1),
  ('1a000000-0000-0000-0000-000000000000', 'celula', 'Célula', 'lista', '{Norte,Sul}', false, 'tesouraria', 2),
  ('1a000000-0000-0000-0000-000000000000', 'batismo', 'Batismo', 'data', '{}', false, 'membro', 3);

insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status, campos_extras) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo', '{"lider": "Carlos"}'),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo', '{"lider": "Carlos"}'),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'Maria', 'maria@a.test', '3', 'membro', 'ativo', '{"lider": "Carlos", "batismo": "2010-05-17"}'),
  ('1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '4', 'administrador', 'ativo', '{}');

select throws_ok(
  $$ insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo, obrigatorio, preenchido_por)
     values ('1a000000-0000-0000-0000-000000000000', 'setor', 'Setor', 'texto', true, 'tesouraria') $$,
  '23514', null,
  'Campo da tesouraria não é obrigatório para o membro'
);


-- -----------------------------------------------------------------------------
-- Tiago (tesoureiro) preenche
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;

select lives_ok(
  $$ update public.membros set campos_internos = '{"celula": "Norte"}' where email = 'maria@a.test' $$,
  'Tesoureiro preenche o campo da tesouraria na ficha da Maria'
);
select throws_ok(
  $$ update public.membros set campos_internos = '{"celula": "Leste"}' where email = 'maria@a.test' $$,
  '22023', 'campo_invalido',
  'Valor fora da lista também vale para o campo da tesouraria'
);
select throws_ok(
  $$ update public.membros set campos_internos = '{"lider": "Outro"}' where email = 'maria@a.test' $$,
  '22023', 'campo_desconhecido',
  'Tesouraria não grava, pelas anotações, um campo que é do membro'
);
select throws_ok(
  $$ update public.membros set campos_extras = '{"lider": "Outro"}' where email = 'maria@a.test' $$,
  '42501', null,
  'Tesoureiro continua sem editar o que o membro informa'
);

reset role;
select is(pg_temp.da_maria('internos'), '{"celula": "Norte"}'::jsonb, 'A anotação da tesouraria ficou gravada');


-- -----------------------------------------------------------------------------
-- Maria (membro) lê, mas não altera
-- -----------------------------------------------------------------------------

select pg_temp.entrar('a0000000-0000-0000-0000-000000000003');
set local role authenticated;

select is(
  (select campos_internos from public.membros where usuario_id = 'a0000000-0000-0000-0000-000000000003'),
  '{"celula": "Norte"}'::jsonb,
  'Maria vê o que a tesouraria anotou na ficha dela (LGPD)'
);
select throws_ok(
  $$ update public.membros set campos_internos = '{"celula": "Sul"}' where usuario_id = 'a0000000-0000-0000-0000-000000000003' $$,
  '42501', 'so_a_tesouraria_preenche',
  'Maria não altera o campo da tesouraria'
);
select lives_ok(
  $$ update public.membros set campos_extras = '{"lider": "Carlos", "batismo": "2011-06-01"}'
      where usuario_id = 'a0000000-0000-0000-0000-000000000003' $$,
  'Maria edita os próprios campos sem ser cobrada pelo da tesouraria'
);
select throws_ok(
  $$ update public.membros set campos_extras = '{"lider": "Carlos", "celula": "Sul"}'
      where usuario_id = 'a0000000-0000-0000-0000-000000000003' $$,
  '22023', 'campo_desconhecido',
  'Maria não grava o campo da tesouraria pelas próprias respostas'
);

reset role;


-- -----------------------------------------------------------------------------
-- Bruno (outra igreja)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
update public.membros set campos_internos = '{"celula": "Sul"}' where email = 'maria@a.test';
reset role;
select is(pg_temp.da_maria('internos'), '{"celula": "Norte"}'::jsonb, 'Outra igreja não anota na ficha da Maria');


-- -----------------------------------------------------------------------------
-- Ana (Pastora) troca quem preenche: as respostas mudam de coluna
-- -----------------------------------------------------------------------------

-- Um obrigatório novo, que ninguém preencheu ainda, não pode travar a troca.
insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo, obrigatorio, preenchido_por, ordem)
values ('1a000000-0000-0000-0000-000000000000', 'rede', 'Rede', 'texto', true, 'membro', 4);

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ update public.campos_cadastro set preenchido_por = 'tesouraria' where chave = 'batismo' and igreja_id = '1a000000-0000-0000-0000-000000000000' $$,
  'Pastor de Governo passa o batismo para a tesouraria'
);
reset role;
select is(pg_temp.da_maria('internos'), '{"celula": "Norte", "batismo": "2011-06-01"}'::jsonb,
  'A resposta da Maria foi para as anotações da tesouraria');
select is(pg_temp.da_maria('extras'), '{"lider": "Carlos"}'::jsonb, 'E saiu das respostas da Maria');

select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ update public.campos_cadastro set preenchido_por = 'membro' where chave = 'celula' and igreja_id = '1a000000-0000-0000-0000-000000000000' $$,
  'Pastor de Governo devolve a célula para o membro preencher'
);
reset role;
select is(pg_temp.da_maria('extras'), '{"lider": "Carlos", "celula": "Norte"}'::jsonb,
  'A anotação voltou para as respostas da Maria, sem se perder');

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
update public.campos_cadastro set preenchido_por = 'tesouraria' where chave = 'lider' and igreja_id = '1a000000-0000-0000-0000-000000000000';
reset role;
select is(
  (select preenchido_por from public.campos_cadastro where chave = 'lider' and igreja_id = '1a000000-0000-0000-0000-000000000000'),
  'membro',
  'Tesoureiro não muda quem preenche um campo'
);

select * from finish();
rollback;
