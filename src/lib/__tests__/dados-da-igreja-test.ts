import { describe, expect, it } from '@jest/globals';

import { redesIniciais, validarDadosDaIgreja } from '../dados-da-igreja';

const campos = {
  nome: ' Igreja Videira ',
  endereco: '',
  horarios: 'Domingo 9h e 19h',
  site: '',
  redes: { instagram: '', facebook: '', youtube: '' },
  whatsapp: '',
  versiculoReferencia: 'Malaquias 3:10',
  versiculoTexto: '',
  mensagemConfirmacao: '',
  formas: ['pix', 'dinheiro'],
};

describe('validarDadosDaIgreja', () => {
  it('campos vazios viram nulo e só as redes preenchidas são guardadas', () => {
    const resultado = validarDadosDaIgreja({
      ...campos,
      redes: { instagram: ' https://instagram.com/videira ', facebook: '', youtube: '' },
      whatsapp: '(62) 99999-0000',
    });
    expect(resultado).toEqual({
      ok: true,
      dados: {
        nome: 'Igreja Videira',
        endereco: null,
        horarios_culto: 'Domingo 9h e 19h',
        site: null,
        redes_sociais: { instagram: 'https://instagram.com/videira' },
        whatsapp_contato: '62999990000',
        versiculo_referencia: 'Malaquias 3:10',
        versiculo_texto: null,
        mensagem_confirmacao: null,
        formas_devolucao: ['pix', 'dinheiro'],
      },
    });
  });

  it('recusa link sem https, WhatsApp sem DDD e nenhuma forma aceita', () => {
    expect(
      validarDadosDaIgreja({
        ...campos,
        site: 'videira.org',
        redes: { instagram: '@videira', facebook: '', youtube: 'https://youtube.com/@videira' },
        whatsapp: '99999-0000',
        formas: [],
      }),
    ).toEqual({
      ok: false,
      erros: { site: 'linkInvalido', instagram: 'linkInvalido', whatsapp: 'whatsappInvalido', formas: 'escolhaUmaForma' },
    });
  });

  it('nome e referência do versículo são obrigatórios; textos têm limite', () => {
    expect(
      validarDadosDaIgreja({
        ...campos,
        nome: '',
        versiculoReferencia: ' ',
        versiculoTexto: 'a'.repeat(301),
        mensagemConfirmacao: 'b'.repeat(201),
      }),
    ).toEqual({
      ok: false,
      erros: { nome: 'nomeObrigatorio', versiculoReferencia: 'referenciaObrigatoria', versiculoTexto: 'textoLongo', mensagem: 'textoLongo' },
    });
  });
});

describe('redesIniciais', () => {
  it('lê o objeto do banco e ignora o que não conhece', () => {
    expect(redesIniciais({ instagram: 'https://instagram.com/x', tiktok: 'y', youtube: 3 })).toEqual({
      instagram: 'https://instagram.com/x',
      facebook: '',
      youtube: '',
    });
    expect(redesIniciais(null)).toEqual({ instagram: '', facebook: '', youtube: '' });
  });
});
