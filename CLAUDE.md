# Meu Dízimo.app

Plataforma multi-igreja que substitui o envelope físico de dízimo por um Cartão de Dízimo digital, preservando o relacionamento entre membro e igreja: o membro registra, a tesouraria confere, o tesoureiro confirma, o membro recebe o retorno. O app NÃO processa pagamentos no MVP: o membro paga no app do banco (Pix) e registra no Meu Dízimo. Produto pensado para virar SaaS vendido a igrejas de várias denominações. Piloto: Igreja Videira.

## Como trabalhar com o desenvolvedor

- Responda sempre em português do Brasil.
- O desenvolvedor é formado em programação, mas ficou 9 anos sem usar as ferramentas. Tem boa lógica; está desatualizado em ferramentas modernas (Expo, Supabase, Git moderno, TypeScript). Explique cada comando e cada conceito novo de forma curta e clara, na primeira vez que aparecer.
- Trabalhe em etapas pequenas. Ao fim de cada etapa: diga o que foi feito, como ele pode testar e qual é a próxima etapa.
- Peça confirmação antes de qualquer ação difícil de desfazer: apagar arquivos ou dados, migrations destrutivas, push forçado, publicar nas lojas, mexer em produção.
- O computador é Windows (PowerShell). Prefira comandos que funcionem no PowerShell.

## Documentos de referência (o desenvolvedor tem acesso)

- Documento de Requisitos v0.4: regras de negócio RN-001 a RN-041, decisões D-001 a D-095, escopo por fases, preços, LGPD.
- Fluxos, Telas e Modelo de Dados: fluxo principal em 9 passos, fluxos secundários, mapa de 22 telas (M-01 a M-10, T-01 a T-06, P-01 a P-04, A-01 a A-02), 12 tabelas.
- Protótipo clicável: app do membro (celular) e painel da tesouraria (web).
Se algo aqui parecer incompleto, pergunte ao desenvolvedor em vez de inventar regra de negócio.
Os originais ficam no Claude Docs (links em `docs/README.md`); `docs/requisitos.md` e `docs/fluxos-telas-modelo-de-dados.md` são exportações em Markdown, legíveis direto. Ao tomar uma decisão nova, registre-a no original (seção 13 do Requisitos, a partir de D-096) e exporte de novo.

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
- Checagens antes de concluir uma tarefa: `npm test` (Jest, testes do app), `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` e, se mexer no banco, `npm run banco:testes`. Pacotes sempre com `npx expo install` (nunca `npm audit fix --force`); no PowerShell, dependência de desenvolvimento é `npx expo install pacote "--" --dev`.
- Testes do app ficam em pastas `__tests__` com nome `*-test.ts`, nunca dentro de `src/app/` (lá todo arquivo vira tela), e importam `describe/it/expect` de `@jest/globals`.
- A cor principal da igreja vem da paleta `src/lib/paleta.ts`: 9 cores escuras, todas com contraste de 7:1 com o branco (testado), porque o botão secundário usa a cor como texto sobre branco. `corSegura` volta à cor padrão se uma cor clara chegar ao banco por outro caminho.
- No PowerShell do desenvolvedor foi preciso `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` para o `npx` funcionar.
- **Supabase configurado:** CLI como devDependency (`npx supabase ...`). Desenvolvimento no **Supabase local** (Docker Desktop + WSL 2; o Docker precisa estar aberto): `npx supabase start | status | stop`, Studio em http://127.0.0.1:54323, e-mails de teste no Mailpit em http://127.0.0.1:54324.
- Projeto na nuvem: `meu-dizimo`, ref `jcwogclevhpvrdsohzuf`, região `sa-east-1` (São Paulo), já ligado com `supabase link`. Ainda vazio: migrations só vão para lá com `npx supabase db push` depois de testadas no local.
- `.env` (fora do Git) aponta para o Supabase local pelo IP da rede (`http://192.168.100.30:54321`) para o celular alcançar; variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (a antiga "anon"). Modelo em `.env.example`.
- Documentos de referência atualizados em 22/10/2026 (Requisitos v0.4, com D-067 a D-082) e exportados para `docs/` em Markdown.
- **Banco de dados (só no local):** as migrations em `supabase/migrations` criam as 12 tabelas, RLS, auditoria e regras de negócio, e as seguintes acrescentam as regras de cada tela (convite e reativação, campanhas, perfis, contas, campos da tesouraria); testes pgTAP em `supabase/tests/database`, um arquivo por assunto (`npx supabase test db`). Ao mudar RLS, faça a prova de sabotagem: quebre a política no banco local, confirme que os testes falham e restaure com `npx supabase db reset`.
  - Padrões: o perfil técnico do Pastor de Governo é `administrador`; Admin Master = `app_metadata.admin_master` no Auth. Triggers de permissão só agem quando `current_user = 'authenticated'`; funções internas `security definer` passam direto e checam as regras elas mesmas. DELETE revogado em tudo. Erros mostrados ao usuário usam códigos curtos (ex.: `email_ja_cadastrado`) para o app traduzir pelo i18n.
  - Primeiro acesso: `convidar_membro` → login por código (o hook `hook_antes_de_criar_usuario` recusa e-mail sem convite) → `aceitar_convites` → `concluir_cadastro`. Lançamentos: o membro insere direto na tabela (o banco define status, moeda e conta); cancela com `cancelar_lancamento`; duplicado com `existe_lancamento_igual`. Conferência só por funções: `abrir_proximo_da_fila`, `abrir_conferencia`, `manter_conferencia`, `liberar_conferencia`, `confirmar_lancamento`, `registrar_divergencia`, `responder_divergencia`, `reabrir_lancamento`. Visão `lancamentos_detalhados` para a fila e o Cartão. pg_cron libera bloqueios parados a cada minuto.
  - Storage: buckets privados `comprovantes` (`<igreja>/<lancamento>/<arquivo>`), `campanhas` e `igrejas`, lidos por signed URL; sem apagar.
  - Decisões confirmadas pelo desenvolvedor: tesouraria só corrige e-mail de convidado; tesoureiro não edita dados cadastrais do membro; só Admin Master cria administrador; campanha sem conta usa a principal; data do lançamento não pode ser futura; comprovantes até 10 MB, artes e logos até 5 MB; nome de quem confirmou fica gravado no lançamento.
