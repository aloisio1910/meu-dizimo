# Meu Dízimo.app — Documento de Requisitos v0.4

Oct 20, 2026 · @Aloisio

## 1. Visão do produto

O Meu Dízimo.app substitui o envelope físico de dízimo por um Cartão de Dízimo digital, preservando o relacionamento entre membro e igreja: o membro registra, a tesouraria confere, o tesoureiro confirma e o membro recebe o retorno.

O app atende igrejas de diferentes denominações. O núcleo é o dízimo. Em torno dele, oferece um ambiente de ofertas dinâmico, onde cada igreja divulga e acompanha suas próprias campanhas.

**Princípios**

- **Relacionamento antes de transação.** O app não é, em essência, uma plataforma de pagamentos.
- **Registro separado do pagamento.** O membro informa "devolvi R$ 300,00"; a transferência acontece no banco dele. O app facilita, mas não processa o dinheiro no MVP.
- **Simplicidade.** Poucos passos, letras legíveis, pensado para quem tem pouca familiaridade com tecnologia.
- **Nada se apaga.** Registros relevantes mudam de status, nunca são excluídos fisicamente.
- **Cada igreja é dona dos seus dados.** Isolamento total entre igrejas.

**Histórico de versões**

| Versão | Data | O que mudou |
| --- | --- | --- |
| 0.4 | 22/10/2026 | Decisões tomadas na construção do banco de dados e das primeiras telas (D-067 a D-084): permissões, lançamentos, campanhas, entrada pela digital, sessão criptografada, LGPD e hospedagem no Brasil |
| 0.3 | 20/10/2026 | Decisões das questões abertas, correções de consistência, módulo de Ofertas e Campanhas, QR Code Pix, LGPD, escopo por fases |
| 0.2 | 17/08/2026 | Documento de requisitos estruturado, regras de negócio e registro de decisões |
| 0.1 | — | Ideia inicial: janelas do app e perfis |

## 2. Perfis e permissões

São quatro perfis. Cada perfil herda o anterior apenas onde indicado: o Pastor de Governo tem tudo do Tesoureiro; o Administrador Master não opera a tesouraria das igrejas.

| Permissão | Dizimista | Tesoureiro | Pastor de Governo | Admin Master |
| --- | --- | --- | --- | --- |
| Ver e editar os próprios dados | Sim | Sim | Sim | Sim |
| Lançar dízimo e oferta próprios | Sim | Sim | Sim | — |
| Editar ou cancelar lançamento pendente próprio | Sim | Sim | Sim | — |
| Ver cartões de todos os membros da igreja | — | Sim | Sim | — (D-098) |
| Fila de conferência: confirmar ou registrar divergência | — | Sim | Sim | — |
| Lançar em nome do membro (devolução presencial) | — | Sim | Sim | — |
| Convidar membros e reenviar convite | — | Sim | Sim | — |
| Inativar ou reativar membro | — | — | Sim | — |
| Reabrir lançamento confirmado | — | — | Sim | — |
| Cadastrar, autorizar e suspender tesoureiros | — | — | Sim | — |
| Dados bancários, Pix e contato da igreja | — | — | Sim | — |
| Campos do cadastro do membro | — | — | Sim | — |
| Criar e gerenciar campanhas de oferta | — | — | Sim | — |
| Gerar relatório Excel | — | Sim | Sim | — |
| Cadastrar igrejas e Pastor de Governo | — | — | — | Sim |
| Logs globais da plataforma | — | — | — | Sim |

"Auditado" significa que todo acesso do Admin Master a dados de uma igreja gera registro no log daquela igreja. Dos membros, o Admin Master só vê o que acha pelo Atendimento (busca por e-mail, com motivo); não vê cartões, valores nem comprovantes (D-098).

**O Tesoureiro nunca pode:** alterar o valor informado pelo membro, apagar lançamentos ou histórico, nem fazer operações exclusivas do Pastor de Governo.

Tesoureiro e Pastor de Governo também são membros da igreja e podem ter o próprio Cartão de Dízimo. Um tesoureiro não confirma o próprio lançamento: outro tesoureiro ou o Pastor de Governo confirma.

## 3. Multi-igreja e isolamento

Uma única plataforma atende várias igrejas, de denominações diferentes, e nenhuma igreja enxerga dados de outra.

- Todo registro (membro, lançamento, campanha, comprovante, log) carrega o identificador da igreja a que pertence.
- O isolamento é garantido **no banco de dados** (Row Level Security), não apenas nas telas. Mesmo um erro no app não expõe dados de outra igreja.
- Um cadastro de membro pertence a uma única igreja. Quem contribui em duas igrejas tem um único login e um cadastro independente em cada igreja, e escolhe a igreja dentro do app.
- Cada igreja tem ID único e cada membro tem ID único, independente de nome, e-mail ou telefone.

**Diferenças entre denominações se resolvem por configuração, não por código.** Cada igreja ajusta:

- os campos do cadastro (ex.: Videira usa Líder, Discipulador, Pastor de Rede; outra igreja pode usar Congregação e Setor);
- as formas de devolução aceitas;
- as campanhas de oferta, com suas artes e vídeos;
- dados bancários, Pix e contato;
- a identidade visual básica e as informações da igreja, para o membro reconhecer a própria igreja no app (seção 17).

O nome dos perfis pode variar por denominação ("Pastor de Governo", "Pastor Presidente", "Pastor Titular"). Sugestão: o perfil técnico se chama Administrador da Igreja, e cada igreja define o título exibido.

## 4. Convite, acesso e cadastro

O membro só entra por convite da igreja e acessa sem senha, com um código de 6 dígitos enviado por e-mail.

**Convite**

- Enviado por e-mail no MVP. SMS e WhatsApp ficam para o futuro, como recurso pago, porque cada mensagem tem custo.
- Válido por 7 dias e pode ser reenviado pela tesouraria.
- Se o e-mail já existe na mesma igreja, o sistema bloqueia o convite e avisa quem convidou.

**Primeiro acesso**

1. Membro instala o app pelos links das lojas que vêm no e-mail do convite e digita o e-mail convidado.
2. Recebe e digita o código de 6 dígitos (confirma o e-mail). Sem convite válido, o login não é criado e o app explica que é preciso pedir um convite (RN-002).
3. Confirma o celular (no MVP, apenas informado; confirmação por SMS fica para o futuro).
4. Completa os campos de cadastro definidos pela igreja.
5. Aceita os termos de uso e a política de privacidade e, num aceite separado, dá o consentimento específico para o dado sensível (D-080).
6. Pode ativar a entrada pela digital e cai direto no Cartão de Dízimo.

**Acesso no dia a dia**

- Login pelo e-mail com código de 6 dígitos, sem senha para esquecer.
- Entrada pela digital (ou reconhecimento facial): depois do primeiro acesso com código, o app oferece ativar a digital, e a partir daí o membro entra só encostando o dedo. O código por e-mail fica como alternativa se a digital falhar ou num aparelho novo.
- Com a digital ativada, ela é pedida ao abrir o app e ao voltar depois de 5 minutos em segundo plano. Sair da conta esquece a escolha da digital no aparelho, para quem entrar depois decidir por si (D-078).
- A sessão de login fica guardada criptografada no celular, com a chave no cofre do aparelho (D-079).
- Recuperação de acesso = pedir um novo código. Se o membro perdeu o e-mail, a tesouraria atualiza e reenvia o convite.

**Cadastro**

- Obrigatórios em todas as igrejas: nome, e-mail e celular.
- Campos configuráveis por igreja: cada um pode ser obrigatório, opcional, preenchido pela tesouraria (o membro só vê, D-093) ou não usado. Tipos: texto, data, número, lista de opções.
- Dízimo individual ou familiar; no familiar, o membro informa os nomes da família. Sem acesso compartilhado ao cartão.
- O membro altera os próprios dados. Troca de e-mail exige código no novo e-mail; o anterior continua valendo até a confirmação.
- Quem perdeu o acesso ao e-mail pede à tesouraria, que troca com motivo registrado no log; a pessoa é avisada no celular e no e-mail antigo. O e-mail do Pastor de Governo, e o de quem também está em outra igreja, só é trocado pelo suporte do app (D-097).

**Ciclo de vida do membro**

| Status | Significado | Acesso |
| --- | --- | --- |
| Convidado | Convite enviado, ainda não aceito | Não |
| Ativo | Cadastro concluído | Sim |
| Inativo | Saiu da igreja ou foi desligado pela liderança | Não, histórico preservado |

