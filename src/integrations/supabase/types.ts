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
      account_balances: {
        Row: {
          account_id: string
          available_balance: number | null
          balance: number
          created_at: string
          id: string
          snapshot_date: string
          source: string
          user_id: string
        }
        Insert: {
          account_id: string
          available_balance?: number | null
          balance?: number
          created_at?: string
          id?: string
          snapshot_date?: string
          source?: string
          user_id: string
        }
        Update: {
          account_id?: string
          available_balance?: number | null
          balance?: number
          created_at?: string
          id?: string
          snapshot_date?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_balances"
            referencedColumns: ["account_id"]
          },
        ]
      }
      account_connections: {
        Row: {
          consent_id: string | null
          created_at: string
          error_message: string | null
          external_provider: string
          id: string
          institution_id: string
          last_sync_at: string | null
          metadata: Json | null
          next_sync_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
          sync_interval_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_id?: string | null
          created_at?: string
          error_message?: string | null
          external_provider?: string
          id?: string
          institution_id: string
          last_sync_at?: string | null
          metadata?: Json | null
          next_sync_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          sync_interval_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_id?: string | null
          created_at?: string
          error_message?: string | null
          external_provider?: string
          id?: string
          institution_id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          next_sync_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          sync_interval_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_connections_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "openfinance_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_connections_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          available_balance: number | null
          balance: number
          branch: string | null
          created_at: string
          credit_limit: number | null
          currency: string
          external_id: string | null
          id: string
          institution: string
          institution_id: string | null
          is_archived: boolean
          is_manual: boolean
          is_primary: boolean
          last_sync_at: string | null
          metadata: Json | null
          name: string
          open_finance: boolean
          subtype: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          available_balance?: number | null
          balance?: number
          branch?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          external_id?: string | null
          id?: string
          institution?: string
          institution_id?: string | null
          is_archived?: boolean
          is_manual?: boolean
          is_primary?: boolean
          last_sync_at?: string | null
          metadata?: Json | null
          name: string
          open_finance?: boolean
          subtype?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          available_balance?: number | null
          balance?: number
          branch?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          external_id?: string | null
          id?: string
          institution?: string
          institution_id?: string | null
          is_archived?: boolean
          is_manual?: boolean
          is_primary?: boolean
          last_sync_at?: string | null
          metadata?: Json | null
          name?: string
          open_finance?: boolean
          subtype?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_insights: {
        Row: {
          created_at: string
          description: string
          id: string
          read: boolean
          severity: Database["public"]["Enums"]["insight_severity"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          read?: boolean
          severity?: Database["public"]["Enums"]["insight_severity"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          read?: boolean
          severity?: Database["public"]["Enums"]["insight_severity"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_memories: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          importance: number
          memory_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          memory_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          memory_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          country: string | null
          created_at: string
          device_id: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          month: string
          planned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          month?: string
          planned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          month?: string
          planned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          account_id: string
          available_limit: number | null
          brand: Database["public"]["Enums"]["card_brand"]
          closing_day: number | null
          created_at: string
          credit_limit: number
          due_day: number | null
          expiration_month: number | null
          expiration_year: number | null
          holder_name: string
          id: string
          is_virtual: boolean
          last_four: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          available_limit?: number | null
          brand?: Database["public"]["Enums"]["card_brand"]
          closing_day?: number | null
          created_at?: string
          credit_limit?: number
          due_day?: number | null
          expiration_month?: number | null
          expiration_year?: number | null
          holder_name?: string
          id?: string
          is_virtual?: boolean
          last_four: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          available_limit?: number | null
          brand?: Database["public"]["Enums"]["card_brand"]
          closing_day?: number | null
          created_at?: string
          credit_limit?: number
          due_day?: number | null
          expiration_month?: number | null
          expiration_year?: number | null
          holder_name?: string
          id?: string
          is_virtual?: boolean
          last_four?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_balances"
            referencedColumns: ["account_id"]
          },
        ]
      }
      goals: {
        Row: {
          color: string
          created_at: string
          current_amount: number
          deadline: string | null
          id: string
          target_amount: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          target_amount?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          target_amount?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          code: string
          created_at: string
          id: string
          logo_color: string
          name: string
          openfinance_participant: boolean
          short_name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          logo_color?: string
          name: string
          openfinance_participant?: boolean
          short_name?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          logo_color?: string
          name?: string
          openfinance_participant?: boolean
          short_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      investment_positions: {
        Row: {
          account_id: string | null
          asset_class: Database["public"]["Enums"]["asset_class"]
          average_price: number
          created_at: string
          current_price: number
          id: string
          name: string
          quantity: number
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          asset_class?: Database["public"]["Enums"]["asset_class"]
          average_price?: number
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          quantity?: number
          ticker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          asset_class?: Database["public"]["Enums"]["asset_class"]
          average_price?: number
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          quantity?: number
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_balances"
            referencedColumns: ["account_id"]
          },
        ]
      }
      net_worth_snapshots: {
        Row: {
          created_at: string
          id: string
          liquidity: number
          month: string
          net_worth: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liquidity?: number
          month?: string
          net_worth?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liquidity?: number
          month?: string
          net_worth?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          channel: string
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      openfinance_consents: {
        Row: {
          code_verifier: string | null
          consent_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          institution_id: string
          last_synced_at: string | null
          scopes: string[]
          state: string | null
          status: Database["public"]["Enums"]["consent_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          consent_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id: string
          last_synced_at?: string | null
          scopes?: string[]
          state?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          consent_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          institution_id?: string
          last_synced_at?: string | null
          scopes?: string[]
          state?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "openfinance_consents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      openfinance_tokens: {
        Row: {
          consent_id: string
          created_at: string
          encrypted_access_token: string
          encrypted_refresh_token: string | null
          expires_at: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_id: string
          created_at?: string
          encrypted_access_token: string
          encrypted_refresh_token?: string | null
          expires_at?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_id?: string
          created_at?: string
          encrypted_access_token?: string
          encrypted_refresh_token?: string | null
          expires_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "openfinance_tokens_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "openfinance_consents"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          account_id: string | null
          amount: number
          barcode: string | null
          category: string
          confirmation_token: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          pix_key: string | null
          recurring: boolean
          scheduled_for: string | null
          status: Database["public"]["Enums"]["bill_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          barcode?: string | null
          category?: string
          confirmation_token?: string | null
          created_at?: string
          description: string
          due_date?: string
          id?: string
          pix_key?: string | null
          recurring?: boolean
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          barcode?: string | null
          category?: string
          confirmation_token?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          pix_key?: string | null
          recurring?: boolean
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_balances"
            referencedColumns: ["account_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          description: string
          due_date: string
          id: string
          payer: string
          recurring: boolean
          status: Database["public"]["Enums"]["bill_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string
          description: string
          due_date?: string
          id?: string
          payer?: string
          recurring?: boolean
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          payer?: string
          recurring?: boolean
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_balances"
            referencedColumns: ["account_id"]
          },
        ]
      }
      security_events: {
        Row: {
          country: string | null
          created_at: string
          device_id: string | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          ip_address: unknown
          metadata: Json | null
          severity: Database["public"]["Enums"]["severity_level"]
          user_agent: string | null
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device_id?: string | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          severity?: Database["public"]["Enums"]["severity_level"]
          user_agent?: string | null
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device_id?: string | null
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          severity?: Database["public"]["Enums"]["severity_level"]
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tax_events: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          created_at: string
          gross_amount: number
          id: string
          kind: string
          occurred_at: string
          profit: number
          ticker: string
          updated_at: string
          user_id: string
          withheld: number
        }
        Insert: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          gross_amount?: number
          id?: string
          kind?: string
          occurred_at?: string
          profit?: number
          ticker?: string
          updated_at?: string
          user_id: string
          withheld?: number
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          gross_amount?: number
          id?: string
          kind?: string
          occurred_at?: string
          profit?: number
          ticker?: string
          updated_at?: string
          user_id?: string
          withheld?: number
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          kind: string
          label: string
          parent_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          kind?: string
          label: string
          parent_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          parent_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          description: string
          external_id: string | null
          id: string
          merchant: string | null
          method: string | null
          occurred_at: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string
          created_at?: string
          description: string
          external_id?: string | null
          id?: string
          merchant?: string | null
          method?: string | null
          occurred_at?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          description?: string
          external_id?: string | null
          id?: string
          merchant?: string | null
          method?: string | null
          occurred_at?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_balances"
            referencedColumns: ["account_id"]
          },
        ]
      }
      user_devices: {
        Row: {
          browser: string | null
          created_at: string
          device_fingerprint: string
          device_name: string
          device_type: string
          id: string
          is_trusted: boolean
          last_seen_at: string
          os: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_fingerprint: string
          device_name?: string
          device_type?: string
          id?: string
          is_trusted?: boolean
          last_seen_at?: string
          os?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_fingerprint?: string
          device_name?: string
          device_type?: string
          id?: string
          is_trusted?: boolean
          last_seen_at?: string
          os?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions_metadata: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_id: string | null
          ended_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean
          last_activity_at: string
          session_token_hash: string | null
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean
          last_activity_at?: string
          session_token_hash?: string | null
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean
          last_activity_at?: string
          session_token_hash?: string | null
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_metadata_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_account_balances: {
        Row: {
          account_id: string | null
          account_name: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          available_balance: number | null
          currency: string | null
          current_balance: number | null
          institution: string | null
          institution_name: string | null
          is_primary: boolean | null
          last_sync_at: string | null
          logo_color: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_account: { Args: { p_account_id: string }; Returns: boolean }
      calculate_irpf_monthly: {
        Args: { p_month: number; p_year: number }
        Returns: Json
      }
      create_balance_snapshot: {
        Args: {
          p_account_id: string
          p_available_balance?: number
          p_balance: number
        }
        Returns: string
      }
      create_connection: { Args: { p_data: Json }; Returns: string }
      get_cashflow_projection: {
        Args: { horizon_days?: number }
        Returns: {
          expenses: number
          income: number
          month: string
          projected: number
        }[]
      }
      get_security_summary: { Args: never; Returns: Json }
      get_wallet_summary: { Args: never; Returns: Json }
      log_security_event: {
        Args: {
          p_country?: string
          p_device_id?: string
          p_event_type: Database["public"]["Enums"]["security_event_type"]
          p_ip_address?: unknown
          p_metadata?: Json
          p_severity?: Database["public"]["Enums"]["severity_level"]
          p_user_agent?: string
        }
        Returns: string
      }
      match_agent_memories: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          memory_type: string
          similarity: number
        }[]
      }
      refresh_account_balances_view: { Args: never; Returns: undefined }
      revoke_all_sessions: { Args: never; Returns: number }
      revoke_device: { Args: { p_device_id: string }; Returns: boolean }
      set_primary_account: { Args: { p_account_id: string }; Returns: boolean }
      upsert_account: { Args: { p_data: Json }; Returns: string }
      upsert_transaction_idempotent: {
        Args: { p_data: Json; p_idempotency_key: string }
        Returns: string
      }
    }
    Enums: {
      account_type: "checking" | "savings" | "credit" | "investment"
      asset_class:
        | "stock"
        | "fii"
        | "fixed_income"
        | "crypto"
        | "fund"
        | "etf"
        | "cash"
      bill_status: "pending" | "paid" | "overdue" | "canceled"
      card_brand: "visa" | "mastercard" | "elo" | "amex" | "other"
      connection_status: "active" | "inactive" | "error" | "pending"
      consent_status: "pending" | "authorised" | "revoked" | "expired"
      insight_severity: "info" | "warning" | "critical"
      security_event_type:
        | "login"
        | "logout"
        | "login_failed"
        | "mfa_enabled"
        | "mfa_disabled"
        | "mfa_challenge_success"
        | "mfa_challenge_failed"
        | "password_changed"
        | "password_reset_requested"
        | "password_reset_completed"
        | "account_connected"
        | "account_removed"
        | "consent_created"
        | "consent_revoked"
        | "payment_created"
        | "payment_confirmed"
        | "payment_cancelled"
        | "payment_settled"
        | "profile_changed"
        | "investment_simulation"
        | "recommendation_generated"
        | "data_exported"
        | "account_deleted"
        | "session_revoked"
        | "device_added"
        | "device_removed"
        | "suspicious_activity"
      severity_level: "low" | "medium" | "high" | "critical"
      transaction_type: "income" | "expense" | "transfer"
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
      account_type: ["checking", "savings", "credit", "investment"],
      asset_class: [
        "stock",
        "fii",
        "fixed_income",
        "crypto",
        "fund",
        "etf",
        "cash",
      ],
      bill_status: ["pending", "paid", "overdue", "canceled"],
      card_brand: ["visa", "mastercard", "elo", "amex", "other"],
      connection_status: ["active", "inactive", "error", "pending"],
      consent_status: ["pending", "authorised", "revoked", "expired"],
      insight_severity: ["info", "warning", "critical"],
      security_event_type: [
        "login",
        "logout",
        "login_failed",
        "mfa_enabled",
        "mfa_disabled",
        "mfa_challenge_success",
        "mfa_challenge_failed",
        "password_changed",
        "password_reset_requested",
        "password_reset_completed",
        "account_connected",
        "account_removed",
        "consent_created",
        "consent_revoked",
        "payment_created",
        "payment_confirmed",
        "payment_cancelled",
        "payment_settled",
        "profile_changed",
        "investment_simulation",
        "recommendation_generated",
        "data_exported",
        "account_deleted",
        "session_revoked",
        "device_added",
        "device_removed",
        "suspicious_activity",
      ],
      severity_level: ["low", "medium", "high", "critical"],
      transaction_type: ["income", "expense", "transfer"],
    },
  },
} as const
