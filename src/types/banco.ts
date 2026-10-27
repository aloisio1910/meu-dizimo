
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "aceites_termos": {
                  Row: {
                    "aceito_em": string,"id": string,"usuario_id": string,"versao": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceito_em"?: string,"id"?: string,"usuario_id"?: string,"versao": string
                  }
                  Update: {
                    "aceito_em"?: string,"id"?: string,"usuario_id"?: string,"versao"?: string
                  }
                  Relationships: [
                    
                  ]
                },"auditoria": {
                  Row: {
                    "acao": string,"antes": Json | null,"criado_em": string,"depois": Json | null,"id": number,"igreja_id": string | null,"motivo": string | null,"perfil": string | null,"registro_id": string | null,"tabela": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acao": string,"antes"?: Json | null,"criado_em"?: string,"depois"?: Json | null,"id"?: never,"igreja_id"?: string | null,"motivo"?: string | null,"perfil"?: string | null,"registro_id"?: string | null,"tabela": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"antes"?: Json | null,"criado_em"?: string,"depois"?: Json | null,"id"?: never,"igreja_id"?: string | null,"motivo"?: string | null,"perfil"?: string | null,"registro_id"?: string | null,"tabela"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "auditoria_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    }
                  ]
                },"campanha_midias": {
                  Row: {
                    "arquivo_path": string,"ativa": boolean,"campanha_id": string,"criado_em": string,"id": string,"igreja_id": string,"ordem": number
                  }
                  ComputedFields: never
                  Insert: {
                    "arquivo_path": string,"ativa"?: boolean,"campanha_id": string,"criado_em"?: string,"id"?: string,"igreja_id": string,"ordem"?: number
                  }
                  Update: {
                    "arquivo_path"?: string,"ativa"?: boolean,"campanha_id"?: string,"criado_em"?: string,"id"?: string,"igreja_id"?: string,"ordem"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "campanha_midias_campanha_id_igreja_id_fkey"
      columns: ["campanha_id","igreja_id"]
isOneToOne: false
      referencedRelation: "campanhas"
      referencedColumns: ["id","igreja_id"]
    },{
      foreignKeyName: "campanha_midias_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    }
                  ]
                },"campanhas": {
                  Row: {
                    "atualizado_em": string,"conta_id": string | null,"criado_em": string,"descricao": string | null,"fim": string | null,"id": string,"igreja_id": string,"inicio": string | null,"link_video": string | null,"nome": string,"objetivo": string | null,"permanente": boolean,"status": Database["public"]['Enums']["status_campanha"]
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"conta_id"?: string | null,"criado_em"?: string,"descricao"?: string | null,"fim"?: string | null,"id"?: string,"igreja_id": string,"inicio"?: string | null,"link_video"?: string | null,"nome": string,"objetivo"?: string | null,"permanente"?: boolean,"status"?: Database["public"]['Enums']["status_campanha"]
                  }
                  Update: {
                    "atualizado_em"?: string,"conta_id"?: string | null,"criado_em"?: string,"descricao"?: string | null,"fim"?: string | null,"id"?: string,"igreja_id"?: string,"inicio"?: string | null,"link_video"?: string | null,"nome"?: string,"objetivo"?: string | null,"permanente"?: boolean,"status"?: Database["public"]['Enums']["status_campanha"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "campanhas_conta_id_igreja_id_fkey"
      columns: ["conta_id","igreja_id"]
isOneToOne: false
      referencedRelation: "contas"
      referencedColumns: ["id","igreja_id"]
    },{
      foreignKeyName: "campanhas_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    }
                  ]
                },"campos_cadastro": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"chave": string,"criado_em": string,"id": string,"igreja_id": string,"obrigatorio": boolean,"opcoes": (string)[],"ordem": number,"preenchido_por": string,"rotulo": string,"tipo": Database["public"]['Enums']["tipo_campo_cadastro"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"chave": string,"criado_em"?: string,"id"?: string,"igreja_id": string,"obrigatorio"?: boolean,"opcoes"?: (string)[],"ordem"?: number,"preenchido_por"?: string,"rotulo": string,"tipo": Database["public"]['Enums']["tipo_campo_cadastro"]
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"chave"?: string,"criado_em"?: string,"id"?: string,"igreja_id"?: string,"obrigatorio"?: boolean,"opcoes"?: (string)[],"ordem"?: number,"preenchido_por"?: string,"rotulo"?: string,"tipo"?: Database["public"]['Enums']["tipo_campo_cadastro"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "campos_cadastro_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    }
                  ]
                },"comprovantes": {
                  Row: {
                    "arquivo_path": string,"enviado_em": string,"enviado_por": string | null,"formato": Database["public"]['Enums']["formato_comprovante"],"id": string,"igreja_id": string,"lancamento_id": string,"retirado_em": string | null,"retirado_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arquivo_path": string,"enviado_em"?: string,"enviado_por"?: string | null,"formato": Database["public"]['Enums']["formato_comprovante"],"id"?: string,"igreja_id": string,"lancamento_id": string,"retirado_em"?: string | null,"retirado_por"?: string | null
                  }
                  Update: {
                    "arquivo_path"?: string,"enviado_em"?: string,"enviado_por"?: string | null,"formato"?: Database["public"]['Enums']["formato_comprovante"],"id"?: string,"igreja_id"?: string,"lancamento_id"?: string,"retirado_em"?: string | null,"retirado_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "comprovantes_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comprovantes_lancamento_id_igreja_id_fkey"
      columns: ["lancamento_id","igreja_id"]
isOneToOne: false
      referencedRelation: "lancamentos"
      referencedColumns: ["id","igreja_id"]
    },{
      foreignKeyName: "comprovantes_lancamento_id_igreja_id_fkey"
      columns: ["lancamento_id","igreja_id"]
isOneToOne: false
      referencedRelation: "lancamentos_detalhados"
      referencedColumns: ["id","igreja_id"]
    }
                  ]
                },"contas": {
                  Row: {
                    "agencia": string | null,"ativa": boolean,"atualizado_em": string,"banco": string | null,"chave_pix": string | null,"cidade": string | null,"criado_em": string,"finalidade": string | null,"id": string,"igreja_id": string,"nome": string,"nome_recebedor": string | null,"numero_conta": string | null,"principal": boolean,"tipo_chave_pix": Database["public"]['Enums']["tipo_chave_pix"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agencia"?: string | null,"ativa"?: boolean,"atualizado_em"?: string,"banco"?: string | null,"chave_pix"?: string | null,"cidade"?: string | null,"criado_em"?: string,"finalidade"?: string | null,"id"?: string,"igreja_id": string,"nome": string,"nome_recebedor"?: string | null,"numero_conta"?: string | null,"principal"?: boolean,"tipo_chave_pix"?: Database["public"]['Enums']["tipo_chave_pix"] | null
                  }
                  Update: {
                    "agencia"?: string | null,"ativa"?: boolean,"atualizado_em"?: string,"banco"?: string | null,"chave_pix"?: string | null,"cidade"?: string | null,"criado_em"?: string,"finalidade"?: string | null,"id"?: string,"igreja_id"?: string,"nome"?: string,"nome_recebedor"?: string | null,"numero_conta"?: string | null,"principal"?: boolean,"tipo_chave_pix"?: Database["public"]['Enums']["tipo_chave_pix"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contas_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    }
                  ]
                },"convites": {
                  Row: {
                    "aceito_em": string | null,"email_enviado_em": string | null,"email_erro": string | null,"email_tentado_em": string | null,"email_tentativas": number,"enviado_em": string,"enviado_por": string | null,"expira_em": string,"id": string,"igreja_id": string,"membro_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceito_em"?: string | null,"email_enviado_em"?: string | null,"email_erro"?: string | null,"email_tentado_em"?: string | null,"email_tentativas"?: number,"enviado_em"?: string,"enviado_por"?: string | null,"expira_em"?: string,"id"?: string,"igreja_id": string,"membro_id": string
                  }
                  Update: {
                    "aceito_em"?: string | null,"email_enviado_em"?: string | null,"email_erro"?: string | null,"email_tentado_em"?: string | null,"email_tentativas"?: number,"enviado_em"?: string,"enviado_por"?: string | null,"expira_em"?: string,"id"?: string,"igreja_id"?: string,"membro_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "convites_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "convites_membro_id_igreja_id_fkey"
      columns: ["membro_id","igreja_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id","igreja_id"]
    }
                  ]
                },"dispositivos": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"criado_em": string,"id": string,"plataforma": Database["public"]['Enums']["plataforma_dispositivo"],"token": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"plataforma": Database["public"]['Enums']["plataforma_dispositivo"],"token": string,"usuario_id": string
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"plataforma"?: Database["public"]['Enums']["plataforma_dispositivo"],"token"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"igrejas": {
                  Row: {
                    "atualizado_em": string,"capa_path": string | null,"cor_principal": string | null,"criado_em": string,"denominacao": string | null,"endereco": string | null,"faixa_plano": string | null,"formas_devolucao": (string)[],"horarios_culto": string | null,"id": string,"idioma": string,"logo_path": string | null,"mensagem_confirmacao": string | null,"moeda": string,"nome": string,"pais": string,"proximo_numero_dizimista": number,"redes_sociais": NonNullable<Json>,"site": string | null,"status": Database["public"]['Enums']["status_igreja"],"titulo_administrador": string,"versiculo_referencia": string,"versiculo_texto": string | null,"whatsapp_contato": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"capa_path"?: string | null,"cor_principal"?: string | null,"criado_em"?: string,"denominacao"?: string | null,"endereco"?: string | null,"faixa_plano"?: string | null,"formas_devolucao"?: (string)[],"horarios_culto"?: string | null,"id"?: string,"idioma"?: string,"logo_path"?: string | null,"mensagem_confirmacao"?: string | null,"moeda"?: string,"nome": string,"pais"?: string,"proximo_numero_dizimista"?: number,"redes_sociais"?: NonNullable<Json>,"site"?: string | null,"status"?: Database["public"]['Enums']["status_igreja"],"titulo_administrador"?: string,"versiculo_referencia"?: string,"versiculo_texto"?: string | null,"whatsapp_contato"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"capa_path"?: string | null,"cor_principal"?: string | null,"criado_em"?: string,"denominacao"?: string | null,"endereco"?: string | null,"faixa_plano"?: string | null,"formas_devolucao"?: (string)[],"horarios_culto"?: string | null,"id"?: string,"idioma"?: string,"logo_path"?: string | null,"mensagem_confirmacao"?: string | null,"moeda"?: string,"nome"?: string,"pais"?: string,"proximo_numero_dizimista"?: number,"redes_sociais"?: NonNullable<Json>,"site"?: string | null,"status"?: Database["public"]['Enums']["status_igreja"],"titulo_administrador"?: string,"versiculo_referencia"?: string,"versiculo_texto"?: string | null,"whatsapp_contato"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"lancamentos": {
                  Row: {
                    "atualizado_em": string,"campanha_id": string | null,"cancelado_em": string | null,"confirmado_em": string | null,"confirmado_por": string | null,"confirmado_por_nome": string | null,"conta_id": string | null,"criado_por": string | null,"data_contribuicao": string,"divergencia_em": string | null,"divergencia_por": string | null,"divergencia_por_nome": string | null,"em_conferencia_desde": string | null,"em_conferencia_por": string | null,"forma": string,"id": string,"igreja_id": string,"membro_id": string,"mensagem_membro": string | null,"moeda": string,"motivo_cancelamento": string | null,"observacao_tesouraria": string | null,"registrado_em": string,"registrado_pela_tesouraria": boolean,"respondido_em": string | null,"resposta_membro": Database["public"]['Enums']["resposta_divergencia"] | null,"status": Database["public"]['Enums']["status_lancamento"],"tipo": Database["public"]['Enums']["tipo_lancamento"],"valor_conferido_centavos": number | null,"valor_informado_centavos": number,"dados_do_lancamento": Json | null,"exigir_conferencia_aberta": undefined | null
                  }
                  ComputedFields: "dados_do_lancamento" | "exigir_conferencia_aberta"
                  Insert: {
                    "atualizado_em"?: string,"campanha_id"?: string | null,"cancelado_em"?: string | null,"confirmado_em"?: string | null,"confirmado_por"?: string | null,"confirmado_por_nome"?: string | null,"conta_id"?: string | null,"criado_por"?: string | null,"data_contribuicao": string,"divergencia_em"?: string | null,"divergencia_por"?: string | null,"divergencia_por_nome"?: string | null,"em_conferencia_desde"?: string | null,"em_conferencia_por"?: string | null,"forma": string,"id"?: string,"igreja_id": string,"membro_id": string,"mensagem_membro"?: string | null,"moeda": string,"motivo_cancelamento"?: string | null,"observacao_tesouraria"?: string | null,"registrado_em"?: string,"registrado_pela_tesouraria"?: boolean,"respondido_em"?: string | null,"resposta_membro"?: Database["public"]['Enums']["resposta_divergencia"] | null,"status"?: Database["public"]['Enums']["status_lancamento"],"tipo": Database["public"]['Enums']["tipo_lancamento"],"valor_conferido_centavos"?: number | null,"valor_informado_centavos": number
                  }
                  Update: {
                    "atualizado_em"?: string,"campanha_id"?: string | null,"cancelado_em"?: string | null,"confirmado_em"?: string | null,"confirmado_por"?: string | null,"confirmado_por_nome"?: string | null,"conta_id"?: string | null,"criado_por"?: string | null,"data_contribuicao"?: string,"divergencia_em"?: string | null,"divergencia_por"?: string | null,"divergencia_por_nome"?: string | null,"em_conferencia_desde"?: string | null,"em_conferencia_por"?: string | null,"forma"?: string,"id"?: string,"igreja_id"?: string,"membro_id"?: string,"mensagem_membro"?: string | null,"moeda"?: string,"motivo_cancelamento"?: string | null,"observacao_tesouraria"?: string | null,"registrado_em"?: string,"registrado_pela_tesouraria"?: boolean,"respondido_em"?: string | null,"resposta_membro"?: Database["public"]['Enums']["resposta_divergencia"] | null,"status"?: Database["public"]['Enums']["status_lancamento"],"tipo"?: Database["public"]['Enums']["tipo_lancamento"],"valor_conferido_centavos"?: number | null,"valor_informado_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lancamentos_campanha_id_igreja_id_fkey"
      columns: ["campanha_id","igreja_id"]
isOneToOne: false
      referencedRelation: "campanhas"
      referencedColumns: ["id","igreja_id"]
    },{
      foreignKeyName: "lancamentos_conta_id_igreja_id_fkey"
      columns: ["conta_id","igreja_id"]
isOneToOne: false
      referencedRelation: "contas"
      referencedColumns: ["id","igreja_id"]
    },{
      foreignKeyName: "lancamentos_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lancamentos_membro_id_igreja_id_fkey"
      columns: ["membro_id","igreja_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id","igreja_id"]
    }
                  ]
                },"membros": {
                  Row: {
                    "atualizado_em": string,"avisos_desligados": (string)[],"cadastro_concluido_em": string | null,"campos_extras": NonNullable<Json>,"campos_internos": NonNullable<Json>,"celular": string,"criado_em": string,"email": string,"familiares": NonNullable<Json>,"id": string,"igreja_id": string,"nome": string,"numero": number,"perfil": Database["public"]['Enums']["perfil_membro"],"status": Database["public"]['Enums']["status_membro"],"tipo_dizimo": Database["public"]['Enums']["tipo_dizimo"],"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"avisos_desligados"?: (string)[],"cadastro_concluido_em"?: string | null,"campos_extras"?: NonNullable<Json>,"campos_internos"?: NonNullable<Json>,"celular": string,"criado_em"?: string,"email": string,"familiares"?: NonNullable<Json>,"id"?: string,"igreja_id": string,"nome": string,"numero": number,"perfil"?: Database["public"]['Enums']["perfil_membro"],"status"?: Database["public"]['Enums']["status_membro"],"tipo_dizimo"?: Database["public"]['Enums']["tipo_dizimo"],"usuario_id"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"avisos_desligados"?: (string)[],"cadastro_concluido_em"?: string | null,"campos_extras"?: NonNullable<Json>,"campos_internos"?: NonNullable<Json>,"celular"?: string,"criado_em"?: string,"email"?: string,"familiares"?: NonNullable<Json>,"id"?: string,"igreja_id"?: string,"nome"?: string,"numero"?: number,"perfil"?: Database["public"]['Enums']["perfil_membro"],"status"?: Database["public"]['Enums']["status_membro"],"tipo_dizimo"?: Database["public"]['Enums']["tipo_dizimo"],"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "membros_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    }
                  ]
                },"notificacoes": {
                  Row: {
                    "criado_em": string,"dados": NonNullable<Json>,"id": string,"igreja_id": string,"lida_em": string | null,"push_enviado_em": string | null,"push_erro": string | null,"push_tentado_em": string | null,"push_tentativas": number,"tipo": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"dados"?: NonNullable<Json>,"id"?: string,"igreja_id": string,"lida_em"?: string | null,"push_enviado_em"?: string | null,"push_erro"?: string | null,"push_tentado_em"?: string | null,"push_tentativas"?: number,"tipo": string,"usuario_id": string
                  }
                  Update: {
                    "criado_em"?: string,"dados"?: NonNullable<Json>,"id"?: string,"igreja_id"?: string,"lida_em"?: string | null,"push_enviado_em"?: string | null,"push_erro"?: string | null,"push_tentado_em"?: string | null,"push_tentativas"?: number,"tipo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notificacoes_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "lancamentos_detalhados": {
                  Row: {
                    "atualizado_em": string | null,"campanha_id": string | null,"cancelado_em": string | null,"conferencia_parada": boolean | null,"confirmado_em": string | null,"confirmado_por": string | null,"confirmado_por_nome": string | null,"conta_id": string | null,"conta_nome": string | null,"criado_por": string | null,"data_contribuicao": string | null,"divergencia_em": string | null,"divergencia_por": string | null,"divergencia_por_nome": string | null,"divergencia_sinalizada": boolean | null,"em_conferencia_desde": string | null,"em_conferencia_por": string | null,"em_conferencia_por_nome": string | null,"forma": string | null,"id": string | null,"igreja_id": string | null,"membro_id": string | null,"membro_nome": string | null,"membro_numero": number | null,"mensagem_membro": string | null,"moeda": string | null,"motivo_cancelamento": string | null,"observacao_tesouraria": string | null,"registrado_em": string | null,"registrado_pela_tesouraria": boolean | null,"respondido_em": string | null,"resposta_membro": Database["public"]['Enums']["resposta_divergencia"] | null,"status": Database["public"]['Enums']["status_lancamento"] | null,"tem_comprovante": boolean | null,"tipo": Database["public"]['Enums']["tipo_lancamento"] | null,"valor_conferido_centavos": number | null,"valor_informado_centavos": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "lancamentos_campanha_id_igreja_id_fkey"
      columns: ["campanha_id","igreja_id"]
isOneToOne: false
      referencedRelation: "campanhas"
      referencedColumns: ["id","igreja_id"]
    },{
      foreignKeyName: "lancamentos_conta_id_igreja_id_fkey"
      columns: ["conta_id","igreja_id"]
isOneToOne: false
      referencedRelation: "contas"
      referencedColumns: ["id","igreja_id"]
    },{
      foreignKeyName: "lancamentos_igreja_id_fkey"
      columns: ["igreja_id"]
isOneToOne: false
      referencedRelation: "igrejas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lancamentos_membro_id_igreja_id_fkey"
      columns: ["membro_id","igreja_id"]
isOneToOne: false
      referencedRelation: "membros"
      referencedColumns: ["id","igreja_id"]
    }
                  ]
                }
          }
          Functions: {
            "abrir_conferencia":
{ Args: { "p_lancamento_id": string }; Returns: {
              "atualizado_em": string,
"campanha_id": string | null,
"cancelado_em": string | null,
"confirmado_em": string | null,
"confirmado_por": string | null,
"confirmado_por_nome": string | null,
"conta_id": string | null,
"criado_por": string | null,
"data_contribuicao": string,
"divergencia_em": string | null,
"divergencia_por": string | null,
"divergencia_por_nome": string | null,
"em_conferencia_desde": string | null,
"em_conferencia_por": string | null,
"forma": string,
"id": string,
"igreja_id": string,
"membro_id": string,
"mensagem_membro": string | null,
"moeda": string,
"motivo_cancelamento": string | null,
"observacao_tesouraria": string | null,
"registrado_em": string,
"registrado_pela_tesouraria": boolean,
"respondido_em": string | null,
"resposta_membro": Database["public"]['Enums']["resposta_divergencia"] | null,
"status": Database["public"]['Enums']["status_lancamento"],
"tipo": Database["public"]['Enums']["tipo_lancamento"],
"valor_conferido_centavos": number | null,
"valor_informado_centavos": number
            }
                          SetofOptions: {
        from: "*"
        to: "lancamentos"
        isOneToOne: true
        isSetofReturn: false
      } },
"abrir_proximo_da_fila":
{ Args: { "p_campanha_id"?: string,"p_com_comprovante"?: boolean,"p_igreja_id": string,"p_tipo"?: Database["public"]['Enums']["tipo_lancamento"] }; Returns: {
              "atualizado_em": string,
"campanha_id": string | null,
"cancelado_em": string | null,
"confirmado_em": string | null,
"confirmado_por": string | null,
"confirmado_por_nome": string | null,
"conta_id": string | null,
"criado_por": string | null,
"data_contribuicao": string,
"divergencia_em": string | null,
"divergencia_por": string | null,
"divergencia_por_nome": string | null,
"em_conferencia_desde": string | null,
"em_conferencia_por": string | null,
"forma": string,
"id": string,
"igreja_id": string,
"membro_id": string,
"mensagem_membro": string | null,
"moeda": string,
"motivo_cancelamento": string | null,
"observacao_tesouraria": string | null,
"registrado_em": string,
"registrado_pela_tesouraria": boolean,
"respondido_em": string | null,
"resposta_membro": Database["public"]['Enums']["resposta_divergencia"] | null,
"status": Database["public"]['Enums']["status_lancamento"],
"tipo": Database["public"]['Enums']["tipo_lancamento"],
"valor_conferido_centavos": number | null,
"valor_informado_centavos": number
            }
                          SetofOptions: {
        from: "*"
        to: "lancamentos"
        isOneToOne: true
        isSetofReturn: false
      } },
"aceitar_convites":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"admin_atualizar_igreja":
{ Args: { "p_faixa_plano": string,"p_idioma": string,"p_igreja_id": string,"p_moeda": string,"p_nome": string,"p_pais": string,"p_status": Database["public"]['Enums']["status_igreja"],"p_titulo_administrador": string }; Returns: undefined
                           },
"admin_buscar_pessoa":
{ Args: { "p_email": string,"p_motivo": string }; Returns: {
              "email": string,"igreja_id": string,"igreja_nome": string,"membro_id": string,"nome": string,"perfil": Database["public"]['Enums']["perfil_membro"],"status": Database["public"]['Enums']["status_membro"],"tem_login": boolean
            }[]
                           },
"admin_cadastrar_igreja":
{ Args: { "p_faixa_plano": string,"p_idioma": string,"p_moeda": string,"p_nome": string,"p_pais": string,"p_pastor_celular": string,"p_pastor_email": string,"p_pastor_nome": string,"p_titulo_administrador": string }; Returns: string
                           },
"admin_convidar_pastor":
{ Args: { "p_celular": string,"p_email": string,"p_igreja_id": string,"p_motivo": string,"p_nome": string }; Returns: string
                           },
"admin_definir_pastor":
{ Args: { "p_membro_id": string,"p_motivo": string }; Returns: undefined
                           },
"admin_listar_igrejas":
{ Args: Record<PropertyKey, never>; Returns: {
              "criado_em": string,"faixa_plano": string,"id": string,"idioma": string,"membros_ativos": number,"moeda": string,"nome": string,"pais": string,"pastor_email": string,"pastor_id": string,"pastor_nome": string,"pastor_status": Database["public"]['Enums']["status_membro"],"status": Database["public"]['Enums']["status_igreja"],"titulo_administrador": string
            }[]
                           },
"admin_logs_globais":
{ Args: { "p_pagina"?: number,"p_tamanho"?: number }; Returns: {
              "acao": string,"antes": Json,"criado_em": string,"depois": Json,"id": number,"igreja_id": string,"igreja_nome": string,"motivo": string,"registro_id": string,"tabela": string,"total": number
            }[]
                           },
"admin_tirar_pastor_atual":
{ Args: { "p_exceto": string,"p_igreja_id": string }; Returns: undefined
                           },
"agir_como":
{ Args: { "p_usuario": string }; Returns: undefined
                           },
"avisar_ficha":
{ Args: { "p_dados": Json,"p_membro_id": string,"p_tipo": string }; Returns: undefined
                           },
"avisar_tesouraria":
{ Args: { "p_dados": Json,"p_exceto": string,"p_igreja_id": string,"p_tipo": string }; Returns: undefined
                           },
"avisar_troca_de_email":
{ Args: { "p_membro_id": string }; Returns: undefined
                           },
"aviso_pode_desligar":
{ Args: { "p_tipo": string }; Returns: boolean
                           },
"bloqueio_vencido":
{ Args: { "p_desde": string }; Returns: boolean
                           },
"cancelar_lancamento":
{ Args: { "p_lancamento_id": string,"p_motivo": string }; Returns: undefined
                           },
"chamar_funcao_interna":
{ Args: { "p_nome_da_url": string }; Returns: undefined
                           },
"concluir_cadastro":
{ Args: { "p_campos_extras": Json,"p_celular": string,"p_familiares": Json,"p_membro_id": string,"p_nome": string,"p_tipo_dizimo": Database["public"]['Enums']["tipo_dizimo"],"p_versao_termos": string }; Returns: undefined
                           },
"concluir_envio_de_convites":
{ Args: { "p_resultados": Json }; Returns: undefined
                           },
"concluir_envio_de_push":
{ Args: { "p_resultados": Json,"p_tokens_invalidos"?: (string)[] }; Returns: undefined
                           },
"confirmar_lancamento":
{ Args: { "p_lancamento_id": string,"p_valor_conferido_centavos"?: number }; Returns: undefined
                           },
"conta_de_destino":
{ Args: { "p_campanha_id": string,"p_igreja_id": string }; Returns: string
                           },
"convidar_membro":
{ Args: { "p_celular": string,"p_email": string,"p_igreja_id": string,"p_nome": string,"p_perfil"?: Database["public"]['Enums']["perfil_membro"] }; Returns: string
                           },
"dados_do_lancamento":
{ Args: { "l": Omit<Database["public"]['Tables']["lancamentos"]['Row'], Database["public"]['Tables']["lancamentos"]['ComputedFields']> }; Returns: Json
                           },
"definir_conta_principal":
{ Args: { "p_conta_id": string }; Returns: undefined
                           },
"desativar_dispositivo":
{ Args: { "p_token": string }; Returns: undefined
                           },
"desfazer_confirmacao":
{ Args: { "p_lancamento_id": string,"p_motivo": string }; Returns: undefined
                           },
"desfazer_troca_de_email":
{ Args: { "p_autor": string,"p_email_antigo": string,"p_membro_id": string }; Returns: undefined
                           },
"disparar_envio_de_push":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"eh_admin_master":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"eh_administrador":
{ Args: { "p_igreja_id": string }; Returns: boolean
                           },
"eh_minha_ficha":
{ Args: { "p_membro_id": string }; Returns: boolean
                           },
"eh_proprio_lancamento":
{ Args: { "p_membro_id": string }; Returns: boolean
                           },
"eh_tesouraria":
{ Args: { "p_igreja_id": string }; Returns: boolean
                           },
"eh_vinculado":
{ Args: { "p_igreja_id": string }; Returns: boolean
                           },
"encerrar_campanhas_vencidas":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"exigir_admin_master":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"exigir_conferencia_aberta":
{ Args: { "v": Omit<Database["public"]['Tables']["lancamentos"]['Row'], Database["public"]['Tables']["lancamentos"]['ComputedFields']> }; Returns: undefined
                           },
"existe_lancamento_igual":
{ Args: { "p_data": string,"p_membro_id": string,"p_tipo": Database["public"]['Enums']["tipo_lancamento"],"p_valor_centavos": number }; Returns: boolean
                           },
"hoje_na_igreja":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"hook_antes_de_criar_usuario":
{ Args: { "event": Json }; Returns: Json
                           },
"igreja_ativa":
{ Args: { "p_igreja_id": string }; Returns: boolean
                           },
"igrejas_inativas_onde_estou":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"igrejas_onde_estou_inativo":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"lancamento_para_conferir":
{ Args: { "p_lancamento_id": string }; Returns: {
              "atualizado_em": string,
"campanha_id": string | null,
"cancelado_em": string | null,
"confirmado_em": string | null,
"confirmado_por": string | null,
"confirmado_por_nome": string | null,
"conta_id": string | null,
"criado_por": string | null,
"data_contribuicao": string,
"divergencia_em": string | null,
"divergencia_por": string | null,
"divergencia_por_nome": string | null,
"em_conferencia_desde": string | null,
"em_conferencia_por": string | null,
"forma": string,
"id": string,
"igreja_id": string,
"membro_id": string,
"mensagem_membro": string | null,
"moeda": string,
"motivo_cancelamento": string | null,
"observacao_tesouraria": string | null,
"registrado_em": string,
"registrado_pela_tesouraria": boolean,
"respondido_em": string | null,
"resposta_membro": Database["public"]['Enums']["resposta_divergencia"] | null,
"status": Database["public"]['Enums']["status_lancamento"],
"tipo": Database["public"]['Enums']["tipo_lancamento"],
"valor_conferido_centavos": number | null,
"valor_informado_centavos": number
            }
                          SetofOptions: {
        from: "*"
        to: "lancamentos"
        isOneToOne: true
        isSetofReturn: false
      } },
"liberar_conferencia":
{ Args: { "p_lancamento_id": string }; Returns: undefined
                           },
"liberar_conferencias_paradas":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"manter_conferencia":
{ Args: { "p_lancamento_id": string }; Returns: undefined
                           },
"marcar_avisos_como_lidos":
{ Args: { "p_ids"?: (string)[] }; Returns: undefined
                           },
"meu_nome_na_igreja":
{ Args: { "p_igreja_id": string }; Returns: string
                           },
"perfil_na_igreja":
{ Args: { "p_igreja_id": string }; Returns: Database["public"]['Enums']["perfil_membro"]
                           },
"prazo_conferencia":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"prazo_desfazer_confirmacao":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"prazo_resposta_divergencia":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"reabrir_lancamento":
{ Args: { "p_justificativa": string,"p_lancamento_id": string }; Returns: undefined
                           },
"reenviar_convite":
{ Args: { "p_membro_id": string }; Returns: string
                           },
"registrar_dispositivo":
{ Args: { "p_plataforma": Database["public"]['Enums']["plataforma_dispositivo"],"p_token": string }; Returns: undefined
                           },
"registrar_divergencia":
{ Args: { "p_lancamento_id": string,"p_observacao": string,"p_valor_conferido_centavos": number }; Returns: undefined
                           },
"registrar_download_do_log":
{ Args: { "p_antes_de": string,"p_busca"?: string,"p_desde": string,"p_igreja_id": string,"p_quantidade": number }; Returns: undefined
                           },
"registros_do_log":
{ Args: { "p_antes_de": string,"p_busca"?: string,"p_desde": string,"p_igreja_id": string,"p_pagina"?: number,"p_quem"?: string,"p_tabelas"?: (string)[],"p_tamanho"?: number }; Returns: {
              "acao": string,"antes": Json,"criado_em": string,"depois": Json,"id": number,"motivo": string,"perfil": string,"registro_id": string,"tabela": string,"total": number,"usuario_id": string
            }[]
                           },
"reservar_avisos_para_push":
{ Args: { "p_limite"?: number }; Returns: {
              "dados": Json,"id": string,"idioma": string,"igreja_id": string,"igreja_nome": string,"tipo": string,"titulo_administrador": string,"tokens": (string)[]
            }[]
                           },
"reservar_convites_para_email":
{ Args: { "p_limite"?: number }; Returns: {
              "email": string,"expira_em": string,"id": string,"igreja_nome": string,"nome": string
            }[]
                           },
"responder_divergencia":
{ Args: { "p_aceitar": boolean,"p_lancamento_id": string,"p_mensagem"?: string }; Returns: undefined
                           },
"retirar_comprovante":
{ Args: { "p_comprovante_id": string }; Returns: undefined
                           },
"simplificar":
{ Args: { "p_texto": string }; Returns: string
                           },
"status_ao_liberar":
{ Args: { "p_resposta": Database["public"]['Enums']["resposta_divergencia"] }; Returns: Database["public"]['Enums']["status_lancamento"]
                           },
"trocar_email_do_membro":
{ Args: { "p_autor": string,"p_email": string,"p_membro_id": string,"p_motivo": string }; Returns: Json
                           },
"uuid_ou_nulo":
{ Args: { "p_texto": string }; Returns: string
                           }
          }
          Enums: {
            "formato_comprovante": "pdf"|"jpg"|"png","perfil_membro": "membro"|"tesoureiro"|"administrador","plataforma_dispositivo": "ios"|"android"|"web","resposta_divergencia": "aceita"|"contestada","status_campanha": "rascunho"|"ativa"|"encerrada","status_igreja": "ativa"|"inativa","status_lancamento": "aguardando"|"em_conferencia"|"confirmado"|"divergencia"|"cancelado","status_membro": "convidado"|"ativo"|"inativo","tipo_campo_cadastro": "texto"|"data"|"numero"|"lista","tipo_chave_pix": "cpf"|"cnpj"|"email"|"telefone"|"aleatoria","tipo_dizimo": "individual"|"familiar","tipo_lancamento": "dizimo"|"oferta"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "formato_comprovante": ["pdf", "jpg", "png"],"perfil_membro": ["membro", "tesoureiro", "administrador"],"plataforma_dispositivo": ["ios", "android", "web"],"resposta_divergencia": ["aceita", "contestada"],"status_campanha": ["rascunho", "ativa", "encerrada"],"status_igreja": ["ativa", "inativa"],"status_lancamento": ["aguardando", "em_conferencia", "confirmado", "divergencia", "cancelado"],"status_membro": ["convidado", "ativo", "inativo"],"tipo_campo_cadastro": ["texto", "data", "numero", "lista"],"tipo_chave_pix": ["cpf", "cnpj", "email", "telefone", "aleatoria"],"tipo_dizimo": ["individual", "familiar"],"tipo_lancamento": ["dizimo", "oferta"]
          }
        }
} as const