O Pastor de Governo pode reativar um membro inativo; o histórico volta junto. Quem nunca concluiu o cadastro volta a Convidado, não a Ativo. Um convite feito por engano pode ser cancelado pela tesouraria (D-085).

## 5. Cartão de Dízimo e lançamentos

O Cartão de Dízimo é a tela principal: mostra nome e número do dizimista e os lançamentos em ordem de data, com status e o tesoureiro que confirmou.

| Data do dízimo | Valor informado | Status | Tesoureiro |
| --- | --- | --- | --- |
| 12/10/2026 | R$ 300,00 | Aguardando conferência | — |
| 09/09/2026 | R$ 300,00 | Confirmado | João Jr. |
| 10/08/2026 | R$ 300,00 | Confirmado | João Jr. |

**Registrar dízimo (Enviar Valor)**

- O membro informa valor, data do dízimo (hoje por padrão, pode ser retroativa, nunca futura) e forma de devolução (Pix, cartão, dinheiro, transferência ou outra definida pela igreja).
- Comprovante opcional (PDF, JPG, PNG), anexado na hora ou depois, a um lançamento já existente. No MVP todo comprovante pertence a um lançamento: isso evita comprovantes soltos sem dono na fila.
- O sistema guarda separadamente a **data do dízimo** e a **data do registro**.
- Cada lançamento guarda quem o criou: o próprio membro ou a tesouraria (devolução presencial).
- Se o membro lançar o mesmo valor na mesma data duas vezes, o app pergunta "Você já registrou este valor nesta data. Deseja registrar novamente?". Alerta, não bloqueia.

**Estados do lançamento**

&#91;embedded content: estados do lançamento · 5 status\]

Enquanto aguarda conferência, o membro ainda pode editar ou cancelar; depois de confirmado, só o Pastor de Governo reabre.

| Status | Quando | Quem age |
| --- | --- | --- |
| Aguardando conferência | Membro registrou | Membro pode editar ou cancelar |
| Em conferência | Um tesoureiro abriu o lançamento | Bloqueado para outros tesoureiros e para o membro |
| Confirmado | Tesoureiro conferiu e confirmou | Ninguém altera; só o Pastor de Governo reabre, com justificativa |
| Divergência | Valor conferido difere do informado | Membro aceita ou contesta |
| Cancelado | Membro cancelou antes da confirmação, com motivo obrigatório | Fica no histórico |

**Divergência com valor conferido**

O tesoureiro nunca altera o valor informado. Ele registra um **valor conferido** ao lado, com uma observação. O membro é notificado e vê as duas informações:

- **Aceitar**: o lançamento passa a Confirmado com o valor conferido; o valor original continua guardado.
- **Contestar**: o membro escreve uma mensagem e o caso fica sinalizado para a tesouraria resolver, pelo contato da igreja se preciso. Para resolver, a tesouraria reabre a conferência e confirma com o valor que conferiu (D-075).

Uma divergência sem resposta do membro em 15 dias fica sinalizada no painel da tesouraria.

## 6. Ofertas e Campanhas

As ofertas têm uma tela própria, separada do Cartão de Dízimo, e funcionam como uma vitrine das campanhas da igreja. Registrar a oferta no app é sempre opcional para o membro.

**Campanhas**

- Cada igreja cria e gerencia as próprias campanhas (Pastor de Governo).
- Toda igreja começa com uma campanha permanente, **Oferta**, para as ofertas comuns dos cultos.
- Campanhas extraordinárias têm: nome, descrição, objetivo, data de início e fim, status (rascunho, ativa, encerrada) e mídia.
- Mídia da campanha: artes (imagens) enviadas pela igreja e vídeos. Vídeos entram por link. Links do YouTube tocam dentro do app, no player oficial incorporado (pode ser vídeo não listado); outros links (Instagram, Vimeo) aparecem como botão Assistir vídeo, que abre o app correspondente. Hospedar vídeos próprios custa caro em armazenamento e tráfego; upload direto pode vir depois, com limite de tamanho por plano.
- Campanhas encerradas saem da vitrine, mas continuam nos históricos e relatórios. A campanha encerra sozinha depois da data de fim, e o Pastor de Governo pode reabri-la (D-088, D-089). Rascunhos só a tesouraria e o Pastor de Governo veem (D-074).
- **Sem meta ou total arrecadado visível ao membro.** Os totais por campanha ficam restritos a tesouraria e Pastor de Governo, nos relatórios.

**Tela de Ofertas (membro)**

1. Vê as campanhas ativas, cada uma como um cartão com arte, nome e descrição curta.
2. Abre a campanha: arte em destaque, vídeo, descrição completa e o botão **Ofertar**.
3. Ao ofertar, vê os dados bancários e o Pix da igreja e, se quiser, registra a oferta (valor, data, forma, comprovante).
4. As ofertas registradas aparecem no **Histórico de Ofertas**, separado do Cartão de Dízimo.

**Na tesouraria**, a oferta registrada segue o mesmo caminho do dízimo: entra na fila, é conferida, confirmada ou marcada com divergência, sempre identificando a campanha.

No modelo de dados, dízimo e oferta são o mesmo tipo de lançamento, com um campo **tipo** (dízimo ou oferta) e um campo **campanha**. Isso reaproveita fila, confirmação, comprovante, log e relatório sem duplicar código.

## 7. Dados bancários, Pix e QR Code

O app mostra a chave Pix oficial da igreja e gera um QR Code Pix com o valor já preenchido, sem precisar de gateway.

- O Pastor de Governo cadastra até 5 contas da igreja, cada uma com um nome escolhido pela igreja (ex.: Dízimos e ofertas, Construção do templo, Missões), banco, agência, conta, chave Pix, tipo de chave e nome do recebedor. Uma delas é a principal. Cada campanha aponta para uma conta: o dízimo usa a principal e a oferta usa a conta da campanha (ou a principal, se a campanha não tiver conta própria, D-073), sem o membro precisar escolher. A tesouraria vê em cada lançamento a conta de destino.
- O membro vê todas as contas na aba Igreja, a principal primeiro, cada uma com o botão **Copiar chave Pix**.
- **QR Code e Pix Copia e Cola com valor:** ao registrar dízimo ou oferta, o app gera o código Pix estático com a chave da igreja e o valor informado. No celular, o botão principal é Copiar código Pix: o membro cola no aplicativo do banco (Pix Copia e Cola) e só confirma. O QR Code fica como opção secundária, para pagar a partir do computador, do telão ou de material impresso. Isso reduz erro de digitação e o risco de chave fraudulenta.
- Toda alteração de dados bancários ou chave Pix gera registro no log e notificação aos tesoureiros, como proteção contra troca indevida da chave. O Pastor de Governo pode gerar um Pix de teste de R$ 0,01 para conferir a conta antes de os membros pagarem (D-091).
- O app não confirma automaticamente que o Pix caiu na conta. Essa confirmação continua sendo da tesouraria.

**Gateway de pagamento (fora do MVP).** A arquitetura fica preparada para os três modelos já definidos: gateway da própria igreja (link), gateway parceiro do Meu Dízimo.app (modelo de negócio a pesquisar, por exemplo divisão de pagamento) e sem gateway.

**Contato da igreja.** O Pastor de Governo cadastra o contato de suporte (ex.: WhatsApp Business). O membro tem um botão que abre a conversa direto no WhatsApp.

## 8. Tesouraria

A tesouraria trabalha numa fila por ordem de chegada, usada preferencialmente no computador (versão web) e também disponível no celular.

**Fila de conferência**

- Lançamentos novos entram na fila em ordem de chegada, com nome, tipo (dízimo ou oferta e campanha), valor, forma, data e ícone de comprovante.
- O tesoureiro abre o primeiro, confere com o extrato e escolhe **Confirmar** ou **Registrar divergência**. O próximo abre em seguida.
- **Vários tesoureiros ao mesmo tempo:** quem abre um lançamento o deixa "Em conferência por João Jr.". Os outros pulam para o seguinte. Se ficar parado por 10 minutos, volta para a fila.
- Filtros: só dízimos, só ofertas, por campanha, com ou sem comprovante.

**Devolução presencial (envelope avulso)**

- O envelope avulso traz nome, telefone, e-mail e número do dizimista.
- O tesoureiro busca o membro por qualquer um desses dados e lança em nome dele, já como Confirmado.
- O lançamento fica marcado como "registrado pela tesouraria" e o membro recebe a notificação normalmente.
- Oferta anônima (envelope sem identificação) é controlada pela tesouraria fora do app. Uma ferramenta para rotinas administrativas da igreja pode ser avaliada no futuro, fora do foco atual.

