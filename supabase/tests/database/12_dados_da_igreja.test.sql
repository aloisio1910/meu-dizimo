-- Testes dos dados da igreja (P-03, D-092).
-- Rodar com: npx supabase test db
--
-- Cenário
--   Igreja A: Ana (administradora), Tiago (tesoureiro)
--   Igreja B: Bruno (administrador)
--   Dono da plataforma (Admin Master)

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

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

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'tiago@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'bruno@b.test'),
  ('f0000000-0000-0000-0000-000000000001', 'dono@plataforma.test');

insert into public.igrejas (id, nome) values
  ('1a000000-0000-0000-0000-000000000000', 'Igreja A'),
  ('1b000000-0000-0000-0000-000000000000', 'Igreja B');

insert into public.membros (igreja_id, usuario_id, nome, email, celular, perfil, status) values
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'Ana', 'ana@a.test', '1', 'administrador', 'ativo'),
  ('1a000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'Tiago', 'tiago@a.test', '2', 'tesoureiro', 'ativo'),
  ('1b000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'Bruno', 'bruno@b.test', '3', 'administrador', 'ativo');


select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;

select lives_ok(
  $$ update public.igrejas
        set endereco = 'Rua 1, Centro', horarios_culto = 'Domingo 19h', whatsapp_contato = '62999990000',
            redes_sociais = '{"instagram": "https://instagram.com/igreja"}',
            mensagem_confirmacao = 'Deus abençoe a sua fidelidade!',
            formas_devolucao = array['pix', 'dinheiro']
      where id = '1a000000-0000-0000-0000-000000000000' $$,
  'Pastor de Governo atualiza dados, contato, mensagem e formas aceitas'
);
select throws_ok(
  $$ update public.igrejas set moeda = 'USD' where id = '1a000000-0000-0000-0000-000000000000' $$,
  '42501', 'so_admin_master_altera_pais',
  'Pastor de Governo não troca a moeda (D-092)'
);
select throws_ok(
  $$ update public.igrejas set pais = 'PT', idioma = 'pt-PT' where id = '1a000000-0000-0000-0000-000000000000' $$,
  '42501', 'so_admin_master_altera_pais',
  'Pastor de Governo não troca país nem idioma'
);
select throws_ok(
  $$ update public.igrejas set formas_devolucao = '{}' where id = '1a000000-0000-0000-0000-000000000000' $$,
  '23514', null,
  'A igreja precisa aceitar ao menos uma forma de devolução'
);

reset role;
select ok(
  exists (select 1 from public.auditoria where tabela = 'igrejas' and depois->>'endereco' = 'Rua 1, Centro'),
  'A mudança dos dados da igreja fica no log'
);

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
update public.igrejas set endereco = 'Outro lugar' where id = '1a000000-0000-0000-0000-000000000000';
reset role;
select is(
  (select endereco from public.igrejas where id = '1a000000-0000-0000-0000-000000000000'),
  'Rua 1, Centro',
  'Tesoureiro não altera os dados da igreja'
);

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
update public.igrejas set endereco = 'Invasão' where id = '1a000000-0000-0000-0000-000000000000';
reset role;
select is(
  (select endereco from public.igrejas where id = '1a000000-0000-0000-0000-000000000000'),
  'Rua 1, Centro',
  'Administrador de outra igreja não altera a Igreja A'
);

-- Logo e capa no bucket privado "igrejas" (seção 17).
select pg_temp.entrar('a0000000-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('igrejas', '1a000000-0000-0000-0000-000000000000/logo-1.png', 'a0000000-0000-0000-0000-000000000001') $$,
  'Pastor de Governo envia o logo da igreja'
);
select lives_ok(
  $$ update public.igrejas set logo_path = '1a000000-0000-0000-0000-000000000000/logo-1.png', cor_principal = '#5B2C83'
      where id = '1a000000-0000-0000-0000-000000000000' $$,
  'Pastor de Governo aponta o logo e escolhe a cor'
);
reset role;

select pg_temp.entrar('a0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('igrejas', '1a000000-0000-0000-0000-000000000000/logo-2.png', 'a0000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'Tesoureiro não envia imagens da igreja'
);
select is((select count(*) from storage.objects where bucket_id = 'igrejas'), 1::bigint,
  'Quem é da igreja vê o logo');
reset role;

select pg_temp.entrar('b0000000-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('igrejas', '1a000000-0000-0000-0000-000000000000/logo-3.png', 'b0000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'Administrador de outra igreja não envia imagem na pasta da Igreja A'
);
select is((select count(*) from storage.objects where bucket_id = 'igrejas'), 0::bigint,
  'Outra igreja não vê o logo da Igreja A');
reset role;

select pg_temp.entrar('f0000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$ update public.igrejas set moeda = 'EUR', pais = 'PT', idioma = 'pt-PT' where id = '1b000000-0000-0000-0000-000000000000' $$,
  'Admin Master troca país, idioma e moeda'
);
reset role;
select is(
  (select moeda::text from public.igrejas where id = '1b000000-0000-0000-0000-000000000000'),
  'EUR',
  'A moeda nova ficou gravada'
);

select * from finish();
rollback;
