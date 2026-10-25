import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RecorteDeImagem } from '@/components/recorte-de-imagem';
import { Retorno } from '@/components/retorno';
import { Botao } from '@/components/ui/botao';
import { Tela } from '@/components/ui/tela';
import { Texto } from '@/components/ui/texto';
import { useFichaAtiva } from '@/hooks/use-ficha-ativa';
import { useImagensDaIgreja } from '@/hooks/use-imagens-da-igreja';
import { useMinhasFichas } from '@/hooks/use-minhas-fichas';
import { useVoltar } from '@/hooks/use-voltar';
import { corSegura, PALETA } from '@/lib/paleta';
import { escolherImagemParaRecortar, type ImagemParaRecortar } from '@/services/dispositivo/arquivos';
import { recortarImagem, type RetanguloDoRecorte } from '@/services/dispositivo/recorte';
import {
  enviarImagemDaIgreja,
  retirarImagemDaIgreja,
  salvarCorDaIgreja,
  type ImagemDaIgreja,
} from '@/services/supabase/configuracao-da-igreja';
import { alturaBotao, corPrincipalPadrao, cores, espacos, fontes, raio, tamanhos } from '@/theme';

type Secao = ImagemDaIgreja | 'cor';

// Moldura e tamanho final de cada imagem. O logo fica em PNG para manter o
// fundo transparente; a capa, em JPEG, mais leve para foto.
const FORMATO: Record<
  ImagemDaIgreja,
  { proporcao: number; larguraNaTela: number; larguraFinal: number; arquivo: 'png' | 'jpg' }
> = {
  logo: { proporcao: 1, larguraNaTela: 300, larguraFinal: 512, arquivo: 'png' },
  capa: { proporcao: 16 / 9, larguraNaTela: 640, larguraFinal: 1600, arquivo: 'jpg' },
};

