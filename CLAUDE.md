# Meu Dízimo.app

Plataforma multi-igreja que substitui o envelope físico de dízimo por um Cartão de Dízimo digital, preservando o relacionamento entre membro e igreja: o membro registra, a tesouraria confere, o tesoureiro confirma, o membro recebe o retorno. O app NÃO processa pagamentos no MVP: o membro paga no app do banco (Pix) e registra no Meu Dízimo. Produto pensado para virar SaaS vendido a igrejas de várias denominações. Piloto: Igreja Videira.

## Como trabalhar com o desenvolvedor

- Responda sempre em português do Brasil.
- O desenvolvedor é formado em programação, mas ficou 9 anos sem usar as ferramentas. Tem boa lógica; está desatualizado em ferramentas modernas (Expo, Supabase, Git moderno, TypeScript). Explique cada comando e cada conceito novo de forma curta e clara, na primeira vez que aparecer.
- Trabalhe em etapas pequenas. Ao fim de cada etapa: diga o que foi feito, como ele pode testar e qual é a próxima etapa.
- Peça confirmação antes de qualquer ação difícil de desfazer: apagar arquivos ou dados, migrations destrutivas, push forçado, publicar nas lojas, mexer em produção.
- O computador é Windows (PowerShell). Prefira comandos que funcionem no PowerShell.

## Documentos de referência (o desenvolvedor tem acesso)

- Documento de Requisitos v0.3: regras de negócio RN-001 a RN-041, decisões D-001 a D-066, escopo por fases, preços, LGPD.
- Fluxos, Telas e Modelo de Dados: fluxo principal em 9 passos, fluxos secundários, mapa de 22 telas (M-01 a M-10, T-01 a T-06, P-01 a P-04, A-01 a A-02), 12 tabelas.
- Protótipo clicável: app do membro (celular) e painel da tesouraria (web).
Se algo aqui parecer incompleto, pergunte ao desenvolvedor em vez de inventar regra de negócio.

## Tecnologia

- **App:** Expo (React Native) com TypeScript e Expo Router. Um único código gera Android, iPhone e web. O membro usa o celular; a tesouraria usa de preferência a versão web.
- **Backend:** Supabase: PostgreSQL, Auth, Storage, Edge Functions, Row Level Security (RLS).
- **Login:** sem senha. Código de 6 dígitos por e-mail (OTP do Supabase Auth). Após o primeiro acesso, entrada por digital/rosto (expo-local-authentication) com sessão longa.
- **Notificações:** push com expo-notifications.
- **Idiomas:** i18n desde o início (ex.: i18next + expo-localization). Nenhum texto fixo nas telas: tudo em arquivos de idioma, começando por `pt-BR`.
- **Testes no celular:** Expo Go, com o SDK padrão do `create-expo-app`.
- **Visual:** fonte Atkinson Hyperlegible, botões grandes (alvo mínimo 44 px), alto contraste, pensado para quem tem dificuldade com tecnologia. Cor principal configurável por igreja.

## Regras de engenharia (obrigatórias)

1. **Isolamento entre igrejas:** toda tabela de dados de igreja tem `igreja_id`, e o isolamento é garantido por RLS no banco, nunca só pelo app. Uma igreja jamais acessa dados de outra; um membro jamais vê dados de outro membro.
2. **Dinheiro:** valores em inteiros (centavos) junto com o código da moeda (`BRL`). Nunca `float`.
3. **Nada se apaga:** registros relevantes nunca recebem DELETE físico; mudam de status.
4. **Auditoria:** gravada por triggers do banco numa tabela sem permissão de UPDATE ou DELETE.
5. **Migrations:** toda mudança no banco vira migration versionada em `supabase/migrations`. Nunca alterar o banco de produção direto pelo painel.
6. **Segredos:** chaves em `.env`, fora do Git (`.gitignore`). A chave `service_role` do Supabase NUNCA vai para o app; só para Edge Functions.
7. **Comprovantes:** bucket privado no Storage, acessado por links temporários (signed URLs).
8. **Testes:** escreva testes para regras de negócio e para as políticas de RLS (ex.: membro de uma igreja não lê dados de outra).
9. **Git:** commits pequenos, com mensagens em português, descrevendo o porquê.

## Perfis

- **Dizimista (membro):** próprio cartão, registrar dízimo e oferta, editar e cancelar pendentes, comprovante, aceitar ou contestar divergência.
- **Tesoureiro:** fila de conferência, confirmar, registrar divergência, lançar em nome do membro (devolução presencial), convidar membros, ver todos os dados cadastrais, relatório Excel. Não altera valor informado, não apaga nada, não confirma o próprio lançamento.
- **Pastor de Governo (administrador da igreja; o título exibido é configurável):** tudo do tesoureiro, mais gerenciar tesoureiros, inativar e reativar membros, reabrir lançamento confirmado (com justificativa), contas bancárias, campanhas, configurações e personalização da igreja, log.
- **Admin Master (dono da plataforma):** cadastrar igrejas e Pastor de Governo, logs globais. Acesso a dados de igrejas sempre auditado.

## Regras de negócio principais

