// Texto do push de cada aviso (D-096). É o mesmo da aba Avisos do app: o
// teste __tests__/texto-do-push-test.ts compara com src/i18n/locales/pt-BR.json,
// para os dois não se separarem. Sem dependências: roda no Deno (Edge
// Function) e no Jest.

// Oferta é feminino: a frase "<tipo>_oferta" substitui a do dízimo quando
// existe (é a mesma regra de "context" do i18next, usada no app).
export const TEXTOS: Record<string, string> = {
  lancamento_confirmado: '{{quem}} confirmou o seu dízimo de {{valor}}.',
  lancamento_confirmado_oferta: '{{quem}} confirmou a sua oferta de {{valor}}.',
  divergencia_registrada:
    'A tesouraria conferiu o seu dízimo de {{valorInformado}} e encontrou {{valor}}. Toque para ver e responder.',
  divergencia_registrada_oferta:
    'A tesouraria conferiu a sua oferta de {{valorInformado}} e encontrou {{valor}}. Toque para ver e responder.',
  lancamento_reaberto: 'Seu dízimo de {{valor}} voltou para conferência.',
  lancamento_reaberto_oferta: 'Sua oferta de {{valor}} voltou para conferência.',
  nova_campanha: 'Nova campanha de oferta: {{campanha}}.',
  novo_lancamento: '{{membro}} registrou dízimo de {{valor}}.',
  novo_lancamento_oferta: '{{membro}} registrou oferta de {{valor}}.',
  novo_comprovante: '{{membro}} anexou comprovante ao dízimo de {{valor}}.',
  novo_comprovante_oferta: '{{membro}} anexou comprovante à oferta de {{valor}}.',
  divergencia_contestada: '{{membro}} contestou a divergência do dízimo de {{valor}}.',
  divergencia_contestada_oferta: '{{membro}} contestou a divergência da oferta de {{valor}}.',
  pix_alterado:
    'A chave Pix da conta {{conta}} foi alterada. Se não foi você nem alguém da tesouraria, avise o {{titulo}} agora.',
  email_alterado:
    'O seu e-mail de entrada no app foi trocado pela tesouraria para {{email}}. Se você não pediu, fale com o {{titulo}}.',
  // D-102: o texto é o que a igreja (ou o suporte) escreveu.
  mensagem_da_igreja: '{{texto}}',
  aviso_da_plataforma: '{{texto}}',
};

// Título do push: o nome da igreja; o aviso da plataforma vem do próprio app.
export function tituloDoPush(tipo: string, igrejaNome: string): string {
  return tipo === 'aviso_da_plataforma' ? 'Meu Dízimo' : igrejaNome;
}

export const A_TESOURARIA = 'A tesouraria';

const texto = (valor: unknown) => (valor === undefined || valor === null ? '' : String(valor));

function emMoeda(centavos: unknown, moeda: string, idioma: string): string {
  return typeof centavos === 'number'
    ? new Intl.NumberFormat(idioma, { style: 'currency', currency: moeda }).format(centavos / 100)
    : '';
}

export function textoDoPush(
  aviso: { tipo: string; dados: Record<string, unknown> },
  igreja: { titulo_administrador: string | null; idioma: string | null },
): string {
  const d = aviso.dados;
  const modelo = (d.tipo === 'oferta' && TEXTOS[`${aviso.tipo}_oferta`]) || TEXTOS[aviso.tipo];
  if (!modelo) return '';
  const idioma = igreja.idioma ?? 'pt-BR';
  const moeda = texto(d.moeda) || 'BRL';
  const valores: Record<string, string> = {
    valor: emMoeda(d.valor_centavos, moeda, idioma),
    valorInformado: emMoeda(d.valor_informado_centavos, moeda, idioma),
    membro: texto(d.membro_nome),
    quem: texto(d.confirmado_por) || A_TESOURARIA,
    campanha: texto(d.campanha_nome),
    conta: texto(d.conta_nome),
    email: texto(d.email),
    texto: texto(d.texto),
    titulo: texto(igreja.titulo_administrador),
  };
  return modelo.replace(/\{\{(\w+)\}\}/g, (_, chave: string) => valores[chave] ?? '');
}
