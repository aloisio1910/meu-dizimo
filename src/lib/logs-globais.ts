// A-02 Logs globais: o que o suporte e a plataforma fizeram nas igrejas, em
// frases. O texto fica nos arquivos de idioma (admin.logs.acoes.<codigo>);
// aqui só qual frase usar e os valores a encaixar.

export type CodigoGlobal =
  | 'igrejaCadastrada'
  | 'igrejaInativada'
  | 'igrejaReativada'
  | 'igrejaAlterada'
  | 'pastorConvidado'
  | 'pessoaConvidada'
  | 'pastorDefinido'
  | 'pastorRetirado'
  | 'conviteCancelado'
  | 'emailTrocado'
  | 'fichaAlterada'
  | 'conviteEnviado'
  | 'campanhaCriada'
  | 'mensagemEnviada'
  | 'buscaDoSuporte'
  | 'outro';

type Registro = { acao: string; tabela: string; antes: unknown; depois: unknown };

const objeto = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
const texto = (valor: unknown) => (valor === undefined || valor === null ? '' : String(valor));

export type ValoresGlobais = {
  igreja?: string;
  nome?: string;
  email?: string;
  tabela?: string;
  texto?: string;
  quantos?: string;
};

export function descreverRegistroGlobal(r: Registro): { codigo: CodigoGlobal; valores: ValoresGlobais } {
  const antes = objeto(r.antes);
  const depois = objeto(r.depois);
  const nome = texto(depois.nome || antes.nome);

  if (r.acao === 'acesso_suporte') return { codigo: 'buscaDoSuporte', valores: { email: texto(depois.email_buscado) } };

  if (r.tabela === 'igrejas') {
    if (r.acao === 'insert') return { codigo: 'igrejaCadastrada', valores: { igreja: nome } };
    if (antes.status !== depois.status) {
      return { codigo: depois.status === 'inativa' ? 'igrejaInativada' : 'igrejaReativada', valores: { igreja: nome } };
    }
    return { codigo: 'igrejaAlterada', valores: { igreja: nome } };
  }

  if (r.tabela === 'membros') {
    if (r.acao === 'insert') {
      return { codigo: depois.perfil === 'administrador' ? 'pastorConvidado' : 'pessoaConvidada', valores: { nome } };
    }
    if (antes.perfil !== depois.perfil) {
      if (depois.perfil === 'administrador') return { codigo: 'pastorDefinido', valores: { nome } };
      if (antes.perfil === 'administrador') return { codigo: 'pastorRetirado', valores: { nome } };
    }
    if (antes.status === 'convidado' && depois.status === 'inativo')
      return { codigo: 'conviteCancelado', valores: { nome } };
    if (antes.email !== depois.email) return { codigo: 'emailTrocado', valores: { nome } };
    return { codigo: 'fichaAlterada', valores: { nome } };
  }

  if (r.tabela === 'convites' && r.acao === 'insert') return { codigo: 'conviteEnviado', valores: {} };
  // A campanha permanente Oferta nasce junto com a igreja.
  if (r.tabela === 'campanhas' && r.acao === 'insert') return { codigo: 'campanhaCriada', valores: { nome } };
  if (r.tabela === 'mensagens') {
    return { codigo: 'mensagemEnviada', valores: { texto: texto(depois.texto), quantos: texto(depois.destinatarios) } };
  }
  return { codigo: 'outro', valores: { tabela: r.tabela } };
}
