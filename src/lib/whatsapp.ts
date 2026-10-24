// Link que abre a conversa no WhatsApp com o contato da igreja (M-09).
// O wa.me precisa do número só com dígitos e com o código do país.

export function linkDoWhatsApp(numero: string | null | undefined, codigoDoPais = '55'): string | null {
  const digitos = (numero ?? '').replace(/\D/g, '');
  // Número brasileiro tem 10 ou 11 dígitos com DDD; com o 55, 12 ou 13.
  if (digitos.length < 10) return null;
  const completo = digitos.length <= 11 ? `${codigoDoPais}${digitos}` : digitos;
  return `https://wa.me/${completo}`;
}
