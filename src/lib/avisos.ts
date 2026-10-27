// Avisos do sino (D-096): o texto de cada tipo e a tela que abre ao tocar.
// O texto fica nos arquivos de idioma (avisos.textos.<tipo>); aqui só os
// valores a encaixar.

export type TipoDeAviso =
  | 'lancamento_confirmado'
  | 'divergencia_registrada'
  | 'lancamento_reaberto'
  | 'nova_campanha'
  | 'novo_lancamento'
  | 'novo_comprovante'
  | 'divergencia_contestada'
  | 'pix_alterado'
  | 'email_alterado';

export type Aviso = {
  id: string;
  igreja_id: string;
  tipo: TipoDeAviso;
  dados: Record<string, unknown>;
  criado_em: string;
  lida_em: string | null;
};

// Só estes a pessoa pode desligar (seção 9); os demais sempre chegam.
export const AVISOS_QUE_DESLIGAM = ['nova_campanha', 'novo_lancamento', 'novo_comprovante'] as const;
export type AvisoQueDesliga = (typeof AVISOS_QUE_DESLIGAM)[number];

// Os da tesouraria só fazem sentido para quem é da tesouraria.
export function avisosQueAPessoaPodeDesligar(ehTesouraria: boolean): AvisoQueDesliga[] {
  return ehTesouraria ? [...AVISOS_QUE_DESLIGAM] : ['nova_campanha'];
}

const texto = (valor: unknown) => (valor === undefined || valor === null ? '' : String(valor));

export function valoresDoAviso(
  aviso: Pick<Aviso, 'dados'>,
  emMoeda: (centavos: number, moeda: string) => string,
): Record<string, string> {
  const d = aviso.dados;
  const moeda = texto(d.moeda) || 'BRL';
  return {
    tipo: d.tipo === 'oferta' ? 'oferta' : 'dizimo',
    valor: typeof d.valor_centavos === 'number' ? emMoeda(d.valor_centavos, moeda) : '',
    valorInformado: typeof d.valor_informado_centavos === 'number' ? emMoeda(d.valor_informado_centavos, moeda) : '',
    membro: texto(d.membro_nome),
    quem: texto(d.confirmado_por),
    campanha: texto(d.campanha_nome),
    conta: texto(d.conta_nome),
    email: texto(d.email),
  };
}

export type DestinoDoAviso =
  | { pathname: '/lancamento/[id]'; params: { id: string } }
  | { pathname: '/campanha/[id]'; params: { id: string } }
  | { pathname: '/fila' }
  | { pathname: '/contas' }
  | { pathname: '/perfil' }
  | null;

// Tela que o toque abre. A tesouraria confere pela fila; a troca de Pix
// abre as contas para o Pastor, que é quem pode corrigir.
export function destinoDoAviso(aviso: Pick<Aviso, 'tipo' | 'dados'>, ehAdministrador: boolean): DestinoDoAviso {
  const id = (chave: string) => texto(aviso.dados[chave]);
  switch (aviso.tipo) {
    case 'lancamento_confirmado':
    case 'divergencia_registrada':
    case 'lancamento_reaberto':
      return id('lancamento_id') ? { pathname: '/lancamento/[id]', params: { id: id('lancamento_id') } } : null;
    case 'nova_campanha':
      return id('campanha_id') ? { pathname: '/campanha/[id]', params: { id: id('campanha_id') } } : null;
    case 'novo_lancamento':
    case 'novo_comprovante':
    case 'divergencia_contestada':
      return { pathname: '/fila' };
    case 'pix_alterado':
      return ehAdministrador ? { pathname: '/contas' } : null;
    case 'email_alterado':
      return { pathname: '/perfil' };
  }
}
