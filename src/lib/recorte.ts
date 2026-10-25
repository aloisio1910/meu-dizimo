// Recorte de imagem dentro de uma moldura, como a foto de perfil do
// WhatsApp (logo e capa da igreja). Contas puras, testáveis; a tela só
// desenha e a biblioteca de imagens só corta.

export type Tamanho = { largura: number; altura: number };
export type Posicao = { x: number; y: number }; // canto da imagem dentro da moldura (0 ou negativo)

export const ZOOM_MAXIMO = 6;

// Escala em que a imagem cobre a moldura inteira, sem sobrar espaço vazio.
export function escalaParaCobrir(imagem: Tamanho, moldura: Tamanho): number {
  return Math.max(moldura.largura / imagem.largura, moldura.altura / imagem.altura);
}

// A imagem nunca deixa a moldura com espaço vazio: o canto fica entre
// (moldura − imagem) e 0, em cada eixo.
export function limitarPosicao(posicao: Posicao, imagem: Tamanho, escala: number, moldura: Tamanho): Posicao {
  const limitar = (valor: number, minimo: number) => Math.min(0, Math.max(minimo, valor));
  return {
    x: limitar(posicao.x, moldura.largura - imagem.largura * escala),
    y: limitar(posicao.y, moldura.altura - imagem.altura * escala),
  };
}

export function posicaoCentralizada(imagem: Tamanho, escala: number, moldura: Tamanho): Posicao {
  return {
    x: (moldura.largura - imagem.largura * escala) / 2,
    y: (moldura.altura - imagem.altura * escala) / 2,
  };
}

// Novo zoom mantendo o centro da moldura no mesmo ponto da imagem.
export function aplicarZoom(
  posicao: Posicao,
  escalaAtual: number,
  escalaNova: number,
  imagem: Tamanho,
  moldura: Tamanho,
): Posicao {
  const centroX = moldura.largura / 2;
  const centroY = moldura.altura / 2;
  const fator = escalaNova / escalaAtual;
  return limitarPosicao(
    { x: centroX - (centroX - posicao.x) * fator, y: centroY - (centroY - posicao.y) * fator },
    imagem,
    escalaNova,
    moldura,
  );
}

// Área da imagem original (em pixels) que está dentro da moldura.
export function retanguloDoRecorte(posicao: Posicao, escala: number, imagem: Tamanho, moldura: Tamanho) {
  const largura = Math.min(imagem.largura, Math.round(moldura.largura / escala));
  const altura = Math.min(imagem.altura, Math.round(moldura.altura / escala));
  return {
    originX: Math.max(0, Math.min(imagem.largura - largura, Math.round(-posicao.x / escala))),
    originY: Math.max(0, Math.min(imagem.altura - altura, Math.round(-posicao.y / escala))),
    width: largura,
    height: altura,
  };
}
