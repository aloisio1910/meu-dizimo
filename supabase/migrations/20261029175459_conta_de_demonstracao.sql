-- Contas de demonstração para os revisores da Apple e da Google, que não
-- recebem o código de 6 números por e-mail. Decisões do desenvolvedor
-- (29/10/2026): uma conta de membro e uma de Pastor, numa igreja fictícia;
-- o código fixo funciona sempre, com bloqueio após 5 erros por 1 hora.
--
-- O código fixo fica só no servidor (segredo CODIGO_DEMONSTRACAO da Edge
-- Function entrar-demonstracao) e só vale para quem está apenas em igrejas
-- marcadas como demonstração: nenhuma igreja de verdade é alcançada por ele.

alter table public.igrejas add column demonstracao boolean not null default false;

comment on column public.igrejas.demonstracao is
  'Igreja fictícia para os revisores das lojas. Só ela aceita o código fixo de demonstração.';


-- Tentativas do código fixo, para bloquear quem tenta adivinhar.
create table public.tentativas_de_demonstracao (
  id bigint generated always as identity primary key,
  email text not null,
  acertou boolean not null,
  em timestamptz not null default now()
);

create index tentativas_de_demonstracao_email on public.tentativas_de_demonstracao (email, em desc);

alter table public.tentativas_de_demonstracao enable row level security;
revoke all on public.tentativas_de_demonstracao from anon, authenticated;

comment on table public.tentativas_de_demonstracao is
  'Tentativas de entrar com o código fixo de demonstração (só a Edge Function grava).';


