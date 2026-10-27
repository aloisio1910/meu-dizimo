// Tradução do log técnico (tabela auditoria) para frases que o Pastor de
// Governo entende (P-04). O banco grava tudo; aqui só se escolhe o que
// mostrar e como dizer.

export type RegistroDoLog = {
  id: number;
  usuario_id: string | null;
  perfil: string | null;
  acao: 'insert' | 'update' | 'delete' | string;
  tabela: string;
  registro_id: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  motivo: string | null;
  criado_em: string;
};

export type Assunto = 'lancamentos' | 'membros' | 'contas' | 'campanhas' | 'igreja' | 'comprovantes' | 'downloads';

// Tabelas de cada assunto do filtro.
export const TABELAS_DO_ASSUNTO: Record<Assunto, string[]> = {
  lancamentos: ['lancamentos'],
  membros: ['membros', 'convites'],
  contas: ['contas'],
  campanhas: ['campanhas', 'campanha_midias'],
  igreja: ['igrejas', 'campos_cadastro'],
  comprovantes: ['comprovantes'],
  // Quem baixou o próprio log (D-095).
  downloads: ['auditoria'],
};

// Campos de controle interno: mudar só eles não é uma ação de ninguém (ex.:
// o aviso de "ainda conferindo" a cada 2 minutos).
const CAMPOS_TECNICOS = new Set([
  'atualizado_em',
  'criado_em',
  'em_conferencia_desde',
  'proximo_numero_dizimista',
  'registrado_em',
]);

export function camposAlterados(registro: Pick<RegistroDoLog, 'antes' | 'depois'>): string[] {
  const antes = registro.antes ?? {};
  const depois = registro.depois ?? {};
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  return [...chaves].filter(
    (chave) => !CAMPOS_TECNICOS.has(chave) && JSON.stringify(antes[chave]) !== JSON.stringify(depois[chave]),
  );
}

// Atualização que só mexeu em controles internos: fica no banco, não na tela.
export function ehSoTecnico(registro: RegistroDoLog): boolean {
  return registro.acao === 'update' && camposAlterados(registro).length === 0;
}

// Cada código tem a sua frase em log.acoes (o TypeScript confere).
export type CodigoDaAcao =
  | 'anotacoesDaTesouraria'
  | 'arteEnviada'
  | 'arteRetirada'
  | 'cadastroAtualizado'
  | 'cadastroConcluido'
  | 'campanhaCriada'
  | 'campanhaEditada'
  | 'campanhaEncerrada'
  | 'campanhaEncerradaSozinha'
  | 'campanhaPublicada'
  | 'campanhaReaberta'
  | 'campoCriado'
  | 'campoEditado'
  | 'chavePixAlterada'
  | 'comprovanteEnviado'
  | 'comprovanteRetirado'
  | 'conferenciaAberta'
  | 'conferenciaLiberada'
  | 'contaCriada'
  | 'contaDeixouPrincipal'
  | 'contaDesativada'
  | 'contaEditada'
  | 'contaPrincipal'
  | 'contaReativada'
  | 'conviteAceito'
  | 'conviteCancelado'
  | 'conviteEnviado'
  | 'divergenciaAceita'
  | 'divergenciaContestada'
  | 'divergenciaRegistrada'
  | 'emailTrocado'
  | 'igrejaAtualizada'
  | 'lancamentoCancelado'
  | 'lancamentoConfirmado'
  | 'lancamentoEditado'
  | 'lancamentoPresencial'
  | 'lancamentoReaberto'
  | 'lancamentoRegistrado'
  | 'logBaixado'
  | 'membroConvidado'
  | 'membroInativado'
  | 'membroReativado'
  | 'perfilAlterado'
  | 'primeiroAcesso'
  | 'registroAlterado'
  | 'tesoureiroAutorizado'
  | 'tesoureiroConvidado'
  | 'tesoureiroSuspenso';

export type Descricao = {
  // Código do texto em log.acoes.<codigo>, com os valores a encaixar.
  codigo: CodigoDaAcao;
  valores: Record<string, string>;
};

const texto = (valor: unknown) => (valor === undefined || valor === null ? '' : String(valor));

type Contexto = {
  nomeDoMembro: (membroId: string) => string;
  valorEmMoeda: (centavos: number) => string;
};

