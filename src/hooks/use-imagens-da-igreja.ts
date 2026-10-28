import { useEffect, useState } from 'react';

import { linksDasImagens } from '@/services/supabase/configuracao-da-igreja';

import { useMinhasFichas } from './use-minhas-fichas';

type Links = { logo: string | null; capa: string | null };

// Links temporários do logo e da capa da igreja em uso (seção 17). Busca de
// novo só quando o Pastor troca a imagem (o caminho muda).
export function useImagensDaIgreja(): Links {
  const { fichaEmUso } = useMinhasFichas();
  const igreja = fichaEmUso?.igrejas;
  const logo = igreja?.logo_path ?? null;
  const capa = igreja?.capa_path ?? null;
  const [links, setLinks] = useState<Links & { chave: string }>({ logo: null, capa: null, chave: '' });
  const chave = `${logo}|${capa}`;

  useEffect(() => {
    if (!logo && !capa) return;
    let ativo = true;
    linksDasImagens({ logo, capa })
      .then((encontrados) => ativo && setLinks({ ...encontrados, chave: `${logo}|${capa}` }))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [logo, capa]);

  // Enquanto o link novo não chega, não mostra a imagem antiga.
  return links.chave === chave ? { logo: links.logo, capa: links.capa } : { logo: null, capa: null };
}
