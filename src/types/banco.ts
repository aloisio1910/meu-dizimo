
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
                    "ativo": boolean,"atualizado_em": string,"chave": string,"criado_em": string,"id": string,"igreja_id": string,"obrigatorio": boolean,"opcoes": (string)[],"ordem": number,"rotulo": string,"tipo": Database["public"]['Enums']["tipo_campo_cadastro"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"chave": string,"criado_em"?: string,"id"?: string,"igreja_id": string,"obrigatorio"?: boolean,"opcoes"?: (string)[],"ordem"?: number,"rotulo": string,"tipo": Database["public"]['Enums']["tipo_campo_cadastro"]
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"chave"?: string,"criado_em"?: string,"id"?: string,"igreja_id"?: string,"obrigatorio"?: boolean,"opcoes"?: (string)[],"ordem"?: number,"rotulo"?: string,"tipo"?: Database["public"]['Enums']["tipo_campo_cadastro"]
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
                    "aceito_em": string | null,"enviado_em": string,"enviado_por": string | null,"expira_em": string,"id": string,"igreja_id": string,"membro_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceito_em"?: string | null,"enviado_em"?: string,"enviado_por"?: string | null,"expira_em"?: string,"id"?: string,"igreja_id": string,"membro_id": string
                  }
                  Update: {
                    "aceito_em"?: string | null,"enviado_em"?: string,"enviado_por"?: string | null,"expira_em"?: string,"id"?: string,"igreja_id"?: string,"membro_id"?: string
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
                    "atualizado_em": string,"campanha_id": string | null,"cancelado_em": string | null,"confirmado_em": string | null,"confirmado_por": string | null,"confirmado_por_nome": string | null,"conta_id": string | null,"criado_por": string | null,"data_contribuicao": string,"divergencia_em": string | null,"divergencia_por": string | null,"divergencia_por_nome": string | null,"em_conferencia_desde": string | null,"em_conferencia_por": string | null,"forma": string,"id": string,"igreja_id": string,"membro_id": string,"mensagem_membro": string | null,"moeda": string,"motivo_cancelamento": string | null,"observacao_tesouraria": string | null,"registrado_em": string,"registrado_pela_tesouraria": boolean,"respondido_em": string | null,"resposta_membro": Database["public"]['Enums']["resposta_divergencia"] | null,"status": Database["public"]['Enums']["status_lancamento"],"tipo": Database["public"]['Enums']["tipo_lancamento"],"valor_conferido_centavos": number | null,"valor_informado_centavos": number,"exigir_conferencia_aberta": undefined | null
                  }
                  ComputedFields: "exigir_conferencia_aberta"
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
                    "atualizado_em": string,"campos_extras": NonNullable<Json>,"celular": string,"criado_em": string,"email": string,"familiares": NonNullable<Json>,"id": string,"igreja_id": string,"nome": string,"numero": number,"perfil": Database["public"]['Enums']["perfil_membro"],"status": Database["public"]['Enums']["status_membro"],"tipo_dizimo": Database["public"]['Enums']["tipo_dizimo"],"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"campos_extras"?: NonNullable<Json>,"celular": string,"criado_em"?: string,"email": string,"familiares"?: NonNullable<Json>,"id"?: string,"igreja_id": string,"nome": string,"numero": number,"perfil"?: Database["public"]['Enums']["perfil_membro"],"status"?: Database["public"]['Enums']["status_membro"],"tipo_dizimo"?: Database["public"]['Enums']["tipo_dizimo"],"usuario_id"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"campos_extras"?: NonNullable<Json>,"celular"?: string,"criado_em"?: string,"email"?: string,"familiares"?: NonNullable<Json>,"id"?: string,"igreja_id"?: string,"nome"?: string,"numero"?: number,"perfil"?: Database["public"]['Enums']["perfil_membro"],"status"?: Database["public"]['Enums']["status_membro"],"tipo_dizimo"?: Database["public"]['Enums']["tipo_dizimo"],"usuario_id"?: string | null
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
"bloqueio_vencido":
{ Args: { "p_desde": string }; Returns: boolean
                           },
"cancelar_lancamento":
{ Args: { "p_lancamento_id": string,"p_motivo": string }; Returns: undefined
                           },
"concluir_cadastro":
{ Args: { "p_campos_extras": Json,"p_celular": string,"p_familiares": Json,"p_membro_id": string,"p_nome": string,"p_tipo_dizimo": Database["public"]['Enums']["tipo_dizimo"],"p_versao_termos": string }; Returns: undefined
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
"desativar_dispositivo":
{ Args: { "p_token": string }; Returns: undefined
                           },
"desfazer_confirmacao":
{ Args: { "p_lancamento_id": string,"p_motivo": string }; Returns: undefined
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
"exigir_conferencia_aberta":
{ Args: { "v": Omit<Database["public"]['Tables']["lancamentos"]['Row'], Database["public"]['Tables']["lancamentos"]['ComputedFields']> }; Returns: undefined
                           },
"existe_lancamento_igual":
{ Args: { "p_data": string,"p_membro_id": string,"p_tipo": Database["public"]['Enums']["tipo_lancamento"],"p_valor_centavos": number }; Returns: boolean
                           },
"hook_antes_de_criar_usuario":
{ Args: { "event": Json }; Returns: Json
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
"responder_divergencia":
{ Args: { "p_aceitar": boolean,"p_lancamento_id": string,"p_mensagem"?: string }; Returns: undefined
                           },
"retirar_comprovante":
{ Args: { "p_comprovante_id": string }; Returns: undefined
                           },
"status_ao_liberar":
{ Args: { "p_resposta": Database["public"]['Enums']["resposta_divergencia"] }; Returns: Database["public"]['Enums']["status_lancamento"]
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
