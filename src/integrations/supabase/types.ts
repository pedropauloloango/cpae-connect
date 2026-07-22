export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          details: Json | null
          id: string
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          created_by: string | null
          fim: string
          id: string
          inicio: string
          numero: Database["public"]["Enums"]["meeting_number"] | null
          observacoes: string | null
          professional_id: string | null
          representante_cargo: Database["public"]["Enums"]["school_representative_role"] | null
          representante_nome: string | null
          request_id: string | null
          school_id: string | null
          tipo: Database["public"]["Enums"]["meeting_type"]
          titulo: string
          updated_at: string
          vivencia_request_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fim: string
          id?: string
          inicio: string
          numero?: Database["public"]["Enums"]["meeting_number"] | null
          observacoes?: string | null
          professional_id?: string | null
          representante_cargo?: Database["public"]["Enums"]["school_representative_role"] | null
          representante_nome?: string | null
          request_id?: string | null
          school_id?: string | null
          tipo?: Database["public"]["Enums"]["meeting_type"]
          titulo: string
          updated_at?: string
          vivencia_request_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fim?: string
          id?: string
          inicio?: string
          numero?: Database["public"]["Enums"]["meeting_number"] | null
          observacoes?: string | null
          professional_id?: string | null
          representante_cargo?: Database["public"]["Enums"]["school_representative_role"] | null
          representante_nome?: string | null
          request_id?: string | null
          school_id?: string | null
          tipo?: Database["public"]["Enums"]["meeting_type"]
          titulo?: string
          updated_at?: string
          vivencia_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vivencia_request_id_fkey"
            columns: ["vivencia_request_id"]
            isOneToOne: false
            referencedRelation: "vivencia_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          closure_id: string | null
          comentario: string | null
          created_at: string
          decision: string
          id: string
          meeting_id: string | null
          reviewer_id: string | null
        }
        Insert: {
          closure_id?: string | null
          comentario?: string | null
          created_at?: string
          decision: string
          id?: string
          meeting_id?: string | null
          reviewer_id?: string | null
        }
        Update: {
          closure_id?: string | null
          comentario?: string | null
          created_at?: string
          decision?: string
          id?: string
          meeting_id?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "case_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          meeting_id: string | null
          mime_type: string | null
          request_id: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          meeting_id?: string | null
          mime_type?: string | null
          request_id?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          meeting_id?: string | null
          mime_type?: string | null
          request_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      case_closures: {
        Row: {
          classificacao_final: Database["public"]["Enums"]["complaint_type"]
          closed_by: string | null
          created_at: string
          documento_final_url: string | null
          id: string
          parecer_final: string | null
          relato_anexo_url: string | null
          relato_texto: string | null
          request_id: string
          resultado: Database["public"]["Enums"]["closure_result"]
          status: Database["public"]["Enums"]["report_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          classificacao_final: Database["public"]["Enums"]["complaint_type"]
          closed_by?: string | null
          created_at?: string
          documento_final_url?: string | null
          id?: string
          parecer_final?: string | null
          relato_anexo_url?: string | null
          relato_texto?: string | null
          request_id: string
          resultado: Database["public"]["Enums"]["closure_result"]
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          classificacao_final?: Database["public"]["Enums"]["complaint_type"]
          closed_by?: string | null
          created_at?: string
          documento_final_url?: string | null
          id?: string
          parecer_final?: string | null
          relato_anexo_url?: string | null
          relato_texto?: string | null
          request_id?: string
          resultado?: Database["public"]["Enums"]["closure_result"]
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_closures_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          appointment_id: string | null
          created_at: string
          data_atendimento: string
          id: string
          numero: Database["public"]["Enums"]["meeting_number"]
          observacoes: string | null
          opcoes_encaminhamento: Database["public"]["Enums"]["meeting_referral_option"][]
          professional_id: string | null
          relato_anexo_url: string | null
          relato_texto: string | null
          request_id: string
          status: Database["public"]["Enums"]["report_status"]
          submitted_at: string | null
          tipo: Database["public"]["Enums"]["meeting_type"]
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          data_atendimento: string
          id?: string
          numero: Database["public"]["Enums"]["meeting_number"]
          observacoes?: string | null
          opcoes_encaminhamento?: Database["public"]["Enums"]["meeting_referral_option"][]
          professional_id?: string | null
          relato_anexo_url?: string | null
          relato_texto?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          tipo?: Database["public"]["Enums"]["meeting_type"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          data_atendimento?: string
          id?: string
          numero?: Database["public"]["Enums"]["meeting_number"]
          observacoes?: string | null
          opcoes_encaminhamento?: Database["public"]["Enums"]["meeting_referral_option"][]
          professional_id?: string | null
          relato_anexo_url?: string | null
          relato_texto?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          tipo?: Database["public"]["Enums"]["meeting_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          atende_acolhimento: boolean
          atende_vivencias: boolean
          cargo: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          especialidade: string | null
          id: string
          matricula: string | null
          nome: string
          regiao_atuacao: string | null
          status: Database["public"]["Enums"]["professional_status"]
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          atende_acolhimento?: boolean
          atende_vivencias?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          matricula?: string | null
          nome: string
          regiao_atuacao?: string | null
          status?: Database["public"]["Enums"]["professional_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          atende_acolhimento?: boolean
          atende_vivencias?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          regiao_atuacao?: string | null
          status?: Database["public"]["Enums"]["professional_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          receive_acolhimento_emails: boolean
          receive_notification_emails: boolean
          receive_vivencias_emails: boolean
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          receive_acolhimento_emails?: boolean
          receive_notification_emails?: boolean
          receive_vivencias_emails?: boolean
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          receive_acolhimento_emails?: boolean
          receive_notification_emails?: boolean
          receive_vivencias_emails?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          acolhido_anteriormente: boolean | null
          aluno_nascimento: string | null
          aluno_nome: string
          aluno_sexo: string | null
          aluno_serie: string | null
          aluno_turma: string | null
          aluno_turma_ano: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_professional_id: string | null
          autorizacao_ata: string | null
          comunicou_abuso: string[]
          created_at: string
          deleted_at: string | null
          descricao: string | null
          diretor_responsavel: string | null
          diretor_telefone: string | null
          educacao_especial: boolean | null
          id: string
          modalidade_acolhimento: string | null
          numero: string
          periodo: string | null
          regiao_escola: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          school_id: string | null
          school_nome_snapshot: string | null
          situacao_observada: string[]
          solicitante_email: string | null
          solicitante_nome: string | null
          solicitante_cargo: string | null
          solicitante_nome_cargo: string | null
          solicitante_telefone: string | null
          status: Database["public"]["Enums"]["request_status"]
          tipo_escola: Database["public"]["Enums"]["school_tipo"] | null
          tipo_queixa: Database["public"]["Enums"]["complaint_type"] | null
          updated_at: string
        }
        Insert: {
          acolhido_anteriormente?: boolean | null
          aluno_nascimento?: string | null
          aluno_nome: string
          aluno_sexo?: string | null
          aluno_serie?: string | null
          aluno_turma?: string | null
          aluno_turma_ano?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_professional_id?: string | null
          autorizacao_ata?: string | null
          comunicou_abuso?: string[]
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          diretor_responsavel?: string | null
          diretor_telefone?: string | null
          educacao_especial?: boolean | null
          id?: string
          modalidade_acolhimento?: string | null
          numero?: string
          periodo?: string | null
          regiao_escola?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          school_id?: string | null
          school_nome_snapshot?: string | null
          situacao_observada?: string[]
          solicitante_email?: string | null
          solicitante_nome?: string | null
          solicitante_cargo?: string | null
          solicitante_nome_cargo?: string | null
          solicitante_telefone?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tipo_escola?: Database["public"]["Enums"]["school_tipo"] | null
          tipo_queixa?: Database["public"]["Enums"]["complaint_type"] | null
          updated_at?: string
        }
        Update: {
          acolhido_anteriormente?: boolean | null
          aluno_nascimento?: string | null
          aluno_nome?: string
          aluno_sexo?: string | null
          aluno_serie?: string | null
          aluno_turma?: string | null
          aluno_turma_ano?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_professional_id?: string | null
          autorizacao_ata?: string | null
          comunicou_abuso?: string[]
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          diretor_responsavel?: string | null
          diretor_telefone?: string | null
          educacao_especial?: boolean | null
          id?: string
          modalidade_acolhimento?: string | null
          numero?: string
          periodo?: string | null
          regiao_escola?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          school_id?: string | null
          school_nome_snapshot?: string | null
          situacao_observada?: string[]
          solicitante_email?: string | null
          solicitante_nome?: string | null
          solicitante_cargo?: string | null
          solicitante_nome_cargo?: string | null
          solicitante_telefone?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tipo_escola?: Database["public"]["Enums"]["school_tipo"] | null
          tipo_queixa?: Database["public"]["Enums"]["complaint_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_professional_id_fkey"
            columns: ["assigned_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          bairro: string | null
          cep: string | null
          codigo_inep: string | null
          codigo_siger: string | null
          created_at: string
          deleted_at: string | null
          diretor_adjunto_celular: string | null
          diretor_adjunto_nome: string | null
          diretor_celular: string | null
          diretor_cpf: string | null
          diretor_nome: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          ramal: string | null
          regiao: string | null
          status: Database["public"]["Enums"]["school_status"]
          tipologia: string | null
          tipo_escola: Database["public"]["Enums"]["school_tipo"]
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          codigo_inep?: string | null
          codigo_siger?: string | null
          created_at?: string
          deleted_at?: string | null
          diretor_adjunto_celular?: string | null
          diretor_adjunto_nome?: string | null
          diretor_celular?: string | null
          diretor_cpf?: string | null
          diretor_nome?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          ramal?: string | null
          regiao?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          tipologia?: string | null
          tipo_escola?: Database["public"]["Enums"]["school_tipo"]
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          codigo_inep?: string | null
          codigo_siger?: string | null
          created_at?: string
          deleted_at?: string | null
          diretor_adjunto_celular?: string | null
          diretor_adjunto_nome?: string | null
          diretor_celular?: string | null
          diretor_cpf?: string | null
          diretor_nome?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          ramal?: string | null
          regiao?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          tipologia?: string | null
          tipo_escola?: Database["public"]["Enums"]["school_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vivencia_reports: {
        Row: {
          ano: string | null
          coordenacao: string | null
          created_at: string
          created_by: string | null
          data_vivencia: string | null
          direcao: string | null
          id: string
          quantitativo_alunos: number | null
          relato_atendimento: string
          review_comment: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          submitted_at: string | null
          submitted_by: string | null
          tecnicos_cpae: string | null
          tema: string | null
          turma: string | null
          turno: string | null
          unidade_escolar: string | null
          updated_at: string
          vivencia_request_id: string
        }
        Insert: {
          ano?: string | null
          coordenacao?: string | null
          created_at?: string
          created_by?: string | null
          data_vivencia?: string | null
          direcao?: string | null
          id?: string
          quantitativo_alunos?: number | null
          relato_atendimento?: string
          review_comment?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          tecnicos_cpae?: string | null
          tema?: string | null
          turma?: string | null
          turno?: string | null
          unidade_escolar?: string | null
          updated_at?: string
          vivencia_request_id: string
        }
        Update: {
          ano?: string | null
          coordenacao?: string | null
          created_at?: string
          created_by?: string | null
          data_vivencia?: string | null
          direcao?: string | null
          id?: string
          quantitativo_alunos?: number | null
          relato_atendimento?: string
          review_comment?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          tecnicos_cpae?: string | null
          tema?: string | null
          turma?: string | null
          turno?: string | null
          unidade_escolar?: string | null
          updated_at?: string
          vivencia_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vivencia_reports_vivencia_request_id_fkey"
            columns: ["vivencia_request_id"]
            isOneToOne: true
            referencedRelation: "vivencia_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vivencia_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          details: Json | null
          id: string
          vivencia_request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          vivencia_request_id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          vivencia_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vivencia_activity_logs_vivencia_request_id_fkey"
            columns: ["vivencia_request_id"]
            isOneToOne: false
            referencedRelation: "vivencia_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vivencia_request_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          professional_id: string
          vivencia_request_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          professional_id: string
          vivencia_request_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          professional_id?: string
          vivencia_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vivencia_request_assignees_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vivencia_request_assignees_vivencia_request_id_fkey"
            columns: ["vivencia_request_id"]
            isOneToOne: false
            referencedRelation: "vivencia_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vivencia_request_groups: {
        Row: {
          aluno_serie: string
          aluno_turma: string
          created_at: string
          data_preferivel: string | null
          id: string
          periodo: string
          sort_order: number
          temas: string[]
          vivencia_request_id: string
        }
        Insert: {
          aluno_serie: string
          aluno_turma: string
          created_at?: string
          data_preferivel?: string | null
          id?: string
          periodo: string
          sort_order?: number
          temas?: string[]
          vivencia_request_id: string
        }
        Update: {
          aluno_serie?: string
          aluno_turma?: string
          created_at?: string
          data_preferivel?: string | null
          id?: string
          periodo?: string
          sort_order?: number
          temas?: string[]
          vivencia_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vivencia_request_groups_vivencia_request_id_fkey"
            columns: ["vivencia_request_id"]
            isOneToOne: false
            referencedRelation: "vivencia_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vivencia_requests: {
        Row: {
          created_at: string
          data_preferivel_palestra: string | null
          data_preferivel_vivencia: string | null
          deleted_at: string | null
          id: string
          numero: string
          palestra_tema: string | null
          regiao_escola: string | null
          school_id: string | null
          school_nome_snapshot: string | null
          solicitante_cargo: string | null
          solicitante_email: string | null
          solicitante_nome: string | null
          solicitante_telefone: string | null
          status: Database["public"]["Enums"]["request_status"]
          tipo_escola: Database["public"]["Enums"]["school_tipo"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_preferivel_palestra?: string | null
          data_preferivel_vivencia?: string | null
          deleted_at?: string | null
          id?: string
          numero?: string
          palestra_tema?: string | null
          regiao_escola?: string | null
          school_id?: string | null
          school_nome_snapshot?: string | null
          solicitante_cargo?: string | null
          solicitante_email?: string | null
          solicitante_nome?: string | null
          solicitante_telefone?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tipo_escola?: Database["public"]["Enums"]["school_tipo"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_preferivel_palestra?: string | null
          data_preferivel_vivencia?: string | null
          deleted_at?: string | null
          id?: string
          numero?: string
          palestra_tema?: string | null
          regiao_escola?: string | null
          school_id?: string | null
          school_nome_snapshot?: string | null
          solicitante_cargo?: string | null
          solicitante_email?: string | null
          solicitante_nome?: string | null
          solicitante_telefone?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tipo_escola?: Database["public"]["Enums"]["school_tipo"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vivencia_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_palestra_occupied_dates: {
        Args: { p_regiao: string }
        Returns: { data_preferivel: string }[]
      }
      get_vivencia_occupied_dates: {
        Args: { p_periodo: string; p_regiao: string }
        Returns: { data_preferivel: string }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_acolhimento_request: {
        Args: { payload: Json }
        Returns: { id: string; numero: string }[]
      }
      submit_vivencia_request: {
        Args: { payload: Json }
        Returns: { id: string; numero: string }[]
      }
    }
    Enums: {
      account_status: "pendente" | "aprovado" | "rejeitado"
      app_role: "admin" | "profissional"
      closure_result:
        | "concluido"
        | "concluido_com_encaminhamento"
        | "em_andamento"
        | "resolvido"
        | "encaminhado"
        | "em_acompanhamento"
        | "nao_localizado"
      complaint_type:
        | "ansiedade_depressao"
        | "violacao_direitos"
        | "ideacao_suicida"
        | "bullying"
        | "conflito_familiar"
        | "outros"
      meeting_number: "primeiro" | "segundo" | "terceiro" | "quarto" | "quinto"
      meeting_referral_option:
        | "ubs_ubsf"
        | "clinica_escola_psicologia"
        | "caps_ij"
        | "rede_privada"
        | "dae_sugenor"
        | "conselho_tutelar"
      meeting_type:
        | "acolhimento"
        | "vivencia"
        | "palestra"
        | "visita_tecnica"
        | "reuniao"
        | "outros"
      professional_status: "ativo" | "ferias" | "licenca" | "inativo"
      report_status:
        | "rascunho"
        | "registrado"
        | "aguardando_aprovacao"
        | "aprovado"
        | "rejeitado"
        | "correcao_solicitada"
      request_status:
        | "recebida"
        | "distribuida"
        | "em_andamento"
        | "em_ajuste"
        | "aguardando_aprovacao"
        | "concluida"
        | "cancelada"
      school_representative_role:
        | "diretor"
        | "adjunto"
        | "coordenador_pedagogico"
        | "secretario"
      school_status: "ativa" | "inativa"
      school_tipo: "escola" | "emei"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["pendente", "aprovado", "rejeitado"],
      app_role: ["admin", "profissional"],
      closure_result: [
        "concluido",
        "concluido_com_encaminhamento",
        "em_andamento",
        "resolvido",
        "encaminhado",
        "em_acompanhamento",
        "nao_localizado",
      ],
      complaint_type: [
        "ansiedade_depressao",
        "violacao_direitos",
        "ideacao_suicida",
        "bullying",
        "conflito_familiar",
        "outros",
      ],
      meeting_number: ["primeiro", "segundo", "terceiro", "quarto", "quinto"],
      meeting_referral_option: [
        "ubs_ubsf",
        "clinica_escola_psicologia",
        "caps_ij",
        "rede_privada",
        "dae_sugenor",
        "conselho_tutelar",
      ],
      meeting_type: [
        "acolhimento",
        "vivencia",
        "palestra",
        "visita_tecnica",
        "reuniao",
        "outros",
      ],
      professional_status: ["ativo", "ferias", "licenca", "inativo"],
      report_status: [
        "rascunho",
        "registrado",
        "aguardando_aprovacao",
        "aprovado",
        "rejeitado",
        "correcao_solicitada",
      ],
      request_status: [
        "recebida",
        "distribuida",
        "em_andamento",
        "em_ajuste",
        "aguardando_aprovacao",
        "concluida",
        "cancelada",
      ],
      school_representative_role: ["diretor", "adjunto", "coordenador_pedagogico", "secretario"],
      school_status: ["ativa", "inativa"],
      school_tipo: ["escola", "emei"],
    },
  },
} as const
