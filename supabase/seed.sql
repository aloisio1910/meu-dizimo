-- Dados de exemplo SÓ para o Supabase local. Carregados a cada
-- "npx supabase db reset"; não vão para a nuvem no "db push".
-- Os e-mails @teste.local não existem: os códigos chegam no Mailpit
-- (http://127.0.0.1:54324). Os convites valem 7 dias a partir do reset.

-- Endereço, horários e WhatsApp são fictícios.
insert into public.igrejas (id, nome, denominacao, endereco, horarios_culto, site, whatsapp_contato) values
  ('00000000-0000-4000-8000-000000000001', 'Igreja Videira (teste)', 'Videira',
   'Rua de Teste, 100, Setor Exemplo, Goiânia (GO)',
   'Domingo às 9h e às 18h; quarta-feira às 20h',
   'https://example.com', '62900000000');

insert into public.contas (igreja_id, nome, finalidade, principal, banco, agencia, numero_conta,
                           chave_pix, tipo_chave_pix, nome_recebedor, cidade) values
  ('00000000-0000-4000-8000-000000000001', 'Dízimos e ofertas', 'Dízimos e ofertas dos cultos', true,
   'Banco de Teste', '0001', '12345-6', 'tesouraria@teste.local', 'email', 'IGREJA VIDEIRA TESTE', 'GOIANIA'),
  ('00000000-0000-4000-8000-000000000001', 'Construção do templo', 'Obra do novo templo', false,
   'Banco de Teste', '0001', '65432-1', 'construcao@teste.local', 'email', 'IGREJA VIDEIRA OBRAS', 'GOIANIA');

-- Campanha de exemplo, além da permanente "Oferta" criada com a igreja.
-- O vídeo é o curta livre "Big Buck Bunny" (Blender Foundation).
insert into public.campanhas (igreja_id, nome, descricao, objetivo, inicio, status, link_video, conta_id)
select '00000000-0000-4000-8000-000000000001', 'Construção do templo',
       'Estamos construindo o novo templo para receber mais famílias. Cada oferta ajuda a levantar as paredes da nossa nova casa.',
       'Concluir a estrutura do novo templo', current_date, 'ativa',
       'https://www.youtube.com/watch?v=aqz-KE-bpKQ', c.id
from public.contas c
where c.igreja_id = '00000000-0000-4000-8000-000000000001' and c.nome = 'Construção do templo';

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

-- Envio do push (D-096): onde o banco encontra a Edge Function no Supabase
-- local (rede interna do Docker). O segredo daqui é só de desenvolvimento e
-- precisa ser igual ao de supabase/functions/.env (modelo em .env.example).
-- Na nuvem os dois são outros, gravados à parte no Vault e nos segredos.
select vault.create_secret('http://supabase_kong_meu-dizimo:8000/functions/v1/enviar-push', 'url_do_envio_de_push');
select vault.create_secret('segredo-local-do-envio-de-push', 'segredo_do_envio_de_push');
