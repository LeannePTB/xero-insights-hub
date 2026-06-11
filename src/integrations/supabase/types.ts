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
      client_access: {
        Row: {
          client_id: string
          created_at: string
          id: string
          tier: Database["public"]["Enums"]["dashboard_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          tier?: Database["public"]["Enums"]["dashboard_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          tier?: Database["public"]["Enums"]["dashboard_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_xero_orgs: {
        Row: {
          client_id: string
          created_at: string
          id: string
          xero_connection_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          xero_connection_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          xero_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_xero_orgs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_xero_orgs_xero_connection_id_fkey"
            columns: ["xero_connection_id"]
            isOneToOne: false
            referencedRelation: "xero_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_configs: {
        Row: {
          created_at: string
          id: string
          layout: Json
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_cache: {
        Row: {
          fetched_at: string
          id: string
          params_hash: string
          payload: Json
          report_key: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          params_hash: string
          payload: Json
          report_key: string
          tenant_id: string
          user_id: string
        }
        Update: {
          fetched_at?: string
          id?: string
          params_hash?: string
          payload?: Json
          report_key?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tier_settings: {
        Row: {
          enabled: boolean
          tier: Database["public"]["Enums"]["dashboard_tier"]
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          tier: Database["public"]["Enums"]["dashboard_tier"]
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          tier?: Database["public"]["Enums"]["dashboard_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      tier_widget_config: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          tier: Database["public"]["Enums"]["dashboard_tier"]
          updated_at: string
          widgets: string[]
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          tier: Database["public"]["Enums"]["dashboard_tier"]
          updated_at?: string
          widgets?: string[]
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          tier?: Database["public"]["Enums"]["dashboard_tier"]
          updated_at?: string
          widgets?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "tier_widget_config_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      unreconciled_lines: {
        Row: {
          account_name: string
          account_number: string | null
          client_comment: string
          client_id: string
          created_at: string
          id: string
          payee: string | null
          received: number | null
          reference: string | null
          row_index: number
          source_comment: string | null
          spent: number | null
          tax: string | null
          txn_date: string | null
          updated_at: string
          upload_id: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          client_comment?: string
          client_id: string
          created_at?: string
          id?: string
          payee?: string | null
          received?: number | null
          reference?: string | null
          row_index?: number
          source_comment?: string | null
          spent?: number | null
          tax?: string | null
          txn_date?: string | null
          updated_at?: string
          upload_id: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          client_comment?: string
          client_id?: string
          created_at?: string
          id?: string
          payee?: string | null
          received?: number | null
          reference?: string | null
          row_index?: number
          source_comment?: string | null
          spent?: number | null
          tax?: string | null
          txn_date?: string | null
          updated_at?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unreconciled_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unreconciled_lines_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "unreconciled_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      unreconciled_uploads: {
        Row: {
          client_id: string
          created_at: string
          filename: string
          id: string
          line_count: number
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          filename: string
          id?: string
          line_count?: number
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          filename?: string
          id?: string
          line_count?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unreconciled_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      xero_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scopes: string | null
          tenant_id: string
          tenant_name: string
          tenant_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scopes?: string | null
          tenant_id: string
          tenant_name: string
          tenant_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scopes?: string | null
          tenant_id?: string
          tenant_name?: string
          tenant_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      xero_oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_tier_widgets: {
        Args: {
          _client_id: string
          _tier: Database["public"]["Enums"]["dashboard_tier"]
        }
        Returns: string[]
      }
      get_user_tier: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["dashboard_tier"]
      }
      has_client_access: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_access: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_advisor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "advisor" | "client_viewer"
      dashboard_tier: "basic" | "advisory" | "investigate" | "multi_company"
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
      app_role: ["advisor", "client_viewer"],
      dashboard_tier: ["basic", "advisory", "investigate", "multi_company"],
    },
  },
} as const