// P-03 Logo, capa e cor (seção 17). A cor sai de uma paleta com contraste
// de 7:1 com o branco, para os botões continuarem legíveis.
export default function Aparencia() {
  const { t } = useTranslation();
  const voltar = useVoltar('/configuracoes');
  const { ficha, carregando, ehAdministrador } = useFichaAtiva();
  const { recarregar } = useMinhasFichas();
  const imagens = useImagensDaIgreja();
  const corAtual = corSegura(ficha?.igrejas?.cor_principal, corPrincipalPadrao);
  const [corEscolhida, setCorEscolhida] = useState<string>();
  const [enviando, setEnviando] = useState<Secao>();
  const [retorno, setRetorno] = useState<{ secao: Secao; aviso?: string; erro?: string }>();
  const [recortando, setRecortando] = useState<{ tipo: ImagemDaIgreja; imagem: ImagemParaRecortar }>();

  if (!carregando && (!ficha || !ehAdministrador)) return <Redirect href="/" />;
  if (!ficha) return null;

  const a = 'tesouraria.aparencia';
  const cor = corEscolhida ?? corAtual;

  // Escolher a imagem abre a moldura; só o que ficar dentro dela é enviado.
  async function aoEscolher(tipo: ImagemDaIgreja) {
    setRetorno(undefined);
    const escolha = await escolherImagemParaRecortar();
    if (!escolha.ok) {
      if (escolha.motivo === 'permissao_negada') setRetorno({ secao: tipo, erro: t(`${a}.erros.permissao_negada`) });
      return;
    }
    setRecortando({ tipo, imagem: escolha.imagem });
  }

  async function aoUsarRecorte(retangulo: RetanguloDoRecorte) {
    if (!recortando) return;
    const { tipo, imagem } = recortando;
    const formato = FORMATO[tipo];
    setEnviando(tipo);
    let falha: Awaited<ReturnType<typeof enviarImagemDaIgreja>>;
    try {
      const bytes = await recortarImagem(imagem.uri, retangulo, formato.larguraFinal, formato.arquivo);
      falha = await enviarImagemDaIgreja(ficha!.igreja_id, tipo, {
        tipo: formato.arquivo === 'png' ? 'image/png' : 'image/jpeg',
        nome: null,
        tamanho: bytes.byteLength,
        ler: async () => bytes,
      });
    } catch {
      falha = 'envio_falhou';
    }
    if (!falha) {
      await recarregar();
      setRecortando(undefined);
    }
    setEnviando(undefined);
    setRetorno(falha ? { secao: tipo, erro: t(`${a}.erros.${falha}`) } : { secao: tipo, aviso: t(`${a}.enviada`) });
  }

  async function aoRetirar(tipo: ImagemDaIgreja) {
    setRetorno(undefined);
    setEnviando(tipo);
    const retirou = await retirarImagemDaIgreja(ficha!.igreja_id, tipo);
    if (retirou) await recarregar();
    setEnviando(undefined);
    setRetorno(retirou ? { secao: tipo, aviso: t(`${a}.retirada`) } : { secao: tipo, erro: t(`${a}.erros.falhou`) });
  }

  async function aoSalvarCor() {
    setRetorno(undefined);
    setEnviando('cor');
    const salvou = await salvarCorDaIgreja(ficha!.igreja_id, cor);
    if (salvou) await recarregar();
    setEnviando(undefined);
    setRetorno(salvou ? { secao: 'cor', aviso: t(`${a}.corSalva`) } : { secao: 'cor', erro: t(`${a}.erros.falhou`) });
    if (salvou) setCorEscolhida(undefined);
  }

  const retornoDe = (secao: Secao) => retorno?.secao === secao && <Retorno aviso={retorno.aviso} erro={retorno.erro} />;

  const blocoDeImagem = (tipo: ImagemDaIgreja) => {
    const link = imagens[tipo];
    const temImagem = !!(tipo === 'logo' ? ficha.igrejas?.logo_path : ficha.igrejas?.capa_path);
    const Tipo = tipo === 'logo' ? 'Logo' : 'Capa';
    return (
      <View style={estilos.cartao}>
        <Texto variante="destaque" accessibilityRole="header">
          {t(`${a}.${tipo}`)}
        </Texto>
        <Texto variante="apoio">{t(`${a}.dica${Tipo}`)}</Texto>
        {recortando?.tipo === tipo ? (
          <RecorteDeImagem
            imagem={recortando.imagem}
            proporcao={FORMATO[tipo].proporcao}
            larguraMaxima={FORMATO[tipo].larguraNaTela}
            larguraRecomendada={FORMATO[tipo].larguraFinal}
            enviando={enviando === tipo}
            aoConfirmar={aoUsarRecorte}
            aoCancelar={() => setRecortando(undefined)}
          />
        ) : (
          <>
            {temImagem && !!link ? (
              <Image
                source={{ uri: link }}
                style={tipo === 'logo' ? estilos.logo : estilos.capa}
                contentFit={tipo === 'logo' ? 'contain' : 'cover'}
                accessibilityLabel={t(`${a}.descricao${Tipo}`)}
              />
            ) : (
              !temImagem && <Texto>{t(`${a}.sem${Tipo}`)}</Texto>
            )}
            <Botao
              titulo={temImagem ? t(`${a}.trocar${Tipo}`) : t(`${a}.enviar${Tipo}`)}
              variante="secundario"
              onPress={() => aoEscolher(tipo)}
              carregando={enviando === tipo}
              desabilitado={!!enviando || !!recortando}
            />
            {temImagem && (
              <Botao
                titulo={t(`${a}.retirar${Tipo}`)}
                variante="secundario"
                onPress={() => aoRetirar(tipo)}
                desabilitado={!!enviando}
              />
            )}
          </>
        )}
        {retornoDe(tipo)}
      </View>
    );
  };

  return (
    <Tela larga>
      <Texto variante="titulo">{t(`${a}.titulo`)}</Texto>
      <Texto>{t(`${a}.explicacao`)}</Texto>

      {blocoDeImagem('logo')}
      {blocoDeImagem('capa')}

      <View style={estilos.cartao}>
        <Texto variante="destaque" accessibilityRole="header">
          {t(`${a}.cor`)}
        </Texto>
        <Texto variante="apoio">{t(`${a}.dicaCor`)}</Texto>
        <View style={estilos.paleta} accessibilityRole="radiogroup" accessibilityLabel={t(`${a}.cor`)}>
          {PALETA.map((opcao) => {
            const escolhida = opcao.cor.toUpperCase() === cor.toUpperCase();
            const nome = t(`${a}.nomesDasCores.${opcao.nome}`);
            return (
              <Pressable
                key={opcao.nome}
                accessibilityRole="radio"
                accessibilityState={{ checked: escolhida }}
                accessibilityLabel={nome}
                onPress={() => {
                  setRetorno(undefined);
                  setCorEscolhida(opcao.cor);
                }}
                style={[estilos.opcaoDeCor, escolhida && { borderColor: cores.texto, borderWidth: 4 }]}
              >
                <View style={[estilos.amostra, { backgroundColor: opcao.cor }]} />
                <Texto variante="apoio">{nome}</Texto>
              </Pressable>
            );
          })}
        </View>
        {/* Prévia: um botão desenhado com a cor escolhida, antes de salvar. */}
        <Texto variante="apoio">{t(`${a}.previa`)}</Texto>
        <View style={[estilos.previa, { backgroundColor: cor }]}>
          <Text style={estilos.textoDaPrevia}>{t(`${a}.salvarCor`)}</Text>
        </View>
        <Botao
          titulo={t(`${a}.salvarCor`)}
          onPress={aoSalvarCor}
          carregando={enviando === 'cor'}
          desabilitado={!!enviando || cor.toUpperCase() === corAtual.toUpperCase()}
        />
        {retornoDe('cor')}
      </View>

      <Botao titulo={t(`${a}.voltar`)} variante="secundario" onPress={() => voltar()} desabilitado={!!enviando} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espacos.medio,
    padding: espacos.medio,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: raio,
  },
  capa: {
    width: '100%',
    maxWidth: 640,
    aspectRatio: 16 / 9,
    borderRadius: raio,
  },
  paleta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacos.medio,
  },
  opcaoDeCor: {
    alignItems: 'center',
    gap: espacos.pequeno,
    padding: espacos.pequeno,
    minWidth: 96,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
  },
  amostra: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  previa: {
    minHeight: alturaBotao,
    borderRadius: raio,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacos.grande,
  },
  textoDaPrevia: {
    color: '#FFFFFF',
    fontFamily: fontes.negrito,
    fontSize: tamanhos.corpo,
  },
});
