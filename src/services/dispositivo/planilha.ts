// Entregar a planilha no celular: grava no cache do app e abre a janela de
// compartilhar do sistema (WhatsApp, e-mail, Drive...).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { base64ParaBytes } from '@/lib/base64';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function entregarPlanilha(nomeDoArquivo: string, base64: string, tituloDaJanela: string): Promise<void> {
  const arquivo = new File(Paths.cache, nomeDoArquivo);
  if (arquivo.exists) arquivo.delete(); // só o arquivo temporário do próprio app
  arquivo.create();
  arquivo.write(base64ParaBytes(base64));
  await Sharing.shareAsync(arquivo.uri, {
    mimeType: TIPO_XLSX,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
    dialogTitle: tituloDaJanela,
  });
}