**Reabertura**

Só o Pastor de Governo reabre um lançamento confirmado, com justificativa obrigatória. Exceção: o tesoureiro que confirmou por engano desfaz em até 15 minutos, com motivo (D-084). O lançamento volta para a fila e tudo fica no log.

## 9. Notificações, relatórios e auditoria

**Notificações push**

| Evento | Quem recebe | Pode desativar? |
| --- | --- | --- |
| Lançamento confirmado | Membro | Não |
| Divergência registrada | Membro | Não |
| Lançamento reaberto | Membro | Não |
| Nova campanha de oferta | Membros da igreja | Sim |
| Novo lançamento ou comprovante | Tesoureiros | Sim (resumo diário como alternativa) |
| Divergência contestada | Tesoureiros | Não |
| Dados bancários ou Pix alterados | Tesoureiros e Pastor de Governo | Não |

Os avisos também ficam guardados no app, numa aba Avisos com os não lidos; quem causou o evento não é avisado. O push chega primeiro no Android, e no iPhone quando houver a conta Apple Developer (D-096).

O serviço de notificações fica preparado para outros canais no futuro (e-mail, WhatsApp).

**Relatório Excel**

- Filtros: período (qualquer intervalo, com atalho para o mês), tipo (dízimo ou oferta), campanha e status.
- Colunas: ID e nome do membro, campos de cadastro da igreja (D-086), tipo, campanha, data do dízimo, data do registro, valor informado, valor conferido, forma, conta de destino, status, tesoureiro, quem registrou.
- Totais por tipo e por campanha ficam no relatório, restritos à tesouraria e ao Pastor de Governo. Somam só o confirmado; o que ainda não foi conferido aparece à parte (D-087).
- Outros relatórios: Membros por situação e Participação no período, todos com filtro por campo do cadastro (ex.: Célula). A lista de quem não devolveu no período é só do Pastor de Governo, sem valores (D-094).

**Logs e auditoria**

- Cada igreja tem o próprio log. Cada registro guarda: quem, perfil, data e hora, ação, registro afetado, situação anterior e posterior, motivo.
- O log é gravado pelo próprio banco de dados (não depende do app lembrar de registrar) numa tabela sem permissão de edição ou exclusão.
- O Pastor de Governo consulta o log com filtros, pesquisa e páginas numeradas, e pode baixá-lo em planilha; o próprio download fica registrado no log (D-095).
- Nenhum registro relevante é apagado fisicamente: muda de status (Ativo, Suspenso, Cancelado, Inativo).

## 10. Privacidade e LGPD

O app trata dado pessoal sensível: vínculo com uma igreja revela convicção religiosa (LGPD, art. 5º, II), e os comprovantes trazem dados bancários. A conformidade precisa estar resolvida antes de oferecer o app a outras igrejas.

- **Papéis:** a igreja é a controladora dos dados dos seus membros; o Meu Dízimo.app é o operador. Isso precisa constar no contrato com cada igreja.
- **Consentimento:** no primeiro acesso, o membro aceita termos de uso e política de privacidade, com consentimento específico e destacado para o tratamento de dados sensíveis, dado num aceite separado (D-080). O texto em uso é a versão 0.1, rascunho para o piloto. O aceite fica registrado com data e versão do termo.
- **Comprovantes:** armazenados em área privada, acessíveis apenas ao próprio membro e à tesouraria da igreja, por links temporários.
- **Direitos do titular:** o membro consegue ver seus dados e solicitar cópia ou exclusão. Na exclusão, os dados pessoais são anonimizados e os lançamentos permanecem para a contabilidade da igreja.
- **Retenção:** prazo de guarda de lançamentos e comprovantes a definir com a orientação contábil e jurídica.
- **Segurança:** dados criptografados em trânsito e em repouso, acesso por perfil e log de todo acesso administrativo. No celular, a sessão de login fica criptografada (D-079). Os dados ficam hospedados no Brasil, em São Paulo (D-081).

Antes da comercialização: termos de uso, política de privacidade e contrato com as igrejas revisados por advogado. Para o piloto na Igreja Videira, uma versão simples dos termos é suficiente para começar.

## 11. Escopo por fases

O MVP entrega o ciclo completo do dízimo e das ofertas para a Igreja Videira usar de verdade no piloto.

| Fase | Objetivo | Entregas |
| --- | --- | --- |
| MVP | Piloto do dízimo e das ofertas na Igreja Videira | Convite e acesso por código; cadastro configurável; Cartão de Dízimo; lançamento, retroativo, edição e cancelamento; comprovante; fila da tesouraria com conferência simultânea; divergência com valor conferido; devolução presencial; dados bancários, copiar Pix e QR Code Pix; contato via WhatsApp; push; relatório Excel; logs; gestão de tesoureiros e membros; cadastro de igrejas (Admin Master); personalização da igreja (seção 17); textos e moeda preparados para tradução; campanhas de oferta com artes e vídeos por link; tela de Ofertas; histórico de ofertas; filtros de oferta na fila e no relatório |
| Fase 2 | Preparação para outras igrejas e denominações | Nomes usados pela igreja e títulos de perfil por denominação; outros idiomas, moedas e meios de pagamento de outros países; termos e contrato revisados para comercialização |
| Futuro | Crescimento do negócio | Gateway (próprio, parceiro ou nenhum); confirmação automática de pagamento; SMS e WhatsApp automatizados; upload de vídeo; painéis financeiros; outros tipos de contribuição; planos e cobrança das igrejas; controle financeiro da tesouraria (seção 16) |

Ofertas entraram no MVP em 20/10/2026 para o piloto já cobrir dízimo e oferta; como os dois usam o mesmo modelo de lançamento, o acréscimo de trabalho é pequeno.

**Plano de evolução depois do MVP (D-107, a partir da pesquisa de concorrência de 28/10/2026)**

A base recebe o que fortalece o ciclo do dízimo e da oferta; o premium recebe a gestão financeira (seção 16). Ordem de execução:

| Ordem | Funcionalidade | Pacote | Quem já tem | Esforço |
| --- | --- | --- | --- | --- |
| 1. Antes do piloto ou logo nele | **B1. QR Code da igreja para o culto:** no telão ou impresso, abre direto a oferta ou a campanha no app | Base | Gestão de Dízimo | Pequeno |
| 1. Antes do piloto ou logo nele | **B2. Importar membros por planilha:** a tesouraria sobe uma planilha e o app cria os convites | Base | Adm Igrejas, Igreja Digital | Médio |
| 2. Primeiros meses do piloto | **B3. Declaração anual de contribuições:** o membro gera o PDF do ano, só com o confirmado | Base | Sistema Reino, Religio | Pequeno a médio |
| 2. Primeiros meses do piloto | **B4. Lembrete do próprio membro:** ele escolhe o dia e recebe um push; quem pede é o membro, nunca a igreja | Base | Gestão de Dízimo | Pequeno |
| 2. Primeiros meses do piloto | **B5. Agradecimento personalizado na confirmação:** o texto da igreja vai no push | Base | Gestão de Dízimo | Pequeno |
| 3. Lançamento do premium | **P1. Entradas, saídas, saldo e gráficos** | Premium | Amosh, ADMmembros, Reino, Religio | Grande |
| 3. Lançamento do premium | **P6. Push programado** (lembretes de contas e de fechamento, mensagem agendada, resumo ao Pastor; D-103) | Premium | — | Médio |
| 4. Depois do lançamento do premium | **P3. Fechamento mensal e prestação de contas em PDF** | Premium | Religio, Reino | Médio |
| 4. Depois do lançamento do premium | **P4. Exportação para o contador** | Premium | Amosh | Pequeno |
| 5. Por último | **P2. Conciliação bancária** (extrato OFX casado com os Pix) | Premium | ADMmembros, Religio | Grande |
| 5. Por último | **P5. Congregações** (sede e filiais, com consolidado; possivelmente cobrado por congregação) | Premium | Reino, Amosh, Religio | Grande |
| 6. Depois do premium (Pacote Comunidade) | C1. Agenda e eventos com inscrição; C2. Células; C3. Carteirinha digital (com os filhos, informados pelo responsável); C4. Pedidos de oração; C5. Devocional ou plano de leitura (seção 16) | Comunidade | Amosh, Congrega, ADMmembros, Igreja Digital | Pequeno a grande, por item |
| Ideia a pensar, bem depois | C6. Check-in infantil (depende de rever a D-104 e de estudo jurídico) | Comunidade | Amosh | Grande |
| No lançamento comercial | **B6. Plano grátis para igrejas muito pequenas** (até 25 ou 30 membros) | Preço (seção 15) | Amosh, Igreja Digital, ADMmembros | Só regra de cobrança |

