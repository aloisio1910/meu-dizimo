import { describe, expect, it } from '@jest/globals';

import { caminhoDaArte, formatoDaArte, mudancaDaCampanha, validarCampanha } from '../campanha';

const campos = { nome: 'Missões', descricao: '', objetivo: '', inicio: '', fim: '', linkVideo: '' };
const hoje = '2026-10-24';

describe('validarCampanha', () => {
  it('só o nome é obrigatório; vazios viram nulo', () => {
    expect(validarCampanha({ ...campos, nome: ' Missões ', descricao: '  ' }, hoje, true)).toEqual({
      ok: true,
      dados: { nome: 'Missões', descricao: null, objetivo: null, inicio: null, fim: null, link_video: null },
    });
  });

  it('converte as datas e guarda o link', () => {
    const resultado = validarCampanha(
      { ...campos, inicio: '01/11/2026', fim: '30/11/2026', linkVideo: ' https://youtu.be/abc ' },
      hoje,
      true,
    );
    expect(resultado).toMatchObject({ ok: true, dados: { inicio: '2026-11-01', fim: '2026-11-30', link_video: 'https://youtu.be/abc' } });
  });

  it('recusa nome vazio, data inválida e link sem http', () => {
    expect(validarCampanha({ ...campos, nome: '', inicio: '31/02/2026', linkVideo: 'youtube.com/x' }, hoje, true)).toEqual({
      ok: false,
      erros: { nome: 'nomeObrigatorio', inicio: 'dataInvalida', linkVideo: 'linkInvalido' },
    });
  });

  it('fim antes do início', () => {
    expect(validarCampanha({ ...campos, inicio: '10/11/2026', fim: '09/11/2026' }, hoje, true)).toEqual({
      ok: false,
      erros: { fim: 'fimAntesDoInicio' },
    });
  });

  it('fim no passado só é erro se a campanha vai ficar ativa (D-089)', () => {
    expect(validarCampanha({ ...campos, fim: '23/10/2026' }, hoje, true)).toEqual({
      ok: false,
      erros: { fim: 'fimNoPassado' },
    });
    expect(validarCampanha({ ...campos, fim: '23/10/2026' }, hoje, false).ok).toBe(true);
    expect(validarCampanha({ ...campos, fim: '24/10/2026' }, hoje, true).ok).toBe(true);
  });
});

describe('formatoDaArte', () => {
  const bytes = (...lista: number[]) => new Uint8Array([...lista, 0, 0, 0, 0, 0, 0, 0, 0]);

  it('reconhece PNG, JPG e WebP pela assinatura', () => {
    expect(formatoDaArte(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(formatoDaArte(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
    expect(formatoDaArte(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('webp');
  });

  it('recusa PDF, RIFF que não é WebP (ex.: WAV) e HEIC', () => {
    expect(formatoDaArte(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull();
    expect(formatoDaArte(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeNull();
    expect(formatoDaArte(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63))).toBeNull();
  });
});

describe('caminhoDaArte', () => {
  it('segue a pasta que a política do bucket exige', () => {
    expect(caminhoDaArte('igreja', 'campanha', 'arquivo', 'webp')).toBe('igreja/campanha/arquivo.webp');
  });
});

describe('mudancaDaCampanha (D-088)', () => {
  it('rascunho publica, ativa encerra, encerrada reabre', () => {
    expect(mudancaDaCampanha({ status: 'rascunho', permanente: false })).toEqual({ acao: 'publicar', para: 'ativa' });
    expect(mudancaDaCampanha({ status: 'ativa', permanente: false })).toEqual({ acao: 'encerrar', para: 'encerrada' });
    expect(mudancaDaCampanha({ status: 'encerrada', permanente: false })).toEqual({ acao: 'reabrir', para: 'ativa' });
  });

  it('a permanente Oferta não encerra', () => {
    expect(mudancaDaCampanha({ status: 'ativa', permanente: true })).toBeNull();
  });
});
