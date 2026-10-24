# Meu Dízimo.app — Fluxos, Telas e Modelo de Dados

Oct 20, 2026 · @Aloisio

Atualizado em 22/10/2026 com o que foi definido na construção do banco de dados e das primeiras telas (decisões D-067 a D-084 do Documento de Requisitos v0.4).

## 1. Fluxo principal

O ciclo central tem 9 passos entre tesouraria, sistema e membro, do convite até o dízimo aparecer como Confirmado no Cartão. Ele é a referência para o protótipo e para a primeira entrega do MVP.

&#91;embedded content: fluxo principal · 9 passos em 3 raias\]

**Passo a passo**

1. **Tesoureiro convida** (tela Membros → Convidar): informa nome, e-mail e celular. Se o e-mail já existe na igreja, o sistema bloqueia e avisa (RN-028).
2. **Sistema envia o convite**: cria o membro com status Convidado e manda um e-mail com o nome da igreja, os links das lojas e a instrução "entre com este e-mail". Válido por 7 dias.
3. **Membro entra com o código**: instala o app, digita o e-mail e recebe um código de 6 dígitos. O e-mail fica confirmado. O login só é criado se houver convite válido; ao entrar, o app liga o login à ficha convidada.
4. **Membro completa o cadastro**: preenche os campos definidos pela igreja, escolhe dízimo individual ou familiar, aceita os termos e, em separado, o consentimento para o dado sensível (registrados com data e versão). Status passa a Ativo. Em seguida, o app oferece ativar a entrada pela digital.
5. **Membro registra o dízimo**: no Cartão de Dízimo, toca em Registrar dízimo, informa valor, data (hoje por padrão) e forma. Se escolher Pix, toca em Copiar código Pix, paga no app do banco, volta e, se quiser, anexa o comprovante.
6. **Sistema cria o lançamento**: status Aguardando conferência, grava data do dízimo e data do registro, registra no log e envia push aos tesoureiros.
7. **Tesoureiro confere e confirma**: abre o primeiro da fila (fica Em conferência no nome dele; parado por 10 minutos, volta sozinho para a fila), compara com o extrato e o comprovante e toca em Confirmar.
8. **Sistema avisa o membro**: grava tesoureiro, data e hora da confirmação (a "assinatura") e envia o push "Seu dízimo de R$ 300,00 foi confirmado por João Jr.".
9. **Membro vê no Cartão**: a linha aparece como Confirmado, com o nome do tesoureiro.

## 2. Fluxos secundários

Cinco fluxos complementam o principal; todos reaproveitam o mesmo lançamento e terminam com registro no log.

**Divergência**

1. Na conferência, o tesoureiro toca em Registrar divergência, informa o valor conferido e uma observação.
2. O membro recebe push e vê lado a lado o valor informado e o conferido.
3. Toca em Aceitar (passa a Confirmado com o valor conferido) ou Contestar (escreve uma mensagem; a tesouraria recebe push).
4. Sem resposta em 15 dias, o lançamento fica sinalizado no painel da tesouraria. Se o membro contestar, a tesouraria reabre a conferência e confirma com o valor que conferiu, sem mudar o valor informado.

**Edição e cancelamento pelo membro**

1. Enquanto está Aguardando conferência, o membro abre o lançamento e toca em Editar ou Cancelar.
2. Cancelar exige motivo; o lançamento vira Cancelado e continua visível no histórico.
3. Se já estiver Em conferência, os botões ficam desabilitados com o aviso "A tesouraria está conferindo este lançamento".

**Devolução presencial**

1. O tesoureiro abre Lançar para membro e busca por nome, número, telefone ou e-mail do envelope.
2. Informa valor, data, forma e tipo (dízimo ou oferta e campanha).
3. O lançamento já nasce Confirmado, marcado como registrado pela tesouraria; o membro recebe push.

**Oferta**

1. O membro abre Ofertas, escolhe uma campanha ativa e vê arte, vídeo e descrição.
2. Toca em Ofertar: vê o Pix da igreja e copia o código com o valor.
3. Se quiser, toca em Registrar esta oferta; a partir daí segue o fluxo principal (passos 6 a 9), com o histórico na tela de Ofertas.

**Reabertura**

1. O Pastor de Governo abre um lançamento confirmado e toca em Reabrir, com justificativa obrigatória.
2. O lançamento volta para Aguardando conferência, entra na fila e o membro é avisado. Se foi o próprio tesoureiro que confirmou por engano, ele desfaz em até 15 minutos pelo filtro Conferidos da fila, com motivo (D-084).

