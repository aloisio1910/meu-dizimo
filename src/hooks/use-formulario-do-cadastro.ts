import { useCallback, useEffect, useState } from 'react';

import {
  familiaresIniciais,
  mesclarValores,
  validarCadastro,
  valoresIniciais,
  type CodigoDeErroDoCadastro,
  type ErrosDoCadastro,
} from '@/lib/cadastro';
import { buscarCamposDoCadastro, type CampoDoCadastro, type ErroDoCadastro, type MinhaFicha } from '@/services/supabase/membros';

// Estado do formulário de cadastro (nome, celular, campos da igreja e dízimo
// familiar), usado no Primeiro acesso (M-02) e no Meu perfil (M-10).
export function useFormularioDoCadastro(ficha: MinhaFicha) {
  const [campos, setCampos] = useState<CampoDoCadastro[] | null>(null);
  const [falhaNosCampos, setFalhaNosCampos] = useState(false);
  const [nome, setNome] = useState(ficha.nome);
  const [celular, setCelular] = useState(ficha.celular);
  const [tipoDizimo, setTipoDizimo] = useState(ficha.tipo_dizimo);
  const [familiares, setFamiliares] = useState(() => familiaresIniciais(ficha.familiares));
  const [novoFamiliar, setNovoFamiliar] = useState('');
  const [valores, setValores] = useState(() => valoresIniciais(ficha.campos_extras));
  const [erros, setErros] = useState<ErrosDoCadastro>({});

  const carregarCampos = useCallback(async () => {
    try {
      setCampos(await buscarCamposDoCadastro(ficha.igreja_id));
      setFalhaNosCampos(false);
    } catch {
      setFalhaNosCampos(true);
    }
  }, [ficha.igreja_id]);

  useEffect(() => {
    let ativo = true;
    buscarCamposDoCadastro(ficha.igreja_id)
      .then((lista) => ativo && setCampos(lista))
      .catch(() => ativo && setFalhaNosCampos(true));
    return () => {
      ativo = false;
    };
  }, [ficha.igreja_id]);

  function alterarValor(chave: string, valor: string) {
    setValores((atuais) => ({ ...atuais, [chave]: valor }));
  }

  function adicionarFamiliar() {
    const nomeDoFamiliar = novoFamiliar.trim();
    if (!nomeDoFamiliar) return;
    setFamiliares((atuais) => [...atuais, nomeDoFamiliar]);
    setNovoFamiliar('');
  }

  function removerFamiliar(indice: number) {
    setFamiliares((atuais) => atuais.filter((_, i) => i !== indice));
  }

  // Valida na tela; devolve os dados prontos para o banco, ou null se houver erro.
  function validar() {
    const resultado = validarCadastro({ nome, celular, tipoDizimo, familiares, valores }, campos ?? []);
    setErros(resultado.erros);
    if (Object.keys(resultado.erros).length > 0) return null;
    return {
      nome: nome.trim(),
      celular: celular.trim(),
      tipoDizimo,
      familiares: tipoDizimo === 'familiar' ? familiares.map((n) => ({ nome: n })) : [],
      // Mantém as respostas de campos fora do formulário (ex.: não usados).
      camposExtras: mesclarValores(
        ficha.campos_extras,
        resultado.camposExtras,
        (campos ?? []).map((campo) => campo.chave),
      ) as Record<string, string | number>,
    };
  }

  // O banco valida de novo: os erros dele aparecem no campo certo.
  // Devolve true se o erro foi de um campo (e já está marcado na tela).
  function mostrarErroDoBanco(erro: ErroDoCadastro): boolean {
    let codigo: CodigoDeErroDoCadastro | 'campoInvalido' | undefined;
    let chave: string | undefined;
    if (erro.codigo === 'campo_obrigatorio' || erro.codigo === 'campo_invalido') {
      codigo = erro.codigo === 'campo_obrigatorio' ? 'campoObrigatorio' : 'campoInvalido';
      chave = `campo:${erro.campo}`;
    } else if (erro.codigo === 'familiares_obrigatorios') {
      codigo = 'familiaresObrigatorios';
      chave = 'familiares';
    }
    if (!codigo || !chave) return false;
    setErros({ [chave]: codigo } as ErrosDoCadastro);
    return true;
  }

  return {
    campos,
    falhaNosCampos,
    carregarCampos,
    nome,
    setNome,
    celular,
    setCelular,
    tipoDizimo,
    setTipoDizimo,
    familiares,
    novoFamiliar,
    setNovoFamiliar,
    adicionarFamiliar,
    removerFamiliar,
    valores,
    alterarValor,
    erros,
    validar,
    mostrarErroDoBanco,
  };
}

export type FormularioDoCadastro = ReturnType<typeof useFormularioDoCadastro>;