function descreverLancamento(r: RegistroDoLog, ctx: Contexto): Descricao {
  const atual = r.depois ?? r.antes ?? {};
  const valores = {
    membro: ctx.nomeDoMembro(texto(atual.membro_id)),
    tipo: atual.tipo === 'oferta' ? 'oferta' : 'dizimo',
    valor: ctx.valorEmMoeda(Number(atual.valor_informado_centavos ?? 0)),
  };
  if (r.acao === 'insert') {
    return { codigo: atual.registrado_pela_tesouraria ? 'lancamentoPresencial' : 'lancamentoRegistrado', valores };
  }
  const de = r.antes?.status;
  const para = r.depois?.status;
  if (de !== para) {
    if (para === 'em_conferencia') return { codigo: 'conferenciaAberta', valores };
    if (para === 'confirmado' && de === 'divergencia') return { codigo: 'divergenciaAceita', valores };
    if (para === 'confirmado') return { codigo: 'lancamentoConfirmado', valores };
    if (para === 'divergencia') return { codigo: 'divergenciaRegistrada', valores };
    if (para === 'cancelado') return { codigo: 'lancamentoCancelado', valores };
    if (de === 'confirmado' && para === 'aguardando') return { codigo: 'lancamentoReaberto', valores };
    if (de === 'em_conferencia' && para === 'aguardando') return { codigo: 'conferenciaLiberada', valores };
  }
  if (r.antes?.resposta_membro !== r.depois?.resposta_membro && r.depois?.resposta_membro === 'contestada') {
    return { codigo: 'divergenciaContestada', valores };
  }
  return { codigo: 'lancamentoEditado', valores };
}

function descreverMembro(r: RegistroDoLog): Descricao {
  const atual = r.depois ?? r.antes ?? {};
  const valores = { membro: texto(atual.nome) };
  if (r.acao === 'insert')
    return { codigo: atual.perfil === 'tesoureiro' ? 'tesoureiroConvidado' : 'membroConvidado', valores };
  const antes = r.antes ?? {};
  const depois = r.depois ?? {};
  if (antes.status !== depois.status) {
    if (antes.status === 'convidado' && depois.status === 'ativo') return { codigo: 'cadastroConcluido', valores };
    if (antes.status === 'convidado' && depois.status === 'inativo') return { codigo: 'conviteCancelado', valores };
    if (depois.status === 'inativo') return { codigo: 'membroInativado', valores };
    return { codigo: 'membroReativado', valores };
  }
  if (antes.perfil !== depois.perfil) {
    if (depois.perfil === 'tesoureiro') return { codigo: 'tesoureiroAutorizado', valores };
    if (antes.perfil === 'tesoureiro' && depois.perfil === 'membro') return { codigo: 'tesoureiroSuspenso', valores };
    return { codigo: 'perfilAlterado', valores };
  }
  if (antes.email !== depois.email) return { codigo: 'emailTrocado', valores };
  if (JSON.stringify(antes.campos_internos) !== JSON.stringify(depois.campos_internos)) {
    return { codigo: 'anotacoesDaTesouraria', valores };
  }
  if (antes.usuario_id !== depois.usuario_id) return { codigo: 'primeiroAcesso', valores };
  return { codigo: 'cadastroAtualizado', valores };
}

function descreverConta(r: RegistroDoLog): Descricao {
  const atual = r.depois ?? r.antes ?? {};
  const valores = { conta: texto(atual.nome) };
  if (r.acao === 'insert') return { codigo: 'contaCriada', valores };
  const antes = r.antes ?? {};
  const depois = r.depois ?? {};
  // Troca de chave Pix é a mudança mais sensível (RN-040): vem primeiro.
  if (antes.chave_pix !== depois.chave_pix || antes.tipo_chave_pix !== depois.tipo_chave_pix) {
    return { codigo: 'chavePixAlterada', valores };
  }
  if (antes.principal !== depois.principal)
    return { codigo: depois.principal ? 'contaPrincipal' : 'contaDeixouPrincipal', valores };
  if (antes.ativa !== depois.ativa) return { codigo: depois.ativa ? 'contaReativada' : 'contaDesativada', valores };
  return { codigo: 'contaEditada', valores };
}

