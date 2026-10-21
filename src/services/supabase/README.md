# services/supabase/ — acesso ao backend

Cliente do Supabase (só com a chave pública `anon`, lida do `.env`; a `service_role`
nunca entra no app), login por OTP e funções de leitura e gravação por tabela
(igrejas, membros, lançamentos, comprovantes com signed URLs etc.).
