import { describe, expect, it } from '@jest/globals';

import { aplicarZoom, escalaParaCobrir, limitarPosicao, posicaoCentralizada, retanguloDoRecorte } from '../recorte';

const quadrada = { largura: 300, altura: 300 };
const deitada = { largura: 320, altura: 180 }; // moldura 16:9

describe('escalaParaCobrir', () => {
  it('imagem em pé numa moldura quadrada: a largura manda', () => {
    expect(escalaParaCobrir({ largura: 1000, altura: 2000 }, quadrada)).toBeCloseTo(0.3);
  });

  it('foto quadrada numa moldura 16:9: a largura manda e sobra altura para cortar', () => {
    expect(escalaParaCobrir({ largura: 900, altura: 900 }, deitada)).toBeCloseTo(320 / 900);
  });
});

describe('limitarPosicao', () => {
  const imagem = { largura: 1000, altura: 1000 };

  it('não deixa espaço vazio à esquerda nem em cima', () => {
    expect(limitarPosicao({ x: 50, y: 20 }, imagem, 0.6, quadrada)).toEqual({ x: 0, y: 0 });
  });

  it('não deixa espaço vazio à direita nem embaixo', () => {
    // imagem desenhada com 600 px numa moldura de 300: o canto vai até −300.
    expect(limitarPosicao({ x: -900, y: -400 }, imagem, 0.6, quadrada)).toEqual({ x: -300, y: -300 });
  });
});

describe('aplicarZoom', () => {
  it('aproxima mantendo o centro da moldura no mesmo ponto', () => {
    const imagem = { largura: 1000, altura: 1000 };
    const escala = escalaParaCobrir(imagem, quadrada); // 0,3: imagem com 300 px, posição 0
    const posicao = aplicarZoom({ x: 0, y: 0 }, escala, escala * 2, imagem, quadrada);
    // Com 600 px, o centro da imagem (300) fica no centro da moldura (150).
    expect(posicao.x).toBeCloseTo(-150);
    expect(posicao.y).toBeCloseTo(-150);
  });
});

describe('retanguloDoRecorte', () => {
  it('sem zoom, pega a imagem inteira na moldura quadrada', () => {
    const imagem = { largura: 2000, altura: 2000 };
    const escala = escalaParaCobrir(imagem, quadrada);
    expect(retanguloDoRecorte({ x: 0, y: 0 }, escala, imagem, quadrada)).toEqual({
      originX: 0,
      originY: 0,
      width: 2000,
      height: 2000,
    });
  });

  it('logo com muita borda vazia: aproximado 4 vezes no centro, pega só o meio', () => {
    const imagem = { largura: 2000, altura: 2000 };
    const escala = escalaParaCobrir(imagem, quadrada) * 4;
    const posicao = posicaoCentralizada(imagem, escala, quadrada);
    expect(retanguloDoRecorte(posicao, escala, imagem, quadrada)).toEqual({
      originX: 750,
      originY: 750,
      width: 500,
      height: 500,
    });
  });

  it('capa: foto quadrada vira faixa 16:9, do jeito que a pessoa arrastou', () => {
    const imagem = { largura: 900, altura: 900 };
    const escala = escalaParaCobrir(imagem, deitada); // imagem desenhada 320 x 320
    const noTopo = retanguloDoRecorte({ x: 0, y: 0 }, escala, imagem, deitada);
    expect(noTopo).toEqual({ originX: 0, originY: 0, width: 900, height: 506 });
    const noFundo = retanguloDoRecorte({ x: 0, y: -140 }, escala, imagem, deitada);
    expect(noFundo.originY + noFundo.height).toBe(900);
  });

  it('nunca sai da imagem, mesmo com arredondamento', () => {
    const imagem = { largura: 1001, altura: 777 };
    const escala = escalaParaCobrir(imagem, deitada) * 1.37;
    const posicao = limitarPosicao({ x: -9999, y: -9999 }, imagem, escala, deitada);
    const r = retanguloDoRecorte(posicao, escala, imagem, deitada);
    expect(r.originX + r.width).toBeLessThanOrEqual(imagem.largura);
    expect(r.originY + r.height).toBeLessThanOrEqual(imagem.altura);
  });
});