Fora do plano: assistente com IA e site da igreja. O app com o nome da igreja nas lojas fica sob consulta para igrejas muito grandes. A Comunidade só começa depois do piloto rodando e do premium lançado, para o app não perder o foco no ciclo do dízimo (D-108).

## 12. Regras de negócio

As regras RN-001 a RN-026 da v0.2 continuam válidas, com os ajustes marcados. As regras novas começam em RN-027.

| ID | Regra | Situação |
| --- | --- | --- |
| RN-001 | Um cadastro de membro pertence a uma única igreja | Mantida |
| RN-002 | O membro só acessa mediante convite da igreja | Mantida |
| RN-003 | Cada membro possui ID único | Mantida |
| RN-004 | A igreja define os campos cadastrais adicionais | Mantida |
| RN-005 | Nome é obrigatório | Mantida |
| RN-006 | E-mail e celular são obrigatórios | Mantida |
| RN-007 | Acesso por e-mail com código de 6 dígitos; celular como identificador fica para quando houver SMS | Ajustada |
| RN-008 | E-mail confirmado por código; confirmação de celular na fase de SMS | Ajustada |
| RN-009 | O membro pode alterar seus dados | Mantida |
| RN-010 | Alteração de e-mail exige confirmação | Mantida |
| RN-011 | Lançamento retroativo permitido | Mantida |
| RN-012 | Data do dízimo e data do registro são distintas | Mantida |
| RN-013 | Lançamento pendente pode ser editado | Mantida |
| RN-014 | Lançamento confirmado não pode ser apagado pelo membro | Mantida |
| RN-015 | Lançamento pendente pode ser cancelado | Mantida |
| RN-016 | Cancelamento exige justificativa | Mantida |
| RN-017 | Cancelamentos permanecem registrados | Mantida |
| RN-018 | O tesoureiro não altera o valor informado; registra o valor conferido | Ajustada |
| RN-019 | Divergências são comunicadas ao membro | Mantida |
| RN-020 | Fila em ordem de chegada | Mantida |
| RN-021 | Ações relevantes registradas em log | Mantida |
| RN-022 | Igrejas não acessam dados umas das outras | Mantida |
| RN-023 | Pastor de Governo e Tesoureiro geram relatório Excel | Ajustada |
| RN-024 | Gateway não é obrigatório no MVP | Mantida |
| RN-025 | A chave Pix é fornecida pela igreja | Mantida |
| RN-026 | Registros relevantes não são apagados fisicamente | Mantida |
| RN-027 | Convite válido por 7 dias, pode ser reenviado | Nova |
| RN-028 | E-mail já cadastrado na mesma igreja bloqueia novo convite | Nova |
| RN-029 | Lançamento aberto por um tesoureiro fica bloqueado para os demais; libera após 10 minutos parado | Nova |
| RN-030 | Membro aceita ou contesta a divergência | Nova |
| RN-031 | Só o Pastor de Governo reabre lançamento confirmado, com justificativa | Nova |
| RN-032 | Lançamento duplicado (mesmo valor e data) gera alerta, não bloqueio | Nova |
| RN-033 | Tesoureiro pode lançar em nome do membro; o lançamento registra quem o criou | Nova |
| RN-034 | Tesoureiro não confirma o próprio lançamento | Nova |
| RN-035 | Membro inativo perde acesso; histórico preservado | Nova |
| RN-036 | Registro de oferta é opcional para o membro | Nova |
| RN-037 | Ofertas têm histórico próprio, separado do Cartão de Dízimo | Nova |
| RN-038 | Toda oferta pertence a uma campanha; cada igreja tem a campanha permanente Oferta | Nova |
| RN-039 | Total arrecadado por campanha não é exibido ao membro | Nova |
| RN-040 | Alteração de dados bancários ou Pix notifica os tesoureiros | Nova |
| RN-041 | Aceite dos termos registrado com data e versão | Nova |

## 13. Registro de decisões

As decisões D-001 a D-036 da v0.2 seguem válidas. Abaixo, as novas, tomadas em 20/10/2026.

