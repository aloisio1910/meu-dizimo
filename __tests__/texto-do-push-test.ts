import { describe, expect, it } from '@jest/globals';
import i18next from 'i18next';

import ptBR from '../src/i18n/locales/pt-BR.json';
import { A_TESOURARIA, TEXTOS, textoDoPush } from '../supabase/functions/_shared/texto-do-push';

// O push (Edge Function) e a aba Avisos (app) precisam dizer a mesma coisa.
describe('texto do push', () => {
  it('usa os mesmos modelos da aba Avisos', () => {
    expect(TEXTOS).toEqual(ptBR.avisos.textos);
    expect(A_TESOURARIA).toBe(ptBR.avisos.aTesouraria);
  });

  it('escolhe a frase de oferta do mesmo jeito que o i18next do app', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'pt-BR',
      resources: { 'pt-BR': { translation: ptBR } },
      interpolation: { escapeValue: false },
    });
    // As chaves são montadas em tempo de execução; os tipos do app não as conhecem.
    const t = i18n.t as unknown as (chave: string, valores: object) => string;
    for (const tipo of Object.keys(TEXTOS).filter((k) => !k.endsWith('_oferta'))) {
      for (const tipoDoLancamento of ['dizimo', 'oferta']) {
        const dados = { tipo: tipoDoLancamento, valor_centavos: 1000, membro_nome: 'Maria', confirmado_por: 'José' };
        const doApp = t(`avisos.textos.${tipo}`, {
          context: tipoDoLancamento === 'oferta' ? 'oferta' : undefined,
          valor: 'R$ 10,00',
          membro: 'Maria',
          quem: 'José',
        });
        const doPush = textoDoPush({ tipo, dados }, { titulo_administrador: null, idioma: 'pt-BR' });
        expect(doPush.replace(/ /g, ' ').replace(/\{\{\w+\}\}/g, '')).toBe(doApp.replace(/\{\{\w+\}\}/g, ''));
      }
    }
  });

  const igreja = { titulo_administrador: 'Pastor de Governo', idioma: 'pt-BR' };
  // Intl separa "R$" do número com espaço inseparável.
  const limpar = (s: string) => s.replace(/ /g, ' ');

  it('monta o texto da confirmação com valor e nome', () => {
    const texto = textoDoPush(
      {
        tipo: 'lancamento_confirmado',
        dados: { tipo: 'dizimo', valor_centavos: 30050, moeda: 'BRL', confirmado_por: 'João Jr.' },
      },
      igreja,
    );
    expect(limpar(texto)).toBe('João Jr. confirmou o seu dízimo de R$ 300,50.');
  });

  it('oferta usa o feminino; sem o nome de quem confirmou, diz "A tesouraria"', () => {
    const texto = textoDoPush(
      { tipo: 'lancamento_confirmado', dados: { tipo: 'oferta', valor_centavos: 1000 } },
      igreja,
    );
    expect(limpar(texto)).toBe('A tesouraria confirmou a sua oferta de R$ 10,00.');
  });

  it('a divergência mostra o valor informado e o conferido', () => {
    const texto = textoDoPush(
      {
        tipo: 'divergencia_registrada',
        dados: { tipo: 'dizimo', valor_centavos: 25000, valor_informado_centavos: 30000 },
      },
      igreja,
    );
    expect(limpar(texto)).toBe(
      'A tesouraria conferiu o seu dízimo de R$ 300,00 e encontrou R$ 250,00. Toque para ver e responder.',
    );
  });

  it('a troca de Pix usa o título do administrador da igreja', () => {
    const texto = textoDoPush({ tipo: 'pix_alterado', dados: { conta_nome: 'Principal' } }, igreja);
    expect(texto).toBe(
      'A chave Pix da conta Principal foi alterada. Se não foi você nem alguém da tesouraria, avise o Pastor de Governo agora.',
    );
  });

  it('tipo desconhecido não gera texto', () => {
    expect(textoDoPush({ tipo: 'outro', dados: {} }, igreja)).toBe('');
  });
});
