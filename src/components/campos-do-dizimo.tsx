import { useTranslation } from 'react-i18next';

import { CampoTexto } from '@/components/ui/campo-texto';
import { Opcoes } from '@/components/ui/opcoes';
import { mascararData } from '@/lib/data';
import { completarValor, mascararValor } from '@/lib/dinheiro';
import { ehFormaConhecida } from '@/lib/formas';
import type { ErrosDoDizimo } from '@/lib/validar-dizimo';

type Props = {
  valor: string;
  aoMudarValor: (valor: string) => void;
  data: string;
  aoMudarData: (data: string) => void;
  forma: string | undefined;
  aoMudarForma: (forma: string) => void;
  formasAceitas: string[];
  erros: ErrosDoDizimo;
  oferta?: boolean; // muda só os rótulos ("Data da oferta")
};

// Valor, data e forma do dízimo ou da oferta: usados no registro (M-04), na
// edição (M-05) e no registro opcional da oferta.
export function CamposDoDizimo(props: Props) {
  const { t } = useTranslation();
  const rotuloDaForma = (forma: string) => (ehFormaConhecida(forma) ? t(`formas.${forma}`) : forma);

  return (
    <>
      <CampoTexto
        rotulo={t('registrar.rotuloValor')}
        dica={t('registrar.dicaValor')}
        value={props.valor}
        onChangeText={(texto) => props.aoMudarValor(mascararValor(texto))}
        onBlur={() => props.aoMudarValor(completarValor(props.valor))}
        erro={props.erros.valor && t(`registrar.erros.${props.erros.valor}`)}
        keyboardType="decimal-pad"
      />
      <CampoTexto
        rotulo={props.oferta ? t('registrar.rotuloDataOferta') : t('registrar.rotuloData')}
        dica={t('registrar.dicaData')}
        value={props.data}
        onChangeText={(texto) => props.aoMudarData(mascararData(texto))}
        erro={props.erros.data && t(`registrar.erros.${props.erros.data}`)}
        keyboardType="number-pad"
      />
      <Opcoes
        rotulo={props.oferta ? t('registrar.rotuloFormaOferta') : t('registrar.rotuloForma')}
        opcoes={props.formasAceitas.map((forma) => ({ valor: forma, rotulo: rotuloDaForma(forma) }))}
        selecionada={props.forma}
        onSelecionar={props.aoMudarForma}
        erro={props.erros.forma && t(`registrar.erros.${props.erros.forma}`)}
      />
    </>
  );
}