| ID | Decisão | Status |
| --- | --- | --- |
| D-037 | Acesso sem senha, com código de 6 dígitos por e-mail e sessão longa com biometria | Definido |
| D-038 | Convite e códigos por e-mail no MVP; SMS e WhatsApp no futuro, por custo | Definido |
| D-039 | Convite com validade de 7 dias e reenvio | Definido |
| D-040 | Divergência resolvida com valor conferido separado; membro aceita ou contesta | Definido |
| D-041 | Bloqueio do lançamento durante a conferência para evitar dois tesoureiros no mesmo item | Definido |
| D-042 | Reabertura de confirmado só pelo Pastor de Governo, com justificativa | Definido |
| D-043 | Duplicados geram alerta, não bloqueio | Definido |
| D-044 | Relatório por qualquer período e por status | Definido |
| D-045 | Ofertas em tela própria, com histórico separado do dízimo | Definido |
| D-046 | Registro de oferta opcional | Definido |
| D-047 | Campanhas por igreja, com artes e vídeos | Definido |
| D-048 | Sem meta ou total arrecadado visível ao membro | Definido |
| D-049 | Plataforma atende várias denominações; diferenças por configuração | Definido |
| D-050 | Dízimo e oferta no mesmo modelo de lançamento, com campo tipo e campanha | Definido |
| D-051 | Código Pix estático com valor, sem gateway: Copiar código Pix como ação principal, QR Code como secundária | Definido |
| D-052 | Ofertas e campanhas entram no MVP (piloto) | Definido |
| D-053 | Vídeos de campanha por link: YouTube toca dentro do app; outros links abrem o app de origem; upload direto só no futuro | Definido |
| D-054 | Tecnologia: React Native com Expo (TypeScript) e Supabase | Definido |
| D-055 | Tesoureiro e Pastor de Governo convidam membros | Definido |
| D-056 | Divergência sem resposta do membro em 15 dias fica sinalizada para a tesouraria | Definido |
| D-057 | Tesoureiro vê todos os dados cadastrais do membro (não há senha armazenada, o acesso é por código) | Definido |
| D-058 | Entrada pela digital ou reconhecimento facial após o primeiro acesso; código por e-mail como alternativa | Definido |
| D-059 | Oferta anônima fica fora do app, no controle próprio da tesouraria | Definido |
| D-060 | Cobrança por mensalidade em faixas de membros ativos (ex.: até 100, 101 a 200, 201 a 500); valores a definir | Definido |
| D-061 | Pessoa em duas igrejas: um único login com seletor de igreja; um cadastro de membro por igreja | Definido |
| D-062 | Controle financeiro da tesouraria (entradas, saídas, gráficos) previsto como atualização futura | Definido |
| D-063 | App preparado para tradução e várias moedas desde o MVP; lançamento só em português | Definido |
| D-064 | Dados de pagamento modelados como meios de pagamento da igreja (Pix é um deles), para atender outros países | Definido |
| D-065 | Personalização controlada por igreja: logo, cor, capa, versículo, mensagem de confirmação, nomes usados e informações da igreja | Definido |
| D-066 | Até 5 contas por igreja, com nome próprio e uma principal; cada campanha aponta para uma conta | Definido |
| D-067 | Perfil técnico do Pastor de Governo é Administrador da Igreja; o Admin Master é identificado por uma marca no login que só o servidor grava | Definido |
| D-068 | Só o Admin Master cadastra ou promove um Pastor de Governo; o Pastor de Governo autoriza e suspende tesoureiros | Definido |
| D-069 | A tesouraria corrige o e-mail só enquanto o membro é convidado; depois, a troca é feita pelo próprio membro, com código no novo e-mail. Substituída pela D-097 | Definido |
| D-070 | O tesoureiro vê todos os dados cadastrais do membro, mas só o próprio membro os edita | Definido |
| D-071 | Status da igreja: ativa ou inativa; a faixa do plano é um campo livre até a cobrança ser definida | Definido |
| D-072 | A data do dízimo pode ser retroativa, nunca futura | Definido |
| D-073 | Campanha sem conta própria recebe na conta principal da igreja (é o caso da campanha permanente Oferta) | Definido |
| D-074 | O membro vê campanhas ativas e encerradas (para o histórico de ofertas); rascunhos só a tesouraria e o Pastor de Governo veem | Definido |
| D-075 | Divergência contestada: a tesouraria reabre a conferência e confirma com o valor que conferiu; o valor informado nunca muda | Definido |
| D-076 | O nome de quem confirmou fica gravado no lançamento, para o membro ver sem acesso à ficha do tesoureiro | Definido |
| D-077 | Comprovantes até 10 MB (PDF, JPG ou PNG); artes de campanha, logo e capa até 5 MB | Definido |
| D-078 | A digital é pedida ao abrir o app e ao voltar depois de 5 minutos em segundo plano; Sair da conta esquece a escolha da digital no aparelho | Definido |
| D-079 | A sessão de login é guardada criptografada no celular, com a chave no cofre do aparelho | Definido |
| D-080 | Primeiro acesso com dois aceites separados: termos e política de privacidade, e consentimento específico para o dado sensível (vínculo religioso) | Definido |
| D-081 | Dados hospedados no Brasil (Supabase, região São Paulo), por velocidade e pela LGPD | Definido |
| D-082 | Formas de devolução definidas por igreja; o padrão é Pix, cartão, dinheiro e transferência | Definido |
| D-083 | O membro retira um comprovante anexado por engano sem apagá-lo: ele some da lista do membro e fica guardado para a tesouraria como retirado pelo membro, com data. Vale enquanto o lançamento aguarda conferência ou está em divergência | Definido |
| D-084 | Exceção à RN-031: o tesoureiro que confirmou desfaz a própria confirmação em até 15 minutos, com motivo, e o lançamento volta para a fila. Não vale para o aceite de divergência pelo membro. Depois do prazo, só o Pastor de Governo reabre | Definido |
| D-085 | Convite feito por engano pode ser cancelado pelo tesoureiro ou pelo Pastor de Governo (a ficha fica Inativa). Inativar e reativar membro ativo é só do Pastor de Governo. Na reativação, quem já concluiu o cadastro volta a Ativo; quem não concluiu volta a Convidado e precisa de novo convite. Ninguém altera o próprio status. O membro inativado vê no app que o cadastro está inativo | Definido |
| D-086 | A planilha do relatório traz, logo depois do nome do membro, todos os campos de cadastro ativos da igreja (ex.: Líder), para distinguir pessoas com nomes parecidos | Definido |
| D-087 | Os totais do relatório somam só lançamentos confirmados, pelo valor conferido (a devolução presencial vale pelo informado). Aguardando conferência e em divergência aparecem à parte, pelo valor informado; cancelados ficam fora | Definido |
| D-088 | O Pastor de Governo pode reabrir uma campanha encerrada (volta a Ativa, com log). Campanha publicada não volta a rascunho | Definido |
| D-089 | A campanha encerra sozinha no dia seguinte à data de fim (horário de Brasília no MVP; fuso por igreja na Fase 2). Sem data de fim, fica aberta até o Pastor encerrar | Definido |
| D-090 | Tesoureiro suspenso volta a ser membro: perde o acesso à tesouraria na hora e continua com o próprio Cartão; as confirmações que já fez continuam valendo. Ninguém altera o próprio perfil, e dar ou tirar o perfil de Pastor de Governo é só do Admin Master | Definido |
| D-091 | A troca da conta principal acontece numa só operação, e a igreja nunca fica sem conta principal. Conta usada por campanha em rascunho ou ativa não pode ser desativada; troca-se antes a conta da campanha. A chave Pix é validada pelo tipo (CPF e CNPJ com dígito verificador) | Definido |
| D-092 | País, idioma e moeda da igreja são alterados só pelo Admin Master; o Pastor de Governo ajusta dados, contato, versículo, mensagem de confirmação e formas de devolução | Definido |
| D-093 | Campos do cadastro podem ser "Preenchidos pela tesouraria": tesoureiro e Pastor de Governo preenchem na ficha do membro; o membro vê no perfil, sem editar (LGPD, direito de acesso). O tesoureiro continua sem editar os dados que o membro informa. Trocar quem preenche um campo leva as respostas junto | Definido |
| D-094 | Relatórios de Membros (por situação) e de Participação no período (quantos devolveram dízimo e ofertaram, por campanha e por grupo), com filtro por campo do cadastro. Conta como "devolveu" quem registrou no período, mesmo sem conferência; os valores somam só o confirmado. A lista de membros ativos sem dízimo no período é só do Pastor de Governo, sem valores, como cuidado pastoral | Definido |
| D-095 | O Log da igreja tem pesquisa (pessoa, conta, campanha, campo, motivo e valor) e download em planilha com os filtros aplicados. O download fica registrado no próprio log, com quem baixou, período, quantidade e pesquisa; só o Pastor de Governo baixa, até 5.000 registros por arquivo | Definido |
| D-096 | Avisos: o banco cria um aviso para cada evento da seção 9 (tabela notificacoes, a 13ª), que aparece no app numa aba Avisos com os não lidos, além do push. A pessoa desliga só os avisos que podem ser desligados (nova campanha; novo lançamento e comprovante para a tesouraria); o resumo diário fica para depois. Push primeiro no Android; iPhone quando houver a conta Apple Developer | Definido |
| D-097 | Troca de e-mail: a tesouraria (tesoureiro ou Pastor de Governo) troca o e-mail de membros, convidados ou ativos, e de outros tesoureiros, com motivo obrigatório registrado no log. Ninguém troca o próprio e-mail; o do Pastor de Governo, e o de quem também está em outra igreja, só pelo suporte do app. A pessoa é avisada no celular e no e-mail antigo. O novo e-mail não pode já ter login. Substitui a regra anterior de que a tesouraria só corrigia o e-mail de convidado (D-069) | Definido |
| D-098 | O Admin Master vê as igrejas e o Pastor de cada uma; dados de membros, só pelo Atendimento (busca por e-mail com motivo), e cada busca fica no log da igreja. Ele não vê cartões, valores nem comprovantes | Definido |
| D-099 | Um só Pastor de Governo por igreja: definir um novo faz o anterior voltar a ser membro (ou cancela o convite, se ainda não entrou) | Definido |
| D-100 | Igreja inativa: ninguém dela entra no app (membros e tesouraria veem uma explicação); nada é apagado, e reativar devolve tudo como estava | Definido |
| D-101 | Igreja nova: o Admin Master preenche nome, país, idioma, moeda, faixa do plano e o Pastor de Governo; o Pastor recebe o convite por e-mail e completa o resto | Definido |
| D-102 | Mensagens aos membros: o Pastor de Governo e os tesoureiros enviam mensagens (ex.: versículo sobre fidelidade ou sobre semear) para todos os membros ativos ou para um grupo do cadastro, nunca filtrados pelo que a pessoa deu ou deixou de dar. Até 1 mensagem por semana por igreja, com prévia antes de enviar e registro no log. O membro pode desligar "Mensagens da igreja" no perfil. O Admin Master envia avisos da plataforma (ex.: manutenção programada) para todas as igrejas ou uma só, sem limite e sem opção de desligar. Tudo chega por push e fica na aba Avisos. No MVP a mensagem sai na hora; agendar é do pacote premium (D-103) | Definido |
| D-103 | Push programado previsto junto com o controle financeiro (seção 16), como recurso do pacote premium: lembretes de contas a pagar e de fechamento do mês, mensagem agendada aos membros e resumo periódico ao Pastor de Governo | Definido |
| D-104 | O app é para maiores de 18 anos: no primeiro acesso a pessoa declara ter 18 anos ou mais (registrado com data e versão, como os demais aceites). Menores não recebem convite e participam pelo dízimo familiar do responsável, sem login nem ficha própria. Um fluxo para adolescentes com consentimento do responsável fica para depois, se o piloto pedir | Definido |
| D-105 | Preços por faixa de membros ativos: até 100, R$ 59; 101 a 200, R$ 79; 201 a 500, R$ 129; 501 a 1.000, R$ 199; acima de 1.000, sob consulta. Plano anual com 2 meses grátis. Premium (controle financeiro e push programado, D-103) como adicional a qualquer faixa: R$ 29,99 por mês como preço de lançamento (valor cheio anunciado de R$ 39,99), com o mesmo desconto no anual (R$ 299,90) | Definido |
| D-106 | Plano Completo (base + premium) com desconto, para não ficar acima dos concorrentes com financeiro: até 100, R$ 79; 101 a 200, R$ 99; 201 a 500, R$ 149; 501 a 1.000, R$ 219; anual com 2 meses grátis. No anúncio, mostrar o anual dividido por mês e destacar sem fidelidade, sem implantação e teste de 30 dias (pesquisa de concorrência de 28/10/2026) | Definido |
| D-107 | Plano de evolução depois do MVP (seção 11): na base, QR Code do culto, importar membros por planilha, declaração anual, lembrete do próprio membro e agradecimento personalizado; no premium, entradas e saídas, push programado, fechamento mensal e prestação de contas, exportação para o contador, conciliação bancária e congregações; plano grátis para igrejas muito pequenas a decidir no lançamento comercial. Gestão completa (células, agenda, eventos) fica fora | Definido |
| D-108 | Pacote Comunidade (futuro): agenda e eventos com inscrição, células, carteirinha digital com os filhos informados pelo responsável, pedidos de oração e devocional, nessa ordem, depois do piloto rodando e do premium lançado; check-in infantil só como ideia a pensar bem depois. Preço como adicional e num plano Igreja Completa, a decidir quando existir (seção 16) | Definido |
| D-109 | Excluir a conta pelo app (Apple 5.1.1(v), Google): no Meu perfil, na hora, digitando EXCLUIR. Em todas as igrejas da pessoa, os dados pessoais são apagados (nome, e-mail, celular, respostas do cadastro, familiares, anotações da tesouraria) e a ficha vira "Membro excluído"; os lançamentos e os comprovantes ficam com a igreja, sem o nome, para a prestação de contas (LGPD, art. 16, I). O Pastor de Governo só exclui depois que o suporte definir outro. O endereço /excluir-conta serve de link da web para a Google | Definido |

