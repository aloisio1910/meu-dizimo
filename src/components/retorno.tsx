import { Texto } from '@/components/ui/texto';

// Resultado de uma ação (sucesso ou erro). Deve ficar logo abaixo do botão
// que a pessoa tocou: no topo de uma tela comprida, a mensagem passa
// despercebida. O aviso também é lido pelo leitor de tela.
export function Retorno({ aviso, erro }: { aviso?: string; erro?: string }) {
  return (
    <>
      {!!aviso && (
        <Texto variante="destaque" accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      )}
      {!!erro && (
        <Texto variante="erro" accessibilityLiveRegion="assertive">
          {erro}
        </Texto>
      )}
    </>
  );
}