- **Pendências do backend:** enviar as migrations para a nuvem (`npx supabase db push`, pedir confirmação antes) e ligar lá o hook e os modelos de e-mail com código; e-mail de convite com links das lojas (Edge Function + Resend); notificações push (Edge Function); leitura pelo Admin Master ainda não auditada (fazer por funções ao criar A-01 e A-02); anonimização LGPD.
- **App (telas prontas e testadas no celular):** M-01 Entrar (e-mail + código de 6 números), M-02 Primeiro acesso (campos da igreja, individual/familiar, dois aceites LGPD), Termos (`src/i18n/termos/pt-BR.ts`, rascunho do piloto com pendências entre colchetes; mudar o texto exige mudar `versaoDosTermos`) e entrada pela digital (oferta única por aparelho; bloqueio ao abrir e após 5 min em segundo plano; código por e-mail como alternativa; "Sair" esquece a escolha). `src/app/index.tsx` é a porta de entrada que redireciona conforme sessão, fichas e digital; a parte de baixo ainda é provisória.
  - **Consultas do app sempre filtram pelo dono** (ex.: `usuario_id` nas fichas, `membro_id` nos lançamentos). A RLS deixa a tesouraria ver dados de todos os membros da igreja (D-057); sem o filtro, telas do membro tratariam fichas ou lançamentos de outras pessoas como próprios (defeito encontrado e corrigido em 24/10/2026).
  - Base visual em `src/theme` e `src/components/ui` (Texto, Botao, CampoTexto, CaixaSelecao, Opcoes, Tela). Contextos em `src/hooks`: sessão, fichas (chama `aceitar_convites` antes de buscar), bloqueio e tema.
  - **Mensagem de resultado (sucesso ou erro) fica logo abaixo do botão que a pessoa tocou**, com o componente `Retorno`; no topo de uma tela comprida ela passa despercebida (o desenvolvedor só leu subindo a tela).
  - **Botão Voltar usa `useVoltar(destino)`, nunca `router.back()`**: na web, recarregar a página apaga o histórico e o `back()` falha ("GO_BACK was not handled"). O estilo do código está em `.prettierrc` (aspas simples, 120 colunas).
  - As fichas (perfil e status) são conferidas de novo em silêncio ao abrir cada tela, ao voltar ao app e a cada minuto (`use-minhas-fichas`): um tesoureiro suspenso perde as telas logo. Os dados já são protegidos pela RLS.
  - Sessão no celular cifrada com AES-256-GCM (`expo-crypto`), chave no SecureStore. **No Android, `AESSealedData.fromCombined` não aceita texto base64**: passe sempre bytes (conversões em `src/lib/base64.ts` e `src/lib/utf8.ts`). Em desenvolvimento, `autotesteDoArmazenamento` mostra o resultado na janela do `npx expo start`.
  - Comprovantes (`src/components/secao-de-comprovantes.tsx`): foto, galeria ou PDF; o formato é decidido pela assinatura no início do arquivo (`src/lib/comprovante.ts`). **No Expo Go, o `DocumentPicker` com `copyToCacheDirectory: true` copia para uma pasta do Expo Go que o app não pode ler ("Missing 'READ' permission")**: use `false`. A leitura tenta File, base64 e fetch (`src/services/dispositivo/arquivos.ts`). Em desenvolvimento, o motivo técnico de uma falha aparece embaixo da mensagem de erro.
  - Código Pix validado num banco real (o banco mostrou o nome da chave e o valor).
  - `supabase/seed.sql` cria a "Igreja Videira (teste)" com convites para pastor@, tesoureiro@ e maria@teste.local e a campanha "Construção do templo" com vídeo do YouTube (só no local; códigos no Mailpit).
  - Também prontas: M-03 Cartão, M-04 Registrar dízimo, M-05 Detalhe, T-01 Fila e T-02 Conferência (com desfazer em 15 min, D-084), abas do membro (Cartão, Ofertas, Igreja, Perfil), M-06 Ofertas, M-07 Campanha, Ofertar (Pix antes, registro opcional), M-08 Histórico de ofertas, M-09 Igreja e M-10 Perfil. O bloco do Pix é o componente `pagamento-pix`.
  - Tesouraria e Pastor completos: T-01 a T-06 (Membros com convite e filtro por campo, Cartão do membro, Lançar para membro, Relatórios de lançamentos, membros e participação com planilha Excel) e P-01 Tesoureiros, P-02 Campanhas, P-03 Configurações e P-04 Log da igreja (frases a partir da auditoria, `src/lib/log.ts`) (contas e Pix, dados e contato, logo/capa/cor com recorte, campos do cadastro, incluindo os preenchidos pela tesouraria, D-093). Decisões D-085 a D-094 registradas nos documentos.
  - Na web, o endereço do Supabase local segue o da própria página, e toda chamada tem limite de espera (`fetch-com-limite`): se o IP do computador mudar, nada fica girando para sempre.
  - Vídeo da campanha: YouTube toca no app por `react-native-webview` (na web, iframe em `video-da-campanha.web.tsx`); outros links abrem fora. **A classe `URL` do React Native é incompleta**: leia links com expressão regular (`src/lib/video.ts`).
  - No modo de desenvolvimento as telas carregam sob demanda; para conferir se todas compilam, peça o pacote com `&lazy=false&transform.routerRoot=src%2Fapp`.
- **Próximo passo:** notificações push, e-mail de convite (Resend), seletor de igreja (D-061), telas do Admin Master (A-01, A-02) e o envio do banco para o Supabase na nuvem (pedir confirmação).
- Atualize esta seção ao fim de cada etapa importante.