- Membro só entra por convite (por e-mail; válido 7 dias; reenviável). E-mail já cadastrado na mesma igreja bloqueia novo convite.
- Uma pessoa pode estar em várias igrejas: um único login (usuário do Supabase Auth) e um registro em `membros` por igreja, com seletor de igreja no app.
- Lançamento guarda data do dízimo (pode ser retroativa) e data do registro.
- Estados do lançamento: `aguardando` → `em_conferencia` → `confirmado` | `divergencia`; `aguardando` → `cancelado` (motivo obrigatório). Só o Pastor de Governo reabre um confirmado (volta a `aguardando`, com justificativa).
- Conferência simultânea: quem abre o lançamento o bloqueia para outros tesoureiros; libera após 10 minutos parado.
- Divergência: o tesoureiro registra `valor_conferido` + observação, sem alterar o valor informado. O membro aceita (vira confirmado com o valor conferido) ou contesta. Sem resposta em 15 dias, fica sinalizada.
- Duplicado (mesmo valor e data) gera alerta, não bloqueio.
- Fila da tesouraria em ordem de chegada (FIFO).
- Oferta: registro opcional; tela e histórico próprios; toda oferta pertence a uma campanha. Toda igreja tem a campanha permanente "Oferta". Total arrecadado nunca aparece para o membro.
- Contas da igreja: até 5, com nome próprio e uma principal. Dízimo usa a principal; oferta usa a conta da campanha.
- Pix: o app gera código Pix estático (BR Code, "Pix Copia e Cola") com chave, nome, cidade e valor. "Copiar código Pix" é a ação principal; QR Code é secundário. Não há gateway no MVP.
- Alteração de conta ou chave Pix gera log e notifica os tesoureiros.
- Aceite dos termos registrado com data e versão (LGPD: vínculo religioso é dado sensível).

## Modelo de dados (12 tabelas)

`igrejas` (inclui país, idioma, moeda, personalização: logo, cor, capa, versículo, mensagem de confirmação, endereço, horários, site e redes, WhatsApp, formas de devolução aceitas, status, plano) · `contas` · `membros` (número sequencial por igreja, perfil, status convidado/ativo/inativo, campos extras em JSON) · `campos_cadastro` · `convites` · `lancamentos` (tipo dízimo/oferta, campanha_id, conta_id, valor informado e conferido em centavos, moeda, datas, forma, status, criado_por, em conferência por/desde, confirmado por/em, observação, motivo de cancelamento, resposta do membro) · `comprovantes` · `campanhas` (permanente, link de vídeo, conta_id) · `campanha_midias` · `dispositivos` (tokens de push) · `aceites_termos` · `auditoria`. Login fica no Supabase Auth.

## Escopo

- **MVP:** ciclo completo de dízimo e ofertas para o piloto, personalização da igreja, i18n e moeda preparados (app só em português).
- **Fase 2:** nomes usados por denominação, outros idiomas, moedas e meios de pagamento de outros países.
- **Futuro:** gateway de pagamento, conciliação bancária, controle financeiro da tesouraria (entradas, saídas, gráficos), SMS/WhatsApp, upload de vídeo.

## Estado atual

- **Etapa 1 concluída (ambiente e estrutura):** Node 24, npm 11, Git 2.56. Projeto Expo criado com o modelo padrão, rodando no Expo Go do celular via `npx expo start`.
- **SDK 57, não 58:** o `create-expo-app` gerou SDK 58, mas o Expo Go da Play Store ainda é 57, então o projeto foi recriado no 57. Atualizar com `npx expo install expo@^58 --fix` quando o Expo Go da loja chegar ao 58.
- Repositório privado no GitHub: `aloisio1910/meu-dizimo` (branch `main`). `.env` protegido no `.gitignore`; `.gitattributes` fixa fim de linha LF.
- Estrutura em `src/` (cada pasta tem um README): `app/` com grupos de rotas `(auth)`, `(membro)`, `(tesouraria)` (inclui telas do Pastor de Governo) e `(admin)`; `components/ui`, `theme`, `services/supabase`, `lib`, `hooks`, `types`, `i18n`.
- i18n pronto: i18next + react-i18next, textos em `src/i18n/locales/pt-BR.json`; chave inexistente é erro de TypeScript. Só existe uma tela provisória (`src/app/index.tsx`).
- Checagens antes de concluir uma tarefa: `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`. Pacotes sempre com `npx expo install` (nunca `npm audit fix --force`).
- No PowerShell do desenvolvedor foi preciso `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` para o `npx` funcionar.
- **Supabase configurado:** CLI como devDependency (`npx supabase ...`). Desenvolvimento no **Supabase local** (Docker Desktop + WSL 2; o Docker precisa estar aberto): `npx supabase start | status | stop`, Studio em http://127.0.0.1:54323, e-mails de teste no Mailpit em http://127.0.0.1:54324.
- Projeto na nuvem: `meu-dizimo`, ref `jcwogclevhpvrdsohzuf`, região `sa-east-1` (São Paulo), já ligado com `supabase link`. Ainda vazio: migrations só vão para lá com `npx supabase db push` depois de testadas no local.
- `.env` (fora do Git) aponta para o Supabase local pelo IP da rede (`http://192.168.100.30:54321`) para o celular alcançar; variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (a antiga "anon"). Modelo em `.env.example`.
- **Próximo passo:** criar as migrations das 12 tabelas com RLS, auditoria por triggers e testes de isolamento. Depende dos documentos "Fluxos, Telas e Modelo de Dados" e "Requisitos v0.3" (pedidos ao desenvolvedor) para não inventar colunas ou regras.
- Atualize esta seção ao fim de cada etapa importante.