function descreverCampanha(r: RegistroDoLog): Descricao {
  const atual = r.depois ?? r.antes ?? {};
  const valores = { campanha: texto(atual.nome) };
  if (r.acao === 'insert') return { codigo: 'campanhaCriada', valores };
  const de = r.antes?.status;
  const para = r.depois?.status;
  if (de !== para) {
    if (para === 'ativa' && de === 'rascunho') return { codigo: 'campanhaPublicada', valores };
    if (para === 'ativa') return { codigo: 'campanhaReaberta', valores };
    if (para === 'encerrada')
      return { codigo: r.usuario_id ? 'campanhaEncerrada' : 'campanhaEncerradaSozinha', valores };
  }
  return { codigo: 'campanhaEditada', valores };
}

export function descreverRegistro(r: RegistroDoLog, ctx: Contexto): Descricao {
  const atual = r.depois ?? r.antes ?? {};
  switch (r.tabela) {
    case 'lancamentos':
      return descreverLancamento(r, ctx);
    case 'membros':
      return descreverMembro(r);
    case 'convites':
      return {
        codigo: r.acao === 'insert' ? 'conviteEnviado' : 'conviteAceito',
        valores: { membro: ctx.nomeDoMembro(texto(atual.membro_id)) },
      };
    case 'contas':
      return descreverConta(r);
    case 'campanhas':
      return descreverCampanha(r);
    case 'campanha_midias':
      return { codigo: r.acao === 'insert' ? 'arteEnviada' : 'arteRetirada', valores: {} };
    case 'comprovantes':
      return { codigo: r.acao === 'insert' ? 'comprovanteEnviado' : 'comprovanteRetirado', valores: {} };
    case 'campos_cadastro':
      return { codigo: r.acao === 'insert' ? 'campoCriado' : 'campoEditado', valores: { campo: texto(atual.rotulo) } };
    case 'igrejas':
      return { codigo: 'igrejaAtualizada', valores: {} };
    case 'auditoria':
      return { codigo: 'logBaixado', valores: periodoDoDownload(atual) };
    default:
      return { codigo: 'registroAlterado', valores: { tabela: r.tabela } };
  }
}

// Início e fim do período em horário do Brasil, para filtrar criado_em
// (momento em UTC). "Até 31/10" inclui o dia 31 inteiro.
export function limitesDoPeriodo(periodo: { de: string; ate: string }): { desde: string; antesDe: string } {
  const fim = new Date(`${periodo.ate}T00:00:00-03:00`);
  fim.setUTCDate(fim.getUTCDate() + 1);
  return { desde: new Date(`${periodo.de}T00:00:00-03:00`).toISOString(), antesDe: fim.toISOString() };
}

// Campos com nome legível em "Ver o que mudou" (log.campos.<campo>). Os
// outros aparecem com o nome técnico.
export const CAMPOS_COM_NOME = [
  'status',
  'valor_informado_centavos',
  'valor_conferido_centavos',
  'forma',
  'data_contribuicao',
  'perfil',
  'email',
  'nome',
  'celular',
  'tipo_dizimo',
  'familiares',
  'campos_extras',
  'campos_internos',
  'chave_pix',
  'tipo_chave_pix',
  'principal',
  'ativa',
  'ativo',
  'banco',
  'agencia',
  'numero_conta',
  'nome_recebedor',
  'cidade',
  'cor_principal',
  'logo_path',
  'capa_path',
  'endereco',
  'horarios_culto',
  'site',
  'redes_sociais',
  'whatsapp_contato',
  'versiculo_referencia',
  'versiculo_texto',
  'mensagem_confirmacao',
  'formas_devolucao',
  'descricao',
  'objetivo',
  'inicio',
  'fim',
  'link_video',
  'conta_id',
  'campanha_id',
  'observacao_tesouraria',
  'resposta_membro',
  'mensagem_membro',
  'motivo_cancelamento',
  'em_conferencia_por',
  'confirmado_por_nome',
  'confirmado_em',
  'rotulo',
  'opcoes',
  'obrigatorio',
  'ordem',
  'preenchido_por',
  'aceito_em',
] as const;

export type CampoComNome = (typeof CAMPOS_COM_NOME)[number];

export function temNome(campo: string): campo is CampoComNome {
  return (CAMPOS_COM_NOME as readonly string[]).includes(campo);
}

