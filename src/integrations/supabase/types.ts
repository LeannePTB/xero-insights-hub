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
      access_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          firm_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["firm_member_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          firm_id: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["firm_member_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          firm_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["firm_member_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_invites_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "admin_firm_overview"
            referencedColumns: ["firm_id"]
          },
          {
            foreignKeyName: "access_invites_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_finding_snoozes: {
        Row: {
          created_at: string
          finding_key: string
          note: string | null
          snoozed_by: string | null
          snoozed_until: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          finding_key: string
          note?: string | null
          snoozed_by?: string | null
          snoozed_until?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          finding_key?: string
          note?: string | null
          snoozed_by?: string | null
          snoozed_until?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      audit_findings: {
        Row: {
          category: string
          created_at: string
          deep_link: string | null
          entity_id: string | null
          entity_type: string | null
          evidence: Json
          finding_key: string
          id: string
          message: string
          rule_id: string
          run_id: string
          severity: string
          tenant_id: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          deep_link?: string | null
          entity_id?: string | null
          entity_type?: string | null
          evidence?: Json
          finding_key: string
          id?: string
          message: string
          rule_id: string
          run_id: string
          severity: string
          tenant_id: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          deep_link?: string | null
          entity_id?: string | null
          entity_type?: string | null
          evidence?: Json
          finding_key?: string
          id?: string
          message?: string
          rule_id?: string
          run_id?: string
          severity?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          at: string
          firm_id: string | null
          id: string
          ip: string | null
          meta: Json | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          at?: string
          firm_id?: string | null
          id?: string
          ip?: string | null
          meta?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          at?: string
          firm_id?: string | null
          id?: string
          ip?: string | null
          meta?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "admin_firm_overview"
            referencedColumns: ["firm_id"]
          },
          {
            foreignKeyName: "audit_log_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_runs: {
        Row: {
          duration_ms: number | null
          error: string | null
          id: string
          run_at: string
          run_by: string | null
          summary: Json
          tenant_id: string
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          id?: string
          run_at?: string
          run_by?: string | null
          summary?: Json
          tenant_id: string
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          id?: string
          run_at?: string
          run_by?: string | null
          summary?: Json
          tenant_id?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          firm_id: string | null
          id: string
          occurred_at: string
          payload: Json
          stripe_event_id: string
          type: string
        }
        Insert: {
          firm_id?: string | null
          id?: string
          occurred_at?: string
          payload: Json
          stripe_event_id: string
          type: string
        }
        Update: {
          firm_id?: string | null
          id?: string
          occurred_at?: string
          payload?: Json
          stripe_event_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "admin_firm_overview"
            referencedColumns: ["firm_id"]
          },
          {
            foreignKeyName: "billing_events_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
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
      client_cost_classifications: {
        Row: {
          account_name: string
          classification: string
          client_id: string
          created_at: string
          id: string
          is_wages: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_name: string
          classification: string
          client_id: string
          created_at?: string
          id?: string
          is_wages?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          classification?: string
          client_id?: string
          created_at?: string
          id?: string
          is_wages?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_cost_classifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_true_breakeven_inputs: {
        Row: {
          ato_payment_plan: number
          client_id: string
          created_at: string
          credit_card_interest: number
          equipment_finance: number
          id: string
          loan_principal: number
          notes: string | null
          other: number
          owner_drawings: number
          tax_payments: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ato_payment_plan?: number
          client_id: string
          created_at?: string
          credit_card_interest?: number
          equipment_finance?: number
          id?: string
          loan_principal?: number
          notes?: string | null
          other?: number
          owner_drawings?: number
          tax_payments?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ato_payment_plan?: number
          client_id?: string
          created_at?: string
          credit_card_interest?: number
          equipment_finance?: number
          id?: string
          loan_principal?: number
          notes?: string | null
          other?: number
          owner_drawings?: number
          tax_payments?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_true_breakeven_inputs_client_id_fkey"
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
          basis_overrides: Json
          cost_classification_enabled: boolean
          created_at: string
          firm_id: string | null
          id: string
          name: string
          notes: string
          owner_user_id: string
          report_basis: Database["public"]["Enums"]["report_basis"]
          updated_at: string
        }
        Insert: {
          basis_overrides?: Json
          cost_classification_enabled?: boolean
          created_at?: string
          firm_id?: string | null
          id?: string
          name: string
          notes?: string
          owner_user_id: string
          report_basis?: Database["public"]["Enums"]["report_basis"]
          updated_at?: string
        }
        Update: {
          basis_overrides?: Json
          cost_classification_enabled?: boolean
          created_at?: string
          firm_id?: string | null
          id?: string
          name?: string
          notes?: string
          owner_user_id?: string
          report_basis?: Database["public"]["Enums"]["report_basis"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "admin_firm_overview"
            referencedColumns: ["firm_id"]
          },
          {
            foreignKeyName: "clients_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_card_order: {
        Row: {
          client_id: string
          order: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          order?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          order?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_card_order_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      firm_members: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          role: Database["public"]["Enums"]["firm_member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          id?: string
          role?: Database["public"]["Enums"]["firm_member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          role?: Database["public"]["Enums"]["firm_member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_members_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "admin_firm_overview"
            referencedColumns: ["firm_id"]
          },
          {
            foreignKeyName: "firm_members_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          created_at: string
          id: string
          is_always_free: boolean
          name: string
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_always_free?: boolean
          name: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_always_free?: boolean
          name?: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      login_events: {
        Row: {
          email: string | null
          id: string
          ip: string | null
          occurred_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          email?: string | null
          id?: string
          ip?: string | null
          occurred_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          ip?: string | null
          occurred_at?: string
          user_agent?: string | null
          user_id?: string | null
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
      rate_limit_buckets: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
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
      security_contact_details: {
        Row: {
          abn: string | null
          app_name: string | null
          assessment_date: string | null
          company_legal_name: string | null
          created_at: string
          id: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_role: string | null
          registered_address: string | null
          singleton: boolean
          trading_name: string | null
          updated_at: string
          website: string | null
          xero_api_usage: string | null
          xero_client_id: string | null
        }
        Insert: {
          abn?: string | null
          app_name?: string | null
          assessment_date?: string | null
          company_legal_name?: string | null
          created_at?: string
          id?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_role?: string | null
          registered_address?: string | null
          singleton?: boolean
          trading_name?: string | null
          updated_at?: string
          website?: string | null
          xero_api_usage?: string | null
          xero_client_id?: string | null
        }
        Update: {
          abn?: string | null
          app_name?: string | null
          assessment_date?: string | null
          company_legal_name?: string | null
          created_at?: string
          id?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_role?: string | null
          registered_address?: string | null
          singleton?: boolean
          trading_name?: string | null
          updated_at?: string
          website?: string | null
          xero_api_usage?: string | null
          xero_client_id?: string | null
        }
        Relationships: []
      }
      signup_requests: {
        Row: {
          contact_name: string
          created_at: string
          email: string
          firm_name: string
          id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          email: string
          firm_name: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          email?: string
          firm_name?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          firm_id: string
          id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          firm_id: string
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          firm_id?: string
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: true
            referencedRelation: "admin_firm_overview"
            referencedColumns: ["firm_id"]
          },
          {
            foreignKeyName: "subscriptions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: true
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      xero_assessment_contact: {
        Row: {
          abn_acn: string | null
          address: string | null
          api_usage_description: string | null
          app_name: string | null
          assessment_date: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          id: string
          legal_name: string | null
          trading_name: string | null
          updated_at: string
          website: string | null
          xero_client_id: string | null
        }
        Insert: {
          abn_acn?: string | null
          address?: string | null
          api_usage_description?: string | null
          app_name?: string | null
          assessment_date?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          id?: string
          legal_name?: string | null
          trading_name?: string | null
          updated_at?: string
          website?: string | null
          xero_client_id?: string | null
        }
        Update: {
          abn_acn?: string | null
          address?: string | null
          api_usage_description?: string | null
          app_name?: string | null
          assessment_date?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          id?: string
          legal_name?: string | null
          trading_name?: string | null
          updated_at?: string
          website?: string | null
          xero_client_id?: string | null
        }
        Relationships: []
      }
      xero_connections: {
        Row: {
          access_token_enc: string | null
          base_currency: string | null
          created_at: string
          disconnected_at: string | null
          enc_version: number
          expires_at: string
          firm_id: string | null
          id: string
          refresh_token_enc: string | null
          scopes: string | null
          status: string
          tenant_id: string
          tenant_name: string
          tenant_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc?: string | null
          base_currency?: string | null
          created_at?: string
          disconnected_at?: string | null
          enc_version?: number
          expires_at: string
          firm_id?: string | null
          id?: string
          refresh_token_enc?: string | null
          scopes?: string | null
          status?: string
          tenant_id: string
          tenant_name: string
          tenant_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string | null
          base_currency?: string | null
          created_at?: string
          disconnected_at?: string | null
          enc_version?: number
          expires_at?: string
          firm_id?: string | null
          id?: string
          refresh_token_enc?: string | null
          scopes?: string | null
          status?: string
          tenant_id?: string
          tenant_name?: string
          tenant_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xero_connections_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "admin_firm_overview"
            referencedColumns: ["firm_id"]
          },
          {
            foreignKeyName: "xero_connections_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      xero_oauth_states: {
        Row: {
          client_id: string | null
          code_verifier: string | null
          created_at: string
          expires_at: string
          flow: string
          return_origin: string | null
          state: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          flow?: string
          return_origin?: string | null
          state: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          flow?: string
          return_origin?: string | null
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_firm_overview: {
        Row: {
          cancel_at_period_end: boolean | null
          connection_count: number | null
          current_period_end: string | null
          firm_created_at: string | null
          firm_id: string | null
          firm_name: string | null
          is_always_free: boolean | null
          recent_error_count: number | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          trial_ends_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_mfa_posture_counts: {
        Args: never
        Returns: {
          enrolled_admins: number
          enrolled_staff: number
          total_admins: number
          total_staff: number
        }[]
      }
      me_is_super_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "advisor"
        | "client_viewer"
        | "super_admin"
        | "firm_owner"
        | "firm_staff"
      dashboard_tier: "basic" | "advisory" | "investigate" | "multi_company"
      firm_member_role: "owner" | "staff"
      report_basis: "accrual" | "cash"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "unpaid"
      subscription_tier:
        | "starter"
        | "growth"
        | "scale"
        | "firm"
        | "legacy"
        | "free"
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
      app_role: [
        "advisor",
        "client_viewer",
        "super_admin",
        "firm_owner",
        "firm_staff",
      ],
      dashboard_tier: ["basic", "advisory", "investigate", "multi_company"],
      firm_member_role: ["owner", "staff"],
      report_basis: ["accrual", "cash"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "unpaid",
      ],
      subscription_tier: [
        "starter",
        "growth",
        "scale",
        "firm",
        "legacy",
        "free",
      ],
    },
  },
} as const
