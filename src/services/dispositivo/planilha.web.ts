// Na web, a planilha é baixada direto pelo navegador.
import { base64ParaBytes } from '@/lib/base64';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function entregarPlanilha(nomeDoArquivo: string, base64: string, _tituloDaJanela: string): Promise<void> {
  const bytes = base64ParaBytes(base64);
  const conteudo = new Blob([bytes.slice().buffer], { type: TIPO_XLSX });
  const endereco = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nomeDoArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(endereco);
}