## 3. Mapa de telas

Um único app com 22 telas em quatro áreas; cada pessoa vê só as áreas do seu perfil. O membro usa o celular, com 4 abas na parte de baixo (Cartão, Ofertas, Igreja, Perfil); a tesouraria usa de preferência a versão web no computador.

&#91;embedded content: mapa de telas · membro, tesouraria e Pastor de Governo\]

As telas do Admin Master (A-01 e A-02) ficam fora do desenho: são usadas só por você, na administração da plataforma.

| Código | Tela | O que faz | Perfil |
| --- | --- | --- | --- |
| M-01 | Entrar | E-mail e código de 6 dígitos, ou digital | Todos |
| M-02 | Primeiro acesso | Cadastro da igreja, individual ou familiar, termos e consentimento | Membro |
| M-03 | Cartão de Dízimo | Tela inicial: lançamentos por data, status, botão Registrar dízimo | Membro |
| M-04 | Registrar dízimo | Valor, data, forma, Copiar código Pix, QR Code, comprovante | Membro |
| M-05 | Detalhe do lançamento | Status, editar, cancelar, aceitar ou contestar divergência, comprovante | Membro |
| M-06 | Ofertas | Vitrine das campanhas ativas | Membro |
| M-07 | Campanha | Arte, vídeo, descrição, Ofertar, Registrar esta oferta | Membro |
| M-08 | Histórico de ofertas | Ofertas registradas, por data e campanha | Membro |
| M-09 | Igreja | Dados bancários, Pix, contato pelo WhatsApp | Membro |
| M-10 | Meu perfil | Dados, troca de e-mail, notificações, digital, sair | Membro |
| Apoio | Termos | Texto completo dos termos de uso e da política de privacidade | Todos |
| Apoio | Ativar digital | Oferta única por aparelho, após o primeiro acesso: Ativar a digital ou Agora não | Membro |
| Apoio | Desbloqueio | Pede a digital ao abrir o app e após 5 minutos fora; alternativa pelo código por e-mail | Todos (celular) |
| T-01 | Fila de conferência | Lançamentos por ordem de chegada, filtros | Tesoureiro |
| T-02 | Conferência | Dados e comprovante; Confirmar ou Registrar divergência | Tesoureiro |
| T-03 | Membros | Lista, busca, status, Convidar, reenviar convite | Tesoureiro |
| T-04 | Cartão do membro | Dados cadastrais e histórico de dízimos e ofertas | Tesoureiro |
| T-05 | Lançar para membro | Devolução presencial | Tesoureiro |
| T-06 | Relatórios | Filtros e exportação para Excel | Tesoureiro |
| P-01 | Tesoureiros | Cadastrar, autorizar, suspender | Pastor de Governo |
| P-02 | Campanhas | Criar e editar campanha, artes, link de vídeo, encerrar | Pastor de Governo |
| P-03 | Configurações da igreja | Dados, banco e Pix, contato, campos do cadastro, logo e cor | Pastor de Governo |
| P-04 | Log da igreja | Histórico de ações, com filtros | Pastor de Governo |
| A-01 | Igrejas | Cadastrar igreja e Pastor de Governo, status da assinatura | Admin Master |
| A-02 | Logs globais | Ações administrativas da plataforma | Admin Master |

Tesoureiro e Pastor de Governo também têm as telas de membro, para o próprio dízimo. Inativar e reativar membro ficam em T-04, visíveis só ao Pastor de Governo, assim como Reabrir lançamento em T-02.

## 4. Modelo de dados

São 12 tabelas no PostgreSQL do Supabase, e quase todas carregam o igreja\_id, que é o que permite ao banco isolar cada igreja (Row Level Security). Dízimo e oferta ficam na mesma tabela de lançamentos.

&#91;embedded content: modelo de dados · 9 das 12 tabelas\]

