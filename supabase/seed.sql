-- Dados de exemplo SÓ para o Supabase local. Carregados a cada
-- "npx supabase db reset"; não vão para a nuvem no "db push".
-- Os e-mails @teste.local não existem: os códigos chegam no Mailpit
-- (http://127.0.0.1:54324). Os convites valem 7 dias a partir do reset.

insert into public.igrejas (id, nome, denominacao) values
  ('00000000-0000-4000-8000-000000000001', 'Igreja Videira (teste)', 'Videira');

insert into public.contas (igreja_id, nome, principal, banco, chave_pix, tipo_chave_pix, nome_recebedor, cidade) values
  ('00000000-0000-4000-8000-000000000001', 'Dízimos e ofertas', true, 'Banco de Teste',
   'tesouraria@teste.local', 'email', 'IGREJA VIDEIRA TESTE', 'GOIANIA');

-- Campos que a Videira usa no cadastro (Requisitos v0.3, seção 3).
insert into public.campos_cadastro (igreja_id, chave, rotulo, tipo, obrigatorio, ordem) values
  ('00000000-0000-4000-8000-000000000001', 'lider', 'Líder', 'texto', false, 1),
  ('00000000-0000-4000-8000-000000000001', 'discipulador', 'Discipulador', 'texto', false, 2),
  ('00000000-0000-4000-8000-000000000001', 'pastor_de_rede', 'Pastor de Rede', 'texto', false, 3);

insert into public.membros (igreja_id, nome, email, celular, perfil) values
  ('00000000-0000-4000-8000-000000000001', 'Pastor Teste', 'pastor@teste.local', '62900000001', 'administrador'),
  ('00000000-0000-4000-8000-000000000001', 'Tesoureiro Teste', 'tesoureiro@teste.local', '62900000002', 'tesoureiro'),
  ('00000000-0000-4000-8000-000000000001', 'Maria Teste', 'maria@teste.local', '62900000003', 'membro');

insert into public.convites (igreja_id, membro_id)
select igreja_id, id from public.membros where igreja_id = '00000000-0000-4000-8000-000000000001';
