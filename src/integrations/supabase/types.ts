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
      autores: {
        Row: {
          atualizado_em: string
          bio: string | null
          bio_curta: string | null
          bio_longa: string | null
          bio_media: string | null
          cargo: string | null
          competencias: string | null
          criado_em: string
          formacao: string | null
          foto_url: string | null
          fotos: Json
          id: string
          linha_do_tempo: Json
          linkedin_url: string | null
          links: Json
          nome: string
          outros_links: Json
          slug: string
          user_id: string | null
        }
        Insert: {
          atualizado_em?: string
          bio?: string | null
          bio_curta?: string | null
          bio_longa?: string | null
          bio_media?: string | null
          cargo?: string | null
          competencias?: string | null
          criado_em?: string
          formacao?: string | null
          foto_url?: string | null
          fotos?: Json
          id?: string
          linha_do_tempo?: Json
          linkedin_url?: string | null
          links?: Json
          nome: string
          outros_links?: Json
          slug: string
          user_id?: string | null
        }
        Update: {
          atualizado_em?: string
          bio?: string | null
          bio_curta?: string | null
          bio_longa?: string | null
          bio_media?: string | null
          cargo?: string | null
          competencias?: string | null
          criado_em?: string
          formacao?: string | null
          foto_url?: string | null
          fotos?: Json
          id?: string
          linha_do_tempo?: Json
          linkedin_url?: string | null
          links?: Json
          nome?: string
          outros_links?: Json
          slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          chave: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor?: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: Json
        }
        Relationships: []
      }
      contatos: {
        Row: {
          assunto: string | null
          criado_em: string
          email: string
          id: string
          lido: boolean
          mensagem: string
          nome: string
        }
        Insert: {
          assunto?: string | null
          criado_em?: string
          email: string
          id?: string
          lido?: boolean
          mensagem: string
          nome: string
        }
        Update: {
          assunto?: string | null
          criado_em?: string
          email?: string
          id?: string
          lido?: boolean
          mensagem?: string
          nome?: string
        }
        Relationships: []
      }
      importacao_estado: {
        Row: {
          atualizado_em: string
          batimento_em: string | null
          bytes_baixados: number
          concluido: boolean
          em_execucao: boolean
          id: number
          imagem_atual: string | null
          indice_pagina: number
          iniciado_em: string | null
          materia_atual: string | null
          tot_atualizados: number
          tot_erros: number
          tot_importados: number
          tot_pulados: number
          total_importados: number
          total_paginas: number
          ult_atualizados: number
          ult_erros: number
          ult_importados: number
          ult_pulados: number
          ultima_pagina: number
          ultimo_wp_id: number | null
        }
        Insert: {
          atualizado_em?: string
          batimento_em?: string | null
          bytes_baixados?: number
          concluido?: boolean
          em_execucao?: boolean
          id?: number
          imagem_atual?: string | null
          indice_pagina?: number
          iniciado_em?: string | null
          materia_atual?: string | null
          tot_atualizados?: number
          tot_erros?: number
          tot_importados?: number
          tot_pulados?: number
          total_importados?: number
          total_paginas?: number
          ult_atualizados?: number
          ult_erros?: number
          ult_importados?: number
          ult_pulados?: number
          ultima_pagina?: number
          ultimo_wp_id?: number | null
        }
        Update: {
          atualizado_em?: string
          batimento_em?: string | null
          bytes_baixados?: number
          concluido?: boolean
          em_execucao?: boolean
          id?: number
          imagem_atual?: string | null
          indice_pagina?: number
          iniciado_em?: string | null
          materia_atual?: string | null
          tot_atualizados?: number
          tot_erros?: number
          tot_importados?: number
          tot_pulados?: number
          total_importados?: number
          total_paginas?: number
          ult_atualizados?: number
          ult_erros?: number
          ult_importados?: number
          ult_pulados?: number
          ultima_pagina?: number
          ultimo_wp_id?: number | null
        }
        Relationships: []
      }
      importacao_itens: {
        Row: {
          erro: string | null
          id: string
          importado_em: string
          slug: string | null
          status: Database["public"]["Enums"]["importacao_status"]
          wp_id: number
        }
        Insert: {
          erro?: string | null
          id?: string
          importado_em?: string
          slug?: string | null
          status: Database["public"]["Enums"]["importacao_status"]
          wp_id: number
        }
        Update: {
          erro?: string | null
          id?: string
          importado_em?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["importacao_status"]
          wp_id?: number
        }
        Relationships: []
      }
      importacao_log: {
        Row: {
          contexto: Json | null
          id: number
          msg: string
          nivel: string
          ts: string
          wp_id: number | null
        }
        Insert: {
          contexto?: Json | null
          id?: number
          msg: string
          nivel: string
          ts?: string
          wp_id?: number | null
        }
        Update: {
          contexto?: Json | null
          id?: number
          msg?: string
          nivel?: string
          ts?: string
          wp_id?: number | null
        }
        Relationships: []
      }
      papeis: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          permissoes: Json
          sistema: boolean
          slug: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          permissoes?: Json
          sistema?: boolean
          slug: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          permissoes?: Json
          sistema?: boolean
          slug?: string
        }
        Relationships: []
      }
      post_temas: {
        Row: {
          post_id: string
          tema_id: string
        }
        Insert: {
          post_id: string
          tema_id: string
        }
        Update: {
          post_id?: string
          tema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_temas_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_temas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          atualizado_em: string
          autor_id: string | null
          busca_tsv: unknown
          chapeu: string | null
          conteudo: string | null
          credito_imagem: string | null
          criado_em: string
          criado_por: string | null
          destaque: boolean
          enviado_revisao_em: string | null
          id: string
          imagem_capa: string | null
          motivo_rejeicao: string | null
          nao_perca: boolean
          publicado_em: string | null
          resumo: string | null
          revisado_em: string | null
          revisor_id: string | null
          slug: string
          status: Database["public"]["Enums"]["post_status"]
          titulo: string
          wp_id: number | null
        }
        Insert: {
          atualizado_em?: string
          autor_id?: string | null
          busca_tsv?: unknown
          chapeu?: string | null
          conteudo?: string | null
          credito_imagem?: string | null
          criado_em?: string
          criado_por?: string | null
          destaque?: boolean
          enviado_revisao_em?: string | null
          id?: string
          imagem_capa?: string | null
          motivo_rejeicao?: string | null
          nao_perca?: boolean
          publicado_em?: string | null
          resumo?: string | null
          revisado_em?: string | null
          revisor_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["post_status"]
          titulo: string
          wp_id?: number | null
        }
        Update: {
          atualizado_em?: string
          autor_id?: string | null
          busca_tsv?: unknown
          chapeu?: string | null
          conteudo?: string | null
          credito_imagem?: string | null
          criado_em?: string
          criado_por?: string | null
          destaque?: boolean
          enviado_revisao_em?: string | null
          id?: string
          imagem_capa?: string | null
          motivo_rejeicao?: string | null
          nao_perca?: boolean
          publicado_em?: string | null
          resumo?: string | null
          revisado_em?: string | null
          revisor_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["post_status"]
          titulo?: string
          wp_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "autores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          atualizado_em: string
          consentimento_em: string | null
          criado_em: string
          data_nascimento: string | null
          foto_url: string | null
          id: string
          metodo_login: string | null
          nome: string | null
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          consentimento_em?: string | null
          criado_em?: string
          data_nascimento?: string | null
          foto_url?: string | null
          id: string
          metodo_login?: string | null
          nome?: string | null
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          consentimento_em?: string | null
          criado_em?: string
          data_nascimento?: string | null
          foto_url?: string | null
          id?: string
          metodo_login?: string | null
          nome?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      restauracao_log: {
        Row: {
          apagadas: number
          atualizadas: number
          criadas: number
          criado_em: string
          id: string
          modo: string
          observacao: string | null
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          apagadas?: number
          atualizadas?: number
          criadas?: number
          criado_em?: string
          id?: string
          modo: string
          observacao?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          apagadas?: number
          atualizadas?: number
          criadas?: number
          criado_em?: string
          id?: string
          modo?: string
          observacao?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      tema_merge_log: {
        Row: {
          executado_em: string
          executado_por: string | null
          id: string
          matérias_movidas: number
          principal_id: string
          principal_nome: string
          secundarios: Json
        }
        Insert: {
          executado_em?: string
          executado_por?: string | null
          id?: string
          matérias_movidas?: number
          principal_id: string
          principal_nome: string
          secundarios: Json
        }
        Update: {
          executado_em?: string
          executado_por?: string | null
          id?: string
          matérias_movidas?: number
          principal_id?: string
          principal_nome?: string
          secundarios?: Json
        }
        Relationships: []
      }
      temas: {
        Row: {
          criado_em: string
          destaque_menu: boolean
          id: string
          nome: string
          ordem: number
          slug: string
          sugestao_menu: boolean
          tipo: Database["public"]["Enums"]["tema_tipo"]
          wp_tag_id: number | null
        }
        Insert: {
          criado_em?: string
          destaque_menu?: boolean
          id?: string
          nome: string
          ordem?: number
          slug: string
          sugestao_menu?: boolean
          tipo: Database["public"]["Enums"]["tema_tipo"]
          wp_tag_id?: number | null
        }
        Update: {
          criado_em?: string
          destaque_menu?: boolean
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          sugestao_menu?: boolean
          tipo?: Database["public"]["Enums"]["tema_tipo"]
          wp_tag_id?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          papel_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          papel_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          papel_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_papel_id_fkey"
            columns: ["papel_id"]
            isOneToOne: false
            referencedRelation: "papeis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonimizar_minha_conta: { Args: never; Returns: undefined }
      autor_estatisticas: { Args: { _slug: string }; Returns: Json }
      buscar_posts: {
        Args: {
          _ordem?: string
          _page?: number
          _per_page?: number
          _q: string
          _tema_ids?: string[]
        }
        Returns: {
          credito_imagem: string
          id: string
          imagem_capa: string
          publicado_em: string
          rank: number
          resumo: string
          slug: string
          titulo: string
          total: number
          trecho: string
        }[]
      }
      contagem_arquivo: {
        Args: never
        Returns: {
          ano: number
          mes: number
          total: number
        }[]
      }
      contagem_temas: {
        Args: never
        Returns: {
          id: string
          nome: string
          slug: string
          tipo: string
          total: number
        }[]
      }
      criar_primeiro_admin: { Args: never; Returns: boolean }
      existe_staff: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      listar_arquivo: {
        Args: {
          _ano?: number
          _mes?: number
          _ordem?: string
          _page?: number
          _per_page?: number
          _q?: string
          _tema_ids?: string[]
        }
        Returns: {
          credito_imagem: string
          id: string
          imagem_capa: string
          publicado_em: string
          rank: number
          resumo: string
          slug: string
          titulo: string
          total: number
          trecho: string
        }[]
      }
      mesclar_temas: {
        Args: { _principal: string; _secundarios: string[] }
        Returns: number
      }
      neste_dia: {
        Args: { _hoje?: string; _limite?: number; _vizinhos?: number }
        Returns: {
          ano: number
          chapeu: string
          id: string
          imagem_capa: string
          publicado_em: string
          resumo: string
          slug: string
          titulo: string
        }[]
      }
      perfil_completo: { Args: { _id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sortear_post: {
        Args: { _excluir_id?: string }
        Returns: {
          chapeu: string
          id: string
          imagem_capa: string
          publicado_em: string
          resumo: string
          slug: string
          titulo: string
        }[]
      }
      sortear_post_seguro: {
        Args: { _excluir_id?: string }
        Returns: {
          chapeu: string
          id: string
          imagem_capa: string
          publicado_em: string
          resumo: string
          slug: string
          titulo: string
        }[]
      }
      tem_permissao: {
        Args: { _permissao: string; _user_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "editor"
      importacao_status: "ok" | "erro"
      post_status: "rascunho" | "publicado" | "em_revisao" | "rejeitado"
      tema_tipo: "time" | "assunto"
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
      app_role: ["admin", "editor"],
      importacao_status: ["ok", "erro"],
      post_status: ["rascunho", "publicado", "em_revisao", "rejeitado"],
      tema_tipo: ["time", "assunto"],
    },
  },
} as const