-- Pode entrar com o código fixo? 'sim', 'bloqueado' (5 erros na última hora
-- desde o último acerto) ou 'nao' (login inexistente ou fora da demonstração).
create function public.situacao_da_demonstracao(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_usuario uuid;
  v_ultimo_acerto timestamptz;
begin
  select u.id into v_usuario
    from auth.users u
   where lower(u.email) = v_email and u.deleted_at is null;

  if v_usuario is null
     or not exists (
       select 1 from public.membros m join public.igrejas i on i.id = m.igreja_id
        where m.usuario_id = v_usuario and i.demonstracao and m.status = 'ativo'
     )
     or exists (
       select 1 from public.membros m join public.igrejas i on i.id = m.igreja_id
        where m.usuario_id = v_usuario and not i.demonstracao
     )
     or exists (
       select 1 from auth.users u
        where u.id = v_usuario and coalesce((u.raw_app_meta_data ->> 'admin_master')::boolean, false)
     ) then
    return 'nao';
  end if;

  select max(t.em) into v_ultimo_acerto
    from public.tentativas_de_demonstracao t
   where t.email = v_email and t.acertou;

  if (
    select count(*) from public.tentativas_de_demonstracao t
     where t.email = v_email and not t.acertou
       and t.em > now() - interval '1 hour'
       and t.em > coalesce(v_ultimo_acerto, '-infinity'::timestamptz)
  ) >= 5 then
    return 'bloqueado';
  end if;

  return 'sim';
end;
$$;

create function public.registrar_tentativa_de_demonstracao(p_email text, p_acertou boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.tentativas_de_demonstracao (email, acertou) values (lower(trim(p_email)), p_acertou);
$$;


-- Cria ou recria a igreja de demonstração e as duas fichas. Rodada pelo
-- script scripts/preparar-demonstracao.mjs antes de enviar uma versão às
-- lojas; pode rodar quantas vezes quiser. Se um revisor excluiu a conta de
-- membro, a ficha antiga fica anonimizada e uma nova é criada.
--
-- Em duas passadas: na primeira, cria os convites (o login só nasce com
-- convite válido) e devolve os e-mails que ainda não têm login; o script cria
-- esses logins e chama de novo, e então as fichas ficam ativas, com o aceite
-- da versão atual dos termos e alguns lançamentos de exemplo.
create function public.preparar_demonstracao(p_versao_termos text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_igreja constant uuid := 'de000000-0000-4000-8000-000000000001';
  v_pessoas jsonb := '[
    {"email": "membro@demonstracao.invalid", "nome": "Membro Demonstração", "perfil": "membro", "celular": "11900000001"},
    {"email": "pastor@demonstracao.invalid", "nome": "Pastor Demonstração", "perfil": "administrador", "celular": "11900000002"}
  ]';
  v_pessoa jsonb;
  v_membro record;
  v_usuario uuid;
  v_faltam text[] := '{}';
  v_membro_id uuid;
  v_pastor_usuario uuid;
  v_conta uuid;
  v_campanha uuid;
begin
  if p_versao_termos is null or length(trim(p_versao_termos)) = 0 then
    raise exception 'termos_obrigatorios' using errcode = '23502';
  end if;

  if not exists (select 1 from public.igrejas where id = c_igreja) then
    insert into public.igrejas (id, nome, endereco, horarios_culto, versiculo_referencia, versiculo_texto, demonstracao)
    values (
      c_igreja, 'Igreja Demonstração', 'Rua Exemplo, 100, Centro, São Paulo (SP)',
      'Domingo às 10h e às 18h; quarta-feira às 20h', 'Malaquias 3:10',
      'Trazei todos os dízimos à casa do tesouro, para que haja mantimento na minha casa.', true
    );
    insert into public.contas (igreja_id, nome, finalidade, principal, banco, agencia, numero_conta,
                               chave_pix, tipo_chave_pix, nome_recebedor, cidade)
    values (c_igreja, 'Dízimos e ofertas', 'Conta fictícia da demonstração', true,
            'Banco Exemplo', '0001', '12345-6', 'pix@demonstracao.invalid', 'email', 'IGREJA DEMONSTRACAO', 'SAO PAULO');
    insert into public.campanhas (igreja_id, nome, descricao, objetivo, inicio, status)
    values (c_igreja, 'Reforma do salão',
            'Campanha fictícia da demonstração: a reforma do salão de encontros da igreja.',
            'Trocar o piso e a pintura do salão', current_date, 'ativa');
  end if;

  for v_pessoa in select * from jsonb_array_elements(v_pessoas) loop
    -- Ficha atual da pessoa (a anonimizada de uma exclusão não conta).
    select m.id, m.usuario_id, m.status into v_membro
      from public.membros m
     where m.igreja_id = c_igreja and lower(m.email) = v_pessoa ->> 'email';

    if v_membro.id is null then
      insert into public.membros (igreja_id, nome, email, celular, perfil)
      values (c_igreja, v_pessoa ->> 'nome', v_pessoa ->> 'email', v_pessoa ->> 'celular',
              (v_pessoa ->> 'perfil')::public.perfil_membro)
      returning id, usuario_id, status into v_membro;
    end if;

    select u.id into v_usuario
      from auth.users u
     where lower(u.email) = v_pessoa ->> 'email' and u.deleted_at is null;

    if v_usuario is null then
      -- Sem login ainda: garante um convite válido para o script criar o login.
      if not exists (
        select 1 from public.convites c
         where c.membro_id = v_membro.id and c.aceito_em is null and c.expira_em > now()
      ) then
        insert into public.convites (igreja_id, membro_id) values (c_igreja, v_membro.id);
      end if;
      v_faltam := v_faltam || (v_pessoa ->> 'email');
    elsif v_membro.usuario_id is null or v_membro.status <> 'ativo' then
      update public.membros
         set usuario_id = v_usuario, status = 'ativo', cadastro_concluido_em = coalesce(cadastro_concluido_em, now())
       where id = v_membro.id;
      update public.convites set aceito_em = now() where membro_id = v_membro.id and aceito_em is null;
    end if;

    if v_usuario is not null then
      insert into public.aceites_termos (usuario_id, versao, declarou_maioridade)
      values (v_usuario, trim(p_versao_termos), true)
      on conflict (usuario_id, versao) do nothing;
    end if;

    if v_pessoa ->> 'perfil' = 'membro' then
      v_membro_id := v_membro.id;
    else
      v_pastor_usuario := v_usuario;
    end if;
  end loop;

  -- Lançamentos de exemplo para o membro, uma vez por ficha: um dízimo
  -- confirmado no mês passado, uma oferta confirmada e um dízimo na fila (o
  -- revisor que entra como Pastor tem o que conferir).
  if v_pastor_usuario is not null
     and exists (select 1 from public.membros where id = v_membro_id and status = 'ativo')
     and not exists (select 1 from public.lancamentos where membro_id = v_membro_id) then
    select id into v_conta from public.contas where igreja_id = c_igreja and principal;
    select id into v_campanha from public.campanhas
     where igreja_id = c_igreja and status = 'ativa' and not permanente order by criado_em limit 1;

    insert into public.lancamentos (igreja_id, membro_id, tipo, campanha_id, conta_id, valor_informado_centavos,
                                    moeda, data_contribuicao, forma, status, criado_por, registrado_pela_tesouraria,
                                    confirmado_por, confirmado_por_nome, confirmado_em)
    values
      (c_igreja, v_membro_id, 'dizimo', null, v_conta, 30000, 'BRL', (current_date - interval '1 month')::date,
       'pix', 'confirmado', v_pastor_usuario, true, v_pastor_usuario, 'Pastor Demonstração', now()),
      (c_igreja, v_membro_id, 'oferta', v_campanha, public.conta_de_destino(c_igreja, v_campanha), 5000, 'BRL',
       current_date, 'pix', 'confirmado', v_pastor_usuario, true, v_pastor_usuario, 'Pastor Demonstração', now());

    insert into public.lancamentos (igreja_id, membro_id, tipo, conta_id, valor_informado_centavos, moeda,
                                    data_contribuicao, forma, status, criado_por)
    select c_igreja, v_membro_id, 'dizimo', v_conta, 32000, 'BRL', current_date, 'pix', 'aguardando', m.usuario_id
      from public.membros m where m.id = v_membro_id;
  end if;

  return jsonb_build_object('faltam_logins', to_jsonb(v_faltam));
end;
$$;

revoke execute on function public.situacao_da_demonstracao(text) from public, anon, authenticated;
revoke execute on function public.registrar_tentativa_de_demonstracao(text, boolean) from public, anon, authenticated;
revoke execute on function public.preparar_demonstracao(text) from public, anon, authenticated;
grant execute on function public.situacao_da_demonstracao(text) to service_role;
grant execute on function public.registrar_tentativa_de_demonstracao(text, boolean) to service_role;
grant execute on function public.preparar_demonstracao(text) to service_role;