## 14. Questões abertas e próximos passos

**Questões abertas**

- [x] Confirmar as decisões propostas D-051 a D-054 (confirmadas em 20/10/2026).
- [x] Quem convida membros: Tesoureiro e Pastor de Governo (D-055).
- [x] Prazo para o membro responder a uma divergência: 15 dias (D-056).
- [x] Dados visíveis ao Tesoureiro: todos os dados cadastrais (D-057).
- [x] Oferta anônima: controle da tesouraria fora do app (D-059).
- [ ] Nome definitivo do produto, verificado no INPI e nas lojas de aplicativos.
- [x] Validar a proposta de preços por faixa da seção 15 (modelo definido em D-060). Resolvido pela D-105 (28/10/2026).
- [ ] Prazo de retenção de lançamentos e comprovantes (orientação contábil e jurídica). Em pesquisa pelo desenvolvedor: a lei costuma exigir a guarda de documentos financeiros por 5 anos (prazo tributário). Sugestão a avaliar: cumprido o prazo legal, o app oferece à igreja e a cada membro um arquivo para baixar todos os seus dados e comprovantes, avisa quanto tempo eles têm para baixar e, depois disso, os comprovantes vencidos saem do servidor. Mudaria a regra de que nada se apaga só para o que já passou do prazo legal; reduz o custo de armazenamento no longo prazo (seção 15) e atende à LGPD, que pede guardar os dados só pelo tempo necessário.
- [x] Membro ativo que perdeu o acesso ao e-mail: como a tesouraria troca o e-mail, já que a D-069 só permite a correção enquanto ele é convidado. Resolvido pela D-097: a tesouraria troca o e-mail com motivo, e o do Pastor de Governo só pelo suporte (27/10/2026).
- [x] Uso do app por menores de 18 anos (LGPD, art. 14): se será permitido e com que consentimento dos responsáveis. Resolvido pela D-104: só maiores de 18 anos; menores pelo dízimo familiar do responsável (28/10/2026).
- [ ] Responsável pela plataforma, e-mail de contato de privacidade e encarregado de dados (DPO), a preencher nos termos.
- [x] Paleta de cores com contraste garantido para a personalização (seção 17): o botão secundário usa a cor da igreja sobre fundo branco, e cores claras ficariam ilegíveis. Resolvido: a igreja escolhe entre 9 cores escuras, todas com contraste de 7:1 com o branco (testado no app); uma cor clara que chegue por outro caminho volta à cor padrão.

**Próximos passos**

1. Validar esta versão 0.3 e responder as questões abertas.
2. Fluxo principal: Convite → Primeiro acesso → Cartão de Dízimo → Lançamento → Conferência → Confirmação → Notificação.
3. Mapa de telas e modelo de dados, juntos.
4. Protótipo clicável para validar com o pastor e a tesouraria da Igreja Videira.
5. Ambiente de desenvolvimento: GitHub, Supabase, Expo e Claude Code.
6. Desenvolvimento do MVP pelo ciclo central, seguido do piloto na Igreja Videira.

## 15. Modelo de cobrança e preços

Proposta: mensalidade por faixa de membros ativos, de R$ 49 a R$ 199, abaixo dos sistemas completos de gestão e com margem alta, porque o custo de servidor por igreja é quase zero. O ponto de equilíbrio fica entre 3 e 5 igrejas pagantes.

**Preços da concorrência (consultados em 28/10/2026, preço mensal)**

