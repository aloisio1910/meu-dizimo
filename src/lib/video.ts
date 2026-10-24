// Vídeo da campanha (D-053): links do YouTube tocam dentro do app; outros
// links (Instagram, Vimeo...) abrem o app de origem.

// Feito com expressões regulares, sem a classe URL: no celular, a versão do
// React Native é incompleta (ex.: searchParams).
const ENDERECO = /^https?:\/\/(?:www\.|m\.|music\.)?([a-z0-9.-]+)(\/[^?#]*)?(\?[^#]*)?/i;
const ID_DO_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

// Código de 11 caracteres do vídeo do YouTube, ou null se não for do YouTube.
export function idDoYouTube(link: string | null | undefined): string | null {
  const encontrado = ENDERECO.exec((link ?? '').trim());
  if (!encontrado) return null;
  const [, host, caminho = '', consulta = ''] = encontrado;
  const partes = caminho.split('/').filter(Boolean);
  let id: string | undefined;

  if (host.toLowerCase() === 'youtu.be') {
    id = partes[0];
  } else if (['youtube.com', 'youtube-nocookie.com'].includes(host.toLowerCase())) {
    if (partes[0] === 'watch') id = /[?&]v=([^&]+)/.exec(consulta)?.[1];
    else if (['shorts', 'embed', 'live', 'v'].includes(partes[0])) id = partes[1];
  }

  return id && ID_DO_YOUTUBE.test(id) ? id : null;
}

// Página que mostra o player oficial do YouTube. O YouTube exige que o
// player saiba de qual site ele está sendo aberto, por isso a página tem
// um endereço de origem (informado ao WebView como baseUrl).
export function paginaDoPlayer(id: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0"
allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`;
}