// Valor legível: dinheiro formatado, sim/não, datas AAAA-MM-DD em DD/MM/AAAA
// e identificadores internos escondidos (não dizem nada a quem lê).
export function valorLegivel(
  campo: string,
  valor: unknown,
  textos: { sim: string; nao: string; alterado: string; emMoeda: (centavos: number) => string },
): string {
  if (valor === undefined || valor === null || valor === '') return '';
  if (campo.endsWith('_centavos') && typeof valor === 'number') return textos.emMoeda(valor);
  if (typeof valor === 'boolean') return valor ? textos.sim : textos.nao;
  if (campo.endsWith('_id') || campo.endsWith('_por') || campo.endsWith('_path')) return textos.alterado;
  if (Array.isArray(valor)) return valor.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  if (typeof valor === 'object') {
    return Object.entries(valor as Record<string, unknown>)
      .map(([chave, v]) => `${chave}: ${String(v)}`)
      .join('; ');
  }
  const texto = String(valor);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto.split('-').reverse().join('/') : texto;
}

export type Mudanca = {
  campo: string; // nome técnico (para valorLegivel)
  rotuloDaIgreja?: string; // nome dado pela igreja, nos campos do cadastro
  de: unknown;
  para: unknown;
};

// Campos que guardam as respostas do cadastro: em vez de mostrar o objeto
// inteiro ({"celula": "José"}), cada resposta aparece com o nome que a igreja
// deu ao campo ("Célula: (vazio) → José").
const CAMPOS_COM_RESPOSTAS = new Set(['campos_extras', 'campos_internos']);

export function mudancasDoRegistro(
  registro: Pick<RegistroDoLog, 'antes' | 'depois'>,
  rotulosDosCampos: Record<string, string>,
): Mudanca[] {
  const objeto = (valor: unknown) =>
    valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
  return camposAlterados(registro).flatMap((campo) => {
    const de = registro.antes?.[campo];
    const para = registro.depois?.[campo];
    if (!CAMPOS_COM_RESPOSTAS.has(campo)) return [{ campo, de, para }];
    const antes = objeto(de);
    const depois = objeto(para);
    return [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
      .filter((chave) => JSON.stringify(antes[chave]) !== JSON.stringify(depois[chave]))
      .map((chave) => ({
        campo: chave,
        rotuloDaIgreja: rotulosDosCampos[chave] ?? chave,
        de: antes[chave],
        para: depois[chave],
      }));
  });
}

// Dia no horário de Brasília (DD/MM/AAAA) de um momento ISO.
function diaNoBrasil(momento: unknown): string {
  const data = new Date(String(momento));
  if (Number.isNaN(data.getTime())) return '';
  const noBrasil = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  return noBrasil.toISOString().slice(0, 10).split('-').reverse().join('/');
}

// O download guarda o período como [desde, antes_de): o último dia é o
// anterior a antes_de.
function periodoDoDownload(depois: Record<string, unknown>): Record<string, string> {
  const antesDe = new Date(String(depois.antes_de));
  const ultimoDia = Number.isNaN(antesDe.getTime()) ? '' : new Date(antesDe.getTime() - 1).toISOString();
  return { de: diaNoBrasil(depois.desde), ate: diaNoBrasil(ultimoDia), quantidade: String(depois.quantidade ?? '') };
}

// Até 5.000 registros por arquivo (D-095): mais que isso pede um período menor.
export const LIMITE_DO_DOWNLOAD = 5000;

export type LinhaDaPlanilhaDoLog = (string | number)[];

// Linhas da planilha do log: as mesmas frases da tela, com quem fez, perfil,
// motivo e o que mudou numa coluna só.
export function linhasDaPlanilhaDoLog(
  registros: RegistroDoLog[],
  textos: {
    colunas: string[]; // Data, Hora, Quem fez, Perfil, O que aconteceu, Motivo, O que mudou
    dataHora: (momento: string) => { dia: string; hora: string };
    quemFez: (r: RegistroDoLog) => string;
    perfil: (r: RegistroDoLog) => string;
    frase: (r: RegistroDoLog) => string;
    mudancas: (r: RegistroDoLog) => string[];
  },
): LinhaDaPlanilhaDoLog[] {
  return [
    textos.colunas,
    ...registros.map((r) => {
      const { dia, hora } = textos.dataHora(r.criado_em);
      return [
        dia,
        hora,
        textos.quemFez(r),
        textos.perfil(r),
        textos.frase(r),
        r.motivo ?? '',
        textos.mudancas(r).join('; '),
      ];
    }),
  ];
}
