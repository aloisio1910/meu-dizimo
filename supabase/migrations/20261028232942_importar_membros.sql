-- Importar membros por planilha (B2, D-107).
--
-- A tesouraria confere a prévia no app e manda a lista; o banco convida cada
-- pessoa como convidar_membro faria (mesmas regras, mesmo log) e devolve o
-- resultado de cada linha. Uma linha com problema não impede as outras.
-- Os e-mails de convite saem pelo caminho de sempre (enviar-convites), mas
-- a função é chamada uma vez no fim, não uma vez por pessoa.

-- Durante a importação, cada convite não chama a função de e-mail; a
-- importação chama uma vez só, no fim.
create or replace function public.convites_disparar_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('meudizimo.importando', true) is distinct from 'sim' then
    perform public.chamar_funcao_interna('url_do_envio_de_convites');
  end if;
  return null;
end;
$$;

-- p_pessoas: [{linha, nome, email, celular}]. Devolve [{linha, email, resultado}],
-- com resultado convidado | email_ja_cadastrado | dados_invalidos.
create function public.importar_membros(p_igreja_id uuid, p_pessoas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa jsonb;
  v_email text;
  v_resultados jsonb := '[]'::jsonb;
  v_resultado text;
begin
  if not public.eh_tesouraria(p_igreja_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if jsonb_typeof(p_pessoas) <> 'array' or jsonb_array_length(p_pessoas) = 0 then
    raise exception 'lista_vazia' using errcode = '22023';
  end if;
  if jsonb_array_length(p_pessoas) > 500 then
    raise exception 'lista_grande_demais' using errcode = '22023';
  end if;

  perform set_config('meudizimo.importando', 'sim', true);

  for v_pessoa in select * from jsonb_array_elements(p_pessoas) loop
    v_email := lower(trim(coalesce(v_pessoa ->> 'email', '')));
    if length(trim(coalesce(v_pessoa ->> 'nome', ''))) = 0
       or length(trim(coalesce(v_pessoa ->> 'celular', ''))) = 0
       or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_resultado := 'dados_invalidos';
    else
      begin
        perform public.convidar_membro(p_igreja_id, v_pessoa ->> 'nome', v_email, v_pessoa ->> 'celular', 'membro');
        v_resultado := 'convidado';
      exception
        when unique_violation then v_resultado := 'email_ja_cadastrado';
      end;
    end if;
    v_resultados := v_resultados || jsonb_build_object(
      'linha', v_pessoa -> 'linha', 'email', v_email, 'resultado', v_resultado
    );
  end loop;

  perform set_config('meudizimo.importando', '', true);
  perform public.chamar_funcao_interna('url_do_envio_de_convites');
  return v_resultados;
end;
$$;

revoke execute on function public.importar_membros(uuid, jsonb) from public, anon;
grant execute on function public.importar_membros(uuid, jsonb) to authenticated;