As tabelas usuarios, dispositivos e aceites\_termos ficam fora do desenho: ligam-se a membros pelo login.

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| igrejas | id, nome, denominação, país, idioma, moeda, título do administrador, logo, cor, capa, versículo, mensagem de confirmação, endereço, horários de culto, site e redes, WhatsApp de contato, formas de devolução aceitas, status (ativa ou inativa), faixa do plano, próximo número do dizimista | Título do administrador = "Pastor de Governo", "Pastor Presidente" etc. |
| contas | igreja\_id, nome da conta, finalidade, principal, banco, agência, conta, chave Pix, tipo da chave, nome do recebedor, cidade, ativa | Até 5 por igreja, uma principal. Nome e cidade são exigidos para gerar o código Pix (até 25 e 15 caracteres, pelo padrão do Pix). Pensada como meios de pagamento da igreja, para aceitar outros meios em outros países. Toda alteração notifica a tesouraria |
| membros | id, igreja\_id, usuario\_id, número do dizimista, nome, e-mail, celular, individual ou familiar, familiares, campos extras, perfil, status | Número sequencial por igreja. Perfil: membro, tesoureiro ou administrador da igreja. Status: convidado, ativo, inativo. E-mail único por igreja (RN-028). Familiares: lista de nomes |
| campos\_cadastro | igreja\_id, chave, rótulo, tipo, opções, obrigatório, ordem, ativo | Define os campos extras de cada igreja. Valores ficam em membros.campos extras |
| convites | igreja\_id, membro\_id, enviado por, enviado em, expira em, aceito em | Validade de 7 dias; reenviar cria novo registro |
| lancamentos | id, igreja\_id, membro\_id, tipo, campanha\_id, conta\_id, valor informado, valor conferido, data da contribuição, registrado em, forma, status, criado por, em conferência por e desde, confirmado por e em, observação da tesouraria, divergência por (e nome) e em, resposta do membro (aceita ou contestada), mensagem e data da resposta, motivo e data do cancelamento, registrado pela tesouraria, nome de quem confirmou | Tipo: dízimo ou oferta. Valores guardados em centavos, com o código da moeda, para evitar erro de arredondamento e permitir outros países. Status: aguardando, em conferência, confirmado, divergência ou cancelado; as mudanças de status só acontecem por funções do banco |
| comprovantes | igreja\_id, lancamento\_id, arquivo, formato (PDF, JPG ou PNG), enviado por, enviado em | Arquivo em área privada do armazenamento, aberto por link temporário; até 10 MB; nunca apagado |
| campanhas | id, igreja\_id, nome, descrição, objetivo, início, fim, status, permanente, link do vídeo, conta\_id | A campanha permanente Oferta é criada junto com a igreja e nunca encerra. Status: rascunho, ativa ou encerrada. Sem conta própria, usa a principal |
| campanha\_midias | igreja\_id, campanha\_id, arquivo, ordem, ativa | Artes da campanha, até 5 MB cada |
| dispositivos | usuario\_id, token de notificação, plataforma, ativo | Um usuário pode ter mais de um aparelho; se o aparelho trocar de conta, o token passa para o novo usuário |
| aceites\_termos | usuario\_id, versão do termo, aceito em | Prova do consentimento (LGPD); um registro por versão aceita, sem alteração |
| auditoria | igreja\_id, usuario\_id, perfil, ação, tabela, registro\_id, antes, depois, motivo, data e hora | Gravada por gatilhos do banco; sem permissão de alterar ou apagar |

Login, e-mail confirmado e códigos ficam no módulo de autenticação do Supabase (usuarios). Uma mesma pessoa em duas igrejas tem um usuário e dois registros em membros, um por igreja.

Além das tabelas, o banco tem: a visão lancamentos\_detalhados, que alimenta a fila da tesouraria e o Cartão com o nome e o número do membro; uma rotina que, a cada minuto, devolve à fila os lançamentos parados em conferência há mais de 10 minutos; e um porteiro do login, que só cria o acesso para e-mail com convite válido.

## 5. Pontos a confirmar e próximos passos

**Pontos a confirmar**

- [x] Pessoa em duas igrejas: um único login com seletor de igreja dentro do app, em vez de duas contas separadas. Confirmado em 20/10/2026 (D-061).
- [ ] Convite por e-mail com links das lojas, sem link mágico que abre o app direto. É mais simples de construir e funciona em qualquer celular.

**Próximos passos**

1. Revisar este documento.
2. Protótipo clicável das telas M-01 a M-09 e T-01 a T-02, para validar com o pastor e a tesouraria da Igreja Videira.
3. Ambiente de desenvolvimento: conta no GitHub, projeto no Supabase, conta no Expo e Claude Code instalado.
4. Primeira entrega: banco de dados com as 12 tabelas e o isolamento por igreja, seguido do fluxo principal de ponta a ponta.
