// Novo aceite dos termos (RN-041): quem já usa o app numa igreja e ainda não
// aceitou a versão atual dos termos aceita antes de continuar. Quem ainda é
// convidado aceita no Primeiro acesso; o Admin Master não é membro.
export function precisaDoNovoAceite({
  ehAdminMaster,
  statusDasFichas,
  aceitouAVersaoAtual,
}: {
  ehAdminMaster: boolean;
  statusDasFichas: string[];
  // undefined: ainda conferindo, ou a conferência falhou (não trava o app).
  aceitouAVersaoAtual: boolean | undefined;
}): boolean {
  if (ehAdminMaster || aceitouAVersaoAtual !== false) return false;
  return statusDasFichas.includes('ativo');
}

// "Igreja A", "Igreja A e Igreja B", "Igreja A, Igreja B e Igreja C".
export function listaDeNomes(nomes: string[], conjuncao: string): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} ${conjuncao} ${nomes[nomes.length - 1]}`;
}
