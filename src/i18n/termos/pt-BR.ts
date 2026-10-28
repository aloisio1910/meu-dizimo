// Termos de Uso e Política de Privacidade — RASCUNHO PARA O PILOTO.
//
// Escrito para a Igreja Videira começar a usar (Requisitos v0.3, seção 10).
// Não é parecer jurídico: antes de oferecer o app a outras igrejas, o texto
// deve ser revisado por advogado. Trechos entre colchetes [ ] precisam ser
// preenchidos pelo responsável pela plataforma.
//
// Ao mudar qualquer texto, mude também a VERSÃO: o aceite é registrado com
// ela (RN-041) e uma versão nova pede novo aceite.
//
// {{igreja}} é trocado pelo nome da igreja do membro.

export const versaoDosTermos = '0.2-piloto';

export type SecaoDosTermos = { titulo: string; paragrafos: string[] };

export const termos: { titulo: string; atualizadoEm: string; secoes: SecaoDosTermos[] } = {
  titulo: 'Termos de Uso e Política de Privacidade',
  atualizadoEm: 'Versão 0.2 (piloto), outubro de 2026',
  secoes: [
    {
      titulo: '1. O que é o Meu Dízimo',
      paragrafos: [
        'O Meu Dízimo é um aplicativo que substitui o envelope de dízimo por um Cartão de Dízimo digital. Você registra os dízimos e as ofertas que devolveu, a tesouraria da {{igreja}} confere e confirma, e você acompanha tudo pelo aplicativo.',
        'O aplicativo não movimenta dinheiro. O pagamento acontece no aplicativo do seu banco (por exemplo, pelo Pix). O Meu Dízimo não tem acesso à sua conta bancária e não confirma sozinho que o valor foi recebido: essa confirmação é feita pela tesouraria da igreja.',
      ],
    },
    {
      titulo: '2. Quem cuida dos seus dados',
      paragrafos: [
        'A {{igreja}} é a controladora dos seus dados pessoais, ou seja, é ela quem decide como eles são usados dentro das finalidades descritas aqui (Lei Geral de Proteção de Dados, Lei nº 13.709/2018, a LGPD).',
        'O Meu Dízimo, mantido por [NOME DO RESPONSÁVEL OU EMPRESA, CPF/CNPJ], é o operador: guarda e processa os dados em nome da igreja, seguindo as instruções dela e esta política.',
        'Para falar sobre seus dados, procure a tesouraria da sua igreja ou escreva para [E-MAIL DE CONTATO DE PRIVACIDADE]. Encarregado pelo tratamento de dados (DPO): [NOME E CONTATO].',
      ],
    },
    {
      titulo: '3. Dado sensível: seu vínculo com a igreja',
      paragrafos: [
        'Fazer parte de uma igreja revela convicção religiosa, que a LGPD considera dado pessoal sensível (art. 5º, II). Por isso, pedimos o seu consentimento específico e destacado para tratar esse dado (art. 11, I), separado do aceite destes termos.',
        'Esse dado é usado somente para que você tenha o seu Cartão de Dízimo na {{igreja}}. Ele nunca é vendido, nunca é usado para publicidade e nunca é compartilhado com outras igrejas.',
      ],
    },
    {
      titulo: '4. Quais dados guardamos',
      paragrafos: [
        'Cadastro: nome, e-mail, celular, número de dizimista, os campos que a sua igreja pede no cadastro (por exemplo, líder ou rede) e, se o seu dízimo for familiar, os nomes dos familiares que você informar.',
        'Contribuições: valor, data, forma de devolução, campanha (no caso de oferta), situação da conferência e as mensagens trocadas com a tesouraria sobre divergências.',
        'Comprovantes: os arquivos que você anexar. Eles podem conter dados bancários, como nome do banco, agência e parte da conta.',
        'Dados técnicos: o identificador do seu aparelho para enviar notificações, o registro de quando você aceitou estes termos e o registro das ações feitas no aplicativo (quem fez, o quê e quando), que existe para a segurança e a transparência da tesouraria.',
        'Não guardamos senha: a entrada é feita por um código enviado ao seu e-mail e, se você ativar, pela digital ou pelo reconhecimento de rosto do seu celular. A digital e o rosto ficam somente no seu aparelho; o Meu Dízimo não tem acesso a eles.',
      ],
    },
    {
      titulo: '5. Para que usamos os dados',
      paragrafos: [
        'Para registrar seus dízimos e ofertas e mostrá-los no seu Cartão de Dízimo.',
        'Para que a tesouraria confira e confirme cada lançamento e fale com você quando houver diferença de valor.',
        'Para enviar avisos sobre os seus lançamentos e sobre as campanhas da igreja. Você pode desligar os avisos de campanhas no seu perfil.',
        'Para que a igreja mantenha os registros de que precisa na prestação de contas e na contabilidade.',
        'Para proteger o aplicativo contra uso indevido e manter o histórico das ações (auditoria).',
      ],
    },
    {
      titulo: '6. Quem pode ver os seus dados',
      paragrafos: [
        'Você vê os seus próprios dados e lançamentos.',
        'A tesouraria e o Pastor de Governo da {{igreja}} veem os seus dados de cadastro, os seus lançamentos e os seus comprovantes, porque precisam deles para conferir as contribuições.',
        'Outros membros nunca veem os seus dados, e nenhuma outra igreja tem acesso a eles. Essa separação é garantida pelo próprio banco de dados, não apenas pelas telas do aplicativo.',
        'A equipe do Meu Dízimo só acessa dados de uma igreja quando necessário para suporte ou manutenção, e esse acesso fica registrado.',
      ],
    },
    {
      titulo: '7. Serviços que nos ajudam',
      paragrafos: [
        'Para funcionar, o Meu Dízimo usa empresas que prestam serviços a ele: hospedagem do banco de dados e dos arquivos (Supabase, com servidores em São Paulo), envio de e-mails e envio de notificações (Expo, Google e Apple).',
        'O envio de notificações pode passar por servidores fora do Brasil. Nesse caso, vai apenas o identificador do aparelho e o texto do aviso, com as garantias previstas na LGPD para transferência internacional (art. 33).',
      ],
    },
    {
      titulo: '8. Por quanto tempo guardamos',
      paragrafos: [
        'Os dados de cadastro ficam guardados enquanto você for membro da igreja no aplicativo.',
        'Os lançamentos e comprovantes ficam guardados pelo prazo de que a igreja precisa para cumprir obrigações contábeis e legais: [PRAZO A DEFINIR COM A ORIENTAÇÃO CONTÁBIL E JURÍDICA].',
        'Nenhum lançamento é apagado: quando algo muda, a mudança fica registrada no histórico.',
      ],
    },
    {
      titulo: '9. Seus direitos',
      paragrafos: [
        'Você pode, a qualquer momento: confirmar se tratamos os seus dados e acessá-los; corrigir dados incompletos ou errados; pedir uma cópia; saber com quem eles são compartilhados; e revogar o seu consentimento (art. 18 da LGPD).',
        'Você também pode pedir a exclusão. Nesse caso, os seus dados pessoais são anonimizados, isto é, deixam de identificar você, e os lançamentos continuam existindo sem o seu nome, porque fazem parte da contabilidade da igreja.',
        'Se revogar o consentimento ou pedir a exclusão, você deixa de usar o aplicativo nesta igreja. A devolução do dízimo continua possível pelos meios tradicionais da igreja.',
        'Para exercer esses direitos, fale com a tesouraria da sua igreja ou escreva para [E-MAIL DE CONTATO DE PRIVACIDADE]. Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).',
      ],
    },
    {
      titulo: '10. Segurança',
      paragrafos: [
        'Os dados trafegam e ficam guardados de forma criptografada. Cada pessoa só acessa o que o seu perfil permite, e as ações feitas no aplicativo ficam registradas.',
        'Os comprovantes ficam numa área privada e só são abertos por links temporários, que expiram em poucos minutos.',
        'Cuide do acesso ao seu e-mail e ao seu celular: quem tiver acesso a eles pode entrar no seu Cartão de Dízimo. Nunca passe o código de 6 números para outra pessoa.',
      ],
    },
    {
      titulo: '11. Suas responsabilidades',
      paragrafos: [
        'Informe dados verdadeiros e registre apenas as contribuições que você realmente fez.',
        'Confira os dados de pagamento antes de pagar. Os dados bancários e a chave Pix exibidos são cadastrados pela {{igreja}}, que é responsável por eles. Qualquer alteração desses dados é registrada e avisada à tesouraria.',
      ],
    },
    {
      titulo: '12. Idade mínima',
      paragrafos: [
        'O Meu Dízimo é para maiores de 18 anos. Ao concluir o cadastro, você declara ter 18 anos ou mais.',
        'Menores de 18 anos não recebem convite nem têm cadastro próprio no aplicativo. Um filho ou dependente que contribui pode ser incluído no dízimo familiar do pai, da mãe ou do responsável, que informa o nome dele e responde por essa informação.',
      ],
    },
    {
      titulo: '13. Mudanças nestes termos',
      paragrafos: [
        'Se estes termos mudarem, o aplicativo mostrará a nova versão e pedirá o seu aceite antes de continuar.',
      ],
    },
  ],
};