| Sistema | \~100 membros | \~200 | \~500 | \~1.000 | Fidelidade | O que se destaca |
| --- | --- | --- | --- | --- | --- | --- |
| [Amosh](https://amosh.com.br/) | R$ 59,90 | R$ 99,90 (até 300) | R$ 199,90 (até 800) | R$ 329,90 | não | Concorrente mais próximo: app nativo com dízimo por Pix sem taxa, push e financeiro desde o primeiro plano; grátis até 25 membros |
| [ADMmembros](https://www.admmembros.com.br/) | grátis | R$ 69 | R$ 159 | R$ 289 | não informa | Gestão completa, financeiro com DRE e conciliação, portal do membro; Pix não citado |
| [Sistema Reino](https://sistemareino.com.br/) | R$ 47,90 (até 150) | \~R$ 97,90 (até 500) | \~R$ 97,90 | \~R$ 157,90 (até 1.500) | não | Financeiro, EBD, app, comprovante de dízimo, IA no plano maior; teste de 14 dias |
| [Igreja Digital](https://igreja.digital/) | R$ 69,90 | R$ 69,90 | R$ 99,90 | R$ 99,90 | 12 meses | Membros ilimitados na sede, app personalizado, financeiro; Pix não citado |
| [Congrega](https://congrega.com.br/) | R$ 97 | R$ 197 (até 350) | R$ 397 (até 700) | R$ 697 | 12 meses | App com o nome da igreja nas lojas, 53 funcionalidades |
| [Cathedral Software](https://igrejas.membros.com.br/) | R$ 95,90 | — | — | — | — | Gestão de membros |
| [Adm Igrejas](https://adm-igrejas.com.br/index.php) | R$ 50 (até 500) | R$ 50 | R$ 50 | R$ 100 | não | Web/PWA, células, financeiro; Pix só nos planos futuros |
| [Sistema de Igreja](https://www.sistemadeigreja.com/) | R$ 79,90 (ilimitado) | R$ 79,90 | R$ 79,90 | R$ 79,90 | não informa | Financeiro, contas a pagar e receber |
| [Religio](https://www.religio.digital/) | a partir de R$ 150 | idem | idem | idem | não | Por módulos; Pix copia e cola no app, conferência de comprovantes, fechamento mensal, OFX; teste de 30 dias |
| [Gestão de Dízimo](https://www.gestaodedizimo.com.br/) | R$ 497 + R$ 1.900 de implantação | idem | idem | idem (até 5.000) | não | O único focado só em dízimo: QR Code, Pix e cartão, agradecimento automático pelo WhatsApp, campanhas |
| [inChurch](https://www.inchurch.com.br/) e [Prover](https://www.sistemaprover.com.br/) | sob consulta |  |  |  |  | App com o nome da igreja, maquininha, soluções de pagamento |

Preços de Reino (planos maiores) e Adm Igrejas acima de 500 membros são cálculos a partir do que o site mostra.

Quase todos são sistemas completos de gestão (secretaria, financeiro, células). O Meu Dízimo.app é especializado: nenhum concorrente descreve o ciclo do envelope (o membro registra, a tesouraria confere, confirma ou registra divergência, e o membro recebe o retorno), o Cartão de Dízimo com histórico confirmado, as campanhas com vídeo ou o cuidado com quem tem dificuldade com tecnologia. Na faixa de até 100 membros, o Amosh entrega mais pelo mesmo preço (inclui financeiro); da faixa de 200 para cima, o Meu Dízimo fica abaixo dos concorrentes com app nativo. O único focado só em dízimo cobra R$ 497 mais implantação, âncora que mostra o valor da especialização.

**Custo operacional estimado (preços conferidos em 28/10/2026)**

| Item | Custo | Em reais | Observação |
| --- | --- | --- | --- |
| [Supabase](https://supabase.com/pricing) Pro (banco, login, arquivos, funções) | US$ 25/mês | R$ 138/mês | Necessário desde o piloto: no plano grátis o projeto é pausado após 1 semana sem uso e não há cópia de segurança diária. Inclui 8 GB de banco, 100 GB de arquivos e 250 GB de download por mês |
| [Expo](https://expo.dev/pricing) (geração dos apps) | grátis; Starter US$ 19/mês | R$ 0 a 105/mês | O grátis tem 15 builds Android e 15 iPhone por mês |
| [Resend](https://resend.com/pricing) (convites e códigos de login) | grátis; Pro US$ 20/mês | R$ 0 a 110/mês | O grátis vai até 3.000 e-mails por mês e **100 por dia**: no lançamento numa igreja, contratar o Pro naquele mês ou convidar em lotes |
| Push (Expo e Firebase) | grátis | R$ 0 |  |
| Painel web da tesouraria | grátis | R$ 0 | Site estático em hospedagem gratuita (ex.: Cloudflare Pages) |
| Conta de desenvolvedor Apple | US$ 99/ano | R$ 545/ano | Se vencer, o app sai da App Store. Em nome de empresa, pede CNPJ e número D-U-N-S (gratuito) |
| Conta Google Play | US$ 25 uma vez | R$ 140 | Sem renovação |
| Domínio | R$ 40/ano (.com.br, Registro.br) ou US$ 14,20/ano (.app, Cloudflare) | R$ 40 a 80/ano |  |
| **Total mensal** |  | **cerca de R$ 190 a 400** | Com Apple e domínio divididos por mês; sem impostos e taxas de cobrança |

Câmbio estimado em R$ 5,50 por dólar, mais o IOF do cartão internacional. No piloto, só na Videira: Supabase Pro e domínio desde o início, Google Play ao publicar no Android, Resend Pro só no mês do lançamento, Apple ao publicar no iPhone.

O custo por igreja adicional é quase zero, e guardar todos os comprovantes (nada se apaga) é barato. Nos testes, cada comprovante teve em média 321 KB, porque o app comprime as fotos antes de enviar. Uma igreja de 500 membros com um comprovante por membro por mês gera cerca de 1,9 GB por ano; 30 igrejas de 200 membros, cerca de 23 GB por ano, dentro dos 100 GB do Supabase Pro por uns 4 anos. Depois disso, cada 100 GB a mais custa US$ 2,13 por mês (cerca de R$ 12).

**Capacidade e plano de crescimento do servidor (calculado em 28/10/2026)**

Premissa de pior caso: cada membro ativo faz 1 dízimo e 1 oferta por mês, os dois com comprovante, e nada se apaga. Medido no banco de desenvolvimento: cada lançamento ocupa cerca de 20 KB no banco (o lançamento, 4 registros no log, avisos e a linha do comprovante) e cerca de 350 KB de arquivo. Por membro e por ano: 0,5 MB de banco e 8,4 MB de comprovantes.

| Recurso do Supabase Pro | Incluído | Cabe no 1º ano | Preço do excesso |
| --- | --- | --- | --- |
| Arquivos (comprovantes, logos, artes) | 100 GB | \~12 mil membros (\~60 igrejas de 200) | US$ 0,0213 por GB por mês |
| Banco de dados | 8 GB | \~16 mil membros | US$ 0,125 por GB por mês |
| Download | 250 GB por mês | \~16 mil membros (\~15 MB por membro por mês) | US$ 0,09 por GB |
| Usuários ativos por mês | 100 mil | 100 mil membros | US$ 0,00325 por usuário |

No pior caso, 1.000 igrejas de 500 membros (500 mil membros) chegariam a cerca de US$ 3.500 a 4.000 por mês no 10º ano (42 TB de comprovantes), cerca de 15% de uma receita de R$ 129 mil por mês. Os maiores custos nessa escala são os usuários ativos e o download, não o armazenamento.

A compressão das fotos fica como está (cerca de 321 KB por comprovante): comprimir mais poderia deixar ilegível uma foto já ruim. Comprovante ilegível se resolve conferindo pelo extrato, registrando divergência com o pedido de outro comprovante, ou com o membro trocando o comprovante enquanto o lançamento está pendente.

**Plano de crescimento: cada medida quando passa a compensar.** Acompanhar o uso no painel do Supabase (Usage) a cada 3 meses.

| Ordem | Medida | Quando fazer (gatilho) | Esforço | Economia esperada |
| --- | --- | --- | --- | --- |
| 1 | Guardar o link temporário da logo e da capa, para o celular reaproveitar a imagem | Download acima de 150 GB por mês, ou cerca de 10 mil membros ativos | Pequeno (1 dia) | Download várias vezes menor; adia o pagamento de excesso de download, o primeiro a pesar depois dos arquivos |
| 2 | Log guardar só o que mudou, em vez da linha inteira antes e depois | Banco acima de 5 GB, ou cerca de 20 mil membros ativos | Médio (2 a 3 dias, com a tela do Log) | Banco 3 a 4 vezes menor; cópias de segurança mais rápidas e servidor menor por mais tempo |
| 3 | Arquivo frio: comprovantes com mais de 2 anos vão para um armazenamento mais barato (ex.: Cloudflare R2 de acesso pouco frequente ou Backblaze B2), sem apagar e continuando disponíveis | Comprovantes acima de 3 TB, ou custo dos arquivos acima de US$ 60 por mês (pior caso: cerca de 360 mil membros-ano, perto do 1º ano com 1.000 igrejas de 500) | Médio a grande (3 a 5 dias, com o caminho de abrir o comprovante antigo) | De US$ 0,021 para US$ 0,004 a 0,010 por GB; com 10 TB antigos, cerca de US$ 110 a 170 por mês a menos |
| 4 | Todos os comprovantes fora do Supabase (ex.: Cloudflare R2), com download gratuito e acesso só pelas regras do banco | Arquivos acima de 10 TB, ou arquivos mais download dos comprovantes acima de US$ 250 por mês | Grande (1 a 2 semanas; mexe na segurança dos comprovantes e migra os arquivos) | Cerca de 30% no armazenamento e zero no download dos comprovantes |

As medidas 3 e 4 respeitam a regra de que nada se apaga. Pergunta para o contador antes da medida 3: por quanto tempo a igreja precisa guardar os comprovantes (o prazo tributário costuma ser de 5 anos).

**Proposta de preços**

| Faixa (membros ativos) | Base: mensal | Base: anual | **Completo** (base + premium): mensal | Completo: anual |
| --- | --- | --- | --- | --- |
| Até 100 | R$ 59 | R$ 590 | **R$ 79** (em vez de R$ 88,99) | R$ 790 |
| 101 a 200 | R$ 79 | R$ 790 | **R$ 99** (em vez de R$ 108,99) | R$ 990 |
| 201 a 500 | R$ 129 | R$ 1.290 | **R$ 149** (em vez de R$ 158,99) | R$ 1.490 |
| 501 a 1.000 | R$ 199 | R$ 1.990 | **R$ 219** (em vez de R$ 228,99) | R$ 2.190 |
| Acima de 1.000 | sob consulta | sob consulta | sob consulta | sob consulta |
| Premium avulso (controle financeiro e push programado, D-103) | + R$ 29,99 (anunciado: R$ 39,99, por R$ 29,99 no lançamento) | + R$ 299,90 |  |  |

Anual: 2 meses grátis (10 mensalidades). O Completo só passa a ser vendido quando o premium existir.

- **Faixa de R$ 59:** a primeira faixa subiu de R$ 49 para R$ 59 porque é nela que impostos e taxas de cobrança pesam mais (D-105).
- **Premium com preço de lançamento:** valor baixo, para aumentar a margem sem pesar para a igreja. Pelo Código de Defesa do Consumidor (art. 37), um anúncio "de R$ 39,99 por R$ 29,99" exige que o preço "de" tenha existido; por isso o anúncio usa "preço de lançamento" até o valor cheio passar a ser cobrado.
- **Plano Completo (D-106):** base mais premium com cerca de R$ 10 de desconto. Até 100 membros fica a R$ 19 do Amosh, entregando a conferência que ele não tem; da faixa de 200 para cima, continua abaixo dos concorrentes com app nativo.
- **No anúncio:** mostrar o anual dividido por mês (ex.: "R$ 49 por mês no anual") e destacar sem fidelidade (contra Congrega e Igreja Digital), sem implantação (contra Gestão de Dízimo) e teste de 30 dias (o Sistema Reino dá 14).
- **Teste grátis de 30 dias**, sem cartão.
- **Piloto na Igreja Videira gratuito**, em troca de feedback e de poder citar a igreja como caso de uso.
- **Sem fidelidade:** diferencial frente a quem exige 12 meses.
- **Ponto de equilíbrio:** com ticket médio de R$ 79, cerca de 3 igrejas pagantes cobrem o custo básico (R$ 190 por mês) e 5 cobrem o custo maior (R$ 400 por mês).
- Sobre o preço ainda incidem impostos e taxas de cobrança (boleto, Pix, cartão), que variam conforme a forma de empresa e o meio de recebimento escolhido. Vale confirmar com um contador antes de lançar.

## 16. Futuro: controle financeiro da tesouraria

Uma atualização futura dará a Tesoureiro e Pastor de Governo um controle financeiro com entradas, saídas e gráficos por período, evoluindo para uma ferramenta próxima de um CRM da tesouraria. Não faz parte do MVP; o modelo de dados atual já serve de base.

A ordem de execução do premium, junto com as melhorias da base, está no plano de evolução da seção 11 (D-107).

**Núcleo pedido**

- **Entradas automáticas:** todo lançamento confirmado (dízimo ou oferta) vira entrada, sem redigitar.
- **Entradas manuais:** oferta anônima em dinheiro, doações, cantina, eventos. Assim a oferta anônima (D-059) passa a ter um lugar no sistema sem identificar ninguém.
- **Saídas:** cadastro com data, valor, categoria (aluguel, energia, missões, ação social), fornecedor, forma de pagamento e anexo da nota ou recibo.
- **Gráficos por período:** entradas e saídas por mês, saldo, dízimo contra oferta, arrecadação por campanha e por forma de pagamento.

**Sugestões de incremento**

| Recurso | O que faz | Prioridade sugerida |
| --- | --- | --- |
| Conciliação bancária | Importa o extrato do banco (OFX ou CSV) e casa cada Pix recebido com o lançamento do membro; o tesoureiro só confirma os pares | Alta: é o que mais economiza tempo na conferência |
| Saídas recorrentes | Aluguel, energia e salários lançados automaticamente todo mês | Alta |
| Fechamento mensal | Trava o mês depois de conferido; alterações posteriores só com justificativa e log | Alta |
| Prestação de contas | Relatório em PDF para conselho fiscal ou assembleia, com totais por categoria | Alta |
| Orçamento | Valor previsto por categoria contra o realizado, com alerta ao estourar | Média |
| Centros de custo | Separa ministérios, congregações ou projetos (ex.: Jovens, Construção) | Média |
| Declaração anual ao membro | Documento com o total de contribuições confirmadas do ano, gerado pelo próprio membro | Média |
| Exportação para o contador | Planilha no formato que o contador pedir, por período | Média |
| Acompanhamento pastoral | Painel com novos dizimistas, aniversariantes e membros sem lançamento há alguns meses, para cuidado pastoral | Média, com cuidado (abaixo) |
| Mensagens segmentadas | Agradecimento após confirmação, aviso de nova campanha para grupos escolhidos | Baixa |

**Push programado (pacote premium)**

Notificações que saem sozinhas, em dia e hora definidos, oferecidas como recurso do pacote premium (D-103):

- **Lembrete de contas a pagar:** avisa a tesouraria antes do vencimento de cada saída, inclusive as recorrentes (ex.: "o aluguel vence amanhã").
- **Lembrete de fechamento do mês:** avisa a tesouraria e o Pastor de Governo para conferir e fechar o mês, e quando houver lançamentos esperando conferência.
- **Mensagem agendada aos membros:** a mensagem da igreja (D-102) é escrita antes e sai no dia e na hora escolhidos, dentro do mesmo limite de 1 por semana.
- **Resumo periódico ao Pastor de Governo:** push semanal ou mensal com entradas, saídas e saldo do período, visível só à tesouraria e ao Pastor.

**Pacote Comunidade (futuro, D-108)**

Um terceiro pacote, para a vida da igreja durante a semana, no mesmo app, com o mesmo login e os mesmos dados. A base cuida do membro e do dízimo; o premium (Tesouraria), do dinheiro da igreja; a Comunidade, de manter o membro no app toda semana, com o Cartão de Dízimo a um toque. Reaproveita membros, grupos do cadastro, push, avisos e mensagens.

| Ordem | Item | Como encaixa | Cuidado |
| --- | --- | --- | --- |
| C1 | Agenda e eventos com inscrição | Evento pago vira uma campanha com Pix; lembrete por push | — |
| C2 | Células | O campo "Célula" do cadastro vira um grupo: líder, membros, presença, relatório e mensagem para a célula | O líder de célula seria um perfil novo, que vê só a célula dele, nunca valores |
| C3 | Carteirinha digital | Nome, número de dizimista, foto e QR Code; serve de crachá nos eventos. Pode trazer os filhos do membro, para ajudar no cuidado com as crianças | Foto só com autorização. Os dados dos filhos são de menores: só o pai, a mãe ou o responsável informa, com consentimento específico e em destaque (LGPD, art. 14, §1º), o mínimo necessário; informação de saúde (ex.: alergia) é dado sensível. Rever a D-104 ao construir |
| C4 | Pedidos de oração | O membro envia; só o Pastor, ou quem ele indicar, lê | Pode revelar saúde e família (dado sensível): acesso restrito e registrado no log |
| C5 | Devocional ou plano de leitura | Push diário opcional, que o membro liga e desliga | Direitos autorais: ARA, NVI, NAA e outras têm dono; texto da própria igreja ou tradução em domínio público |
| C6 | Check-in infantil (ideia a pensar, bem depois) | Entrada e saída das crianças no ministério infantil, com os dados dos filhos da carteirinha | Segurança das crianças e dados de menores: só com a D-104 revista e estudo jurídico |

Preço: adicional parecido com o premium (por volta de R$ 29,99) e um plano "Igreja Completa" com Base, Tesouraria e Comunidade juntos, com desconto; valores a decidir quando o pacote existir.

**Cuidados**

- **Acompanhamento pastoral é sensível.** Ver quem parou de contribuir pode soar como cobrança. Sugestão: visível só ao Pastor de Governo, apresentado como cuidado ("membros que talvez precisem de uma visita"), sem valores, e com base legal coberta nos termos (LGPD).
- **Plano comercial:** o controle financeiro aproxima o app dos sistemas completos de gestão, que cobram mais (seção 15). Pode ser vendido como módulo adicional ou como um plano acima do básico.
- **Saldo e saídas são dados da tesouraria:** nunca visíveis ao membro.

## 17. Personalização e outros idiomas

Cada igreja personaliza o app dentro de opções controladas, e o app nasce preparado para outros idiomas e moedas, embora seja lançado só em português.

**Personalização por igreja (configurada pelo Pastor de Governo)**

| Item | Onde aparece | Limite |
| --- | --- | --- |
| Logo | Entrada, Cartão de Dízimo, aba Igreja, painel da tesouraria | Imagem quadrada; o app ajusta o tamanho |
| Cor principal | Botões, Cartão, destaques | Escolhida numa paleta com contraste garantido |
| Foto de capa | Topo da aba Igreja | Uma imagem horizontal |
| Versículo do cartão | Cartão de Dízimo | Referência e texto curto; padrão Malaquias 3:10 |
| Mensagem de confirmação | Notificação e detalhe do lançamento confirmado | Texto curto; padrão neutro |
| Nomes usados | "Dízimo" ou "Contribuição", "Cartão de Dízimo" ou "Envelope digital", títulos dos perfis | Escolha entre opções pré-definidas (Fase 2) |
| Informações da igreja | Aba Igreja: endereço com botão de mapa, horários de culto, site e redes sociais | Campos opcionais |

Ficam de fora, para preservar a simplicidade e o suporte: temas completos, troca de fontes e layouts diferentes por igreja.

**Preparação para outros idiomas e países (desde o MVP)**

- Todos os textos do app ficam em arquivos de idioma (ex.: pt-BR), nunca escritos direto nas telas.
- Valores guardados em centavos junto com o código da moeda (BRL, USD, EUR); datas e valores exibidos no formato do idioma.
- Cada igreja tem país, moeda e idioma padrão, definidos pelo Admin Master (D-092); o membro pode trocar o idioma no perfil.
- Dados de pagamento tratados como meios de pagamento da igreja: Pix no Brasil, outros meios em outros países (D-064).

**Antes de lançar em outro país:** tradução revisada por falante nativo, termos de uso e privacidade conforme a lei local (ex.: GDPR na Europa), meios de pagamento locais e publicação nas lojas daquele país.
