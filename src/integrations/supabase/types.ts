export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
          consent_expires_at: string | null
          consent_id: string | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          error_message: string | null
          external_provider: string
          id: string
          institution_id: string
          last_error_at: string | null
          last_error_code: string | null
          last_successful_sync_at: string | null
          last_sync_at: string | null
          metadata: Json | null
          next_sync_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
          sync_interval_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_expires_at?: string | null
          consent_id?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          error_message?: string | null
          external_provider?: string
          id?: string
          institution_id: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          next_sync_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          sync_interval_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_expires_at?: string | null
          consent_id?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          error_message?: string | null
          external_provider?: string
          id?: string
          institution_id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_successful_sync_at?: string | null
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
          archived_at: string | null
          archived_by: string | null
          available_balance: number | null
          balance: number
          branch: string | null
          created_at: string
          credit_limit: number | null
          currency: string
          current_balance: number | null
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
          record_origin: string
          subtype: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          archived_at?: string | null
          archived_by?: string | null
          available_balance?: number | null
          balance?: number
          branch?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          current_balance?: number | null
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
          record_origin?: string
          subtype?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          archived_at?: string | null
          archived_by?: string | null
          available_balance?: number | null
          balance?: number
          branch?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          current_balance?: number | null
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
          record_origin?: string
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
          archived_at: string | null
          archived_by: string | null
          created_at: string
          description: string
          id: string
          read: boolean
          record_origin: string
          severity: Database["public"]["Enums"]["insight_severity"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string
          id?: string
          read?: boolean
          record_origin?: string
          severity?: Database["public"]["Enums"]["insight_severity"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string
          id?: string
          read?: boolean
          record_origin?: string
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
          archived_at: string | null
          archived_by: string | null
          category: string
          created_at: string
          id: string
          month: string
          planned: number
          record_origin: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          category: string
          created_at?: string
          id?: string
          month?: string
          planned?: number
          record_origin?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          category?: string
          created_at?: string
          id?: string
          month?: string
          planned?: number
          record_origin?: string
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
      external_transactions: {
        Row: {
          account_id: string
          amount: number
          authorized_at: string | null
          connection_id: string
          created_at: string
          currency: string
          description: string
          external_account_id: string
          external_id: string
          id: string
          mcc: string | null
          merchant_name: string | null
          posted_at: string
          processed_at: string | null
          provider: string
          raw_data: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
        }
        Insert: {
          account_id: string
          amount: number
          authorized_at?: string | null
          connection_id: string
          created_at?: string
          currency?: string
          description: string
          external_account_id: string
          external_id: string
          id?: string
          mcc?: string | null
          merchant_name?: string | null
          posted_at: string
          processed_at?: string | null
          provider: string
          raw_data?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
        }
        Update: {
          account_id?: string
          amount?: number
          authorized_at?: string | null
          connection_id?: string
          created_at?: string
          currency?: string
          description?: string
          external_account_id?: string
          external_id?: string
          id?: string
          mcc?: string | null
          merchant_name?: string | null
          posted_at?: string
          processed_at?: string | null
          provider?: string
          raw_data?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
        }
        Relationships: [
          {
            foreignKeyName: "external_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "external_transactions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "account_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          color: string
          created_at: string
          current_amount: number
          deadline: string | null
          id: string
          record_origin: string
          target_amount: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          color?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          record_origin?: string
          target_amount?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          color?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          record_origin?: string
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
          archived_at: string | null
          archived_by: string | null
          asset_class: Database["public"]["Enums"]["asset_class"]
          average_price: number
          created_at: string
          current_price: number
          id: string
          name: string
          quantity: number
          record_origin: string
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          asset_class?: Database["public"]["Enums"]["asset_class"]
          average_price?: number
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          quantity?: number
          record_origin?: string
          ticker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          asset_class?: Database["public"]["Enums"]["asset_class"]
          average_price?: number
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          quantity?: number
          record_origin?: string
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
      journal_entries: {
        Row: {
          created_at: string
          description: string
          entry_date: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          entry_date: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          amount: number
          currency: string
          description: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          journal_entry_id: string
          ledger_account_id: string
          sort_order: number
        }
        Insert: {
          amount: number
          currency?: string
          description?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          journal_entry_id: string
          ledger_account_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          currency?: string
          description?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          journal_entry_id?: string
          ledger_account_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          account_id: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          parent_id: string | null
          sort_order: number
          subtype: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          subtype?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          subtype?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "ledger_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
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
      openfinance_sync_errors: {
        Row: {
          connection_id: string
          created_at: string
          entity: string
          error_code: string
          id: string
          message: string
          provider: string
          provider_error: string | null
          sync_id: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          entity: string
          error_code: string
          id?: string
          message: string
          provider: string
          provider_error?: string | null
          sync_id?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          entity?: string
          error_code?: string
          id?: string
          message?: string
          provider?: string
          provider_error?: string | null
          sync_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "openfinance_sync_errors_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "account_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "openfinance_sync_errors_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "openfinance_syncs"
            referencedColumns: ["id"]
          },
        ]
      }
      openfinance_syncs: {
        Row: {
          accounts_imported: number
          balances_imported: number
          connection_id: string
          created_at: string
          duplicates_skipped: number
          duration_ms: number | null
          errors: Json | null
          id: string
          investments_imported: number
          provider: string
          status: Database["public"]["Enums"]["sync_status"]
          transactions_imported: number
        }
        Insert: {
          accounts_imported?: number
          balances_imported?: number
          connection_id: string
          created_at?: string
          duplicates_skipped?: number
          duration_ms?: number | null
          errors?: Json | null
          id?: string
          investments_imported?: number
          provider: string
          status?: Database["public"]["Enums"]["sync_status"]
          transactions_imported?: number
        }
        Update: {
          accounts_imported?: number
          balances_imported?: number
          connection_id?: string
          created_at?: string
          duplicates_skipped?: number
          duration_ms?: number | null
          errors?: Json | null
          id?: string
          investments_imported?: number
          provider?: string
          status?: Database["public"]["Enums"]["sync_status"]
          transactions_imported?: number
        }
        Relationships: [
          {
            foreignKeyName: "openfinance_syncs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "account_connections"
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
          archived_at: string | null
          archived_by: string | null
          barcode: string | null
          category: string
          confirmation_token: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          pix_key: string | null
          recurring: boolean
          record_origin: string
          scheduled_for: string | null
          status: Database["public"]["Enums"]["bill_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          archived_at?: string | null
          archived_by?: string | null
          barcode?: string | null
          category?: string
          confirmation_token?: string | null
          created_at?: string
          description: string
          due_date?: string
          id?: string
          pix_key?: string | null
          recurring?: boolean
          record_origin?: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          archived_at?: string | null
          archived_by?: string | null
          barcode?: string | null
          category?: string
          confirmation_token?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          pix_key?: string | null
          recurring?: boolean
          record_origin?: string
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
      provider_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          external_event_id: string
          id: string
          payload_hash: string | null
          processed_at: string | null
          provider: string
          status: Database["public"]["Enums"]["webhook_event_status"]
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          external_event_id: string
          id?: string
          payload_hash?: string | null
          processed_at?: string | null
          provider: string
          status?: Database["public"]["Enums"]["webhook_event_status"]
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          external_event_id?: string
          id?: string
          payload_hash?: string | null
          processed_at?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["webhook_event_status"]
        }
        Relationships: []
      }
      receivables: {
        Row: {
          account_id: string | null
          amount: number
          archived_at: string | null
          archived_by: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          payer: string
          recurring: boolean
          record_origin: string
          status: Database["public"]["Enums"]["bill_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description: string
          due_date?: string
          id?: string
          payer?: string
          recurring?: boolean
          record_origin?: string
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          payer?: string
          recurring?: boolean
          record_origin?: string
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
          archived_at: string | null
          archived_by: string | null
          asset_class: Database["public"]["Enums"]["asset_class"]
          created_at: string
          gross_amount: number
          id: string
          kind: string
          occurred_at: string
          profit: number
          record_origin: string
          ticker: string
          updated_at: string
          user_id: string
          withheld: number
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          asset_class?: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          gross_amount?: number
          id?: string
          kind?: string
          occurred_at?: string
          profit?: number
          record_origin?: string
          ticker?: string
          updated_at?: string
          user_id: string
          withheld?: number
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          asset_class?: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          gross_amount?: number
          id?: string
          kind?: string
          occurred_at?: string
          profit?: number
          record_origin?: string
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
          icon: string | null
          id: string
          is_system: boolean
          kind: string
          label: string
          name: string | null
          parent_code: string | null
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          kind?: string
          label: string
          name?: string | null
          parent_code?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          kind?: string
          label?: string
          name?: string | null
          parent_code?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_enrichments: {
        Row: {
          applied_by: string | null
          category_id: string | null
          confidence: number
          created_at: string
          id: string
          model_version: string | null
          reason: string | null
          source: Database["public"]["Enums"]["categorization_source"]
          subcategory_id: string | null
          transaction_id: string
        }
        Insert: {
          applied_by?: string | null
          category_id?: string | null
          confidence?: number
          created_at?: string
          id?: string
          model_version?: string | null
          reason?: string | null
          source: Database["public"]["Enums"]["categorization_source"]
          subcategory_id?: string | null
          transaction_id: string
        }
        Update: {
          applied_by?: string | null
          category_id?: string | null
          confidence?: number
          created_at?: string
          id?: string
          model_version?: string | null
          reason?: string | null
          source?: Database["public"]["Enums"]["categorization_source"]
          subcategory_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_enrichments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_enrichments_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_enrichments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_pairs: {
        Row: {
          amount: number
          confidence: number
          credit_transaction_id: string
          currency: string
          debit_transaction_id: string
          id: string
          is_manual: boolean
          matched_at: string
          user_id: string
        }
        Insert: {
          amount: number
          confidence?: number
          credit_transaction_id: string
          currency?: string
          debit_transaction_id: string
          id?: string
          is_manual?: boolean
          matched_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          confidence?: number
          credit_transaction_id?: string
          currency?: string
          debit_transaction_id?: string
          id?: string
          is_manual?: boolean
          matched_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_pairs_credit_transaction_id_fkey"
            columns: ["credit_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_pairs_debit_transaction_id_fkey"
            columns: ["debit_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          archived_at: string | null
          archived_by: string | null
          authorized_at: string | null
          category: string
          category_id: string | null
          created_at: string
          currency: string
          description: string
          external_id: string | null
          external_transaction_id: string | null
          id: string
          is_recurring: boolean
          is_transfer: boolean
          merchant: string | null
          merchant_name: string | null
          metadata: Json | null
          method: string | null
          occurred_at: string
          posted_at: string | null
          record_origin: string
          status: Database["public"]["Enums"]["transaction_status"]
          subcategory_id: string | null
          transfer_pair_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          archived_at?: string | null
          archived_by?: string | null
          authorized_at?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          description: string
          external_id?: string | null
          external_transaction_id?: string | null
          id?: string
          is_recurring?: boolean
          is_transfer?: boolean
          merchant?: string | null
          merchant_name?: string | null
          metadata?: Json | null
          method?: string | null
          occurred_at?: string
          posted_at?: string | null
          record_origin?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          subcategory_id?: string | null
          transfer_pair_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          archived_at?: string | null
          archived_by?: string | null
          authorized_at?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          external_id?: string | null
          external_transaction_id?: string | null
          id?: string
          is_recurring?: boolean
          is_transfer?: boolean
          merchant?: string | null
          merchant_name?: string | null
          metadata?: Json | null
          method?: string | null
          occurred_at?: string
          posted_at?: string | null
          record_origin?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          subcategory_id?: string | null
          transfer_pair_id?: string | null
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
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_external_transaction_id_fkey"
            columns: ["external_transaction_id"]
            isOneToOne: false
            referencedRelation: "external_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_categorization_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          pattern: string
          priority: number
          subcategory_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pattern: string
          priority?: number
          subcategory_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pattern?: string
          priority?: number
          subcategory_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_categorization_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
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
      create_journal_entry: {
        Args: {
          p_description: string
          p_entry_date: string
          p_lines: Json
          p_metadata?: Json
          p_reference_id?: string
          p_reference_type?: string
          p_source?: string
        }
        Returns: string
      }
      create_transaction_from_external: {
        Args: { p_external_transaction_id: string }
        Returns: string
      }
      detect_transfer_candidates: {
        Args: { p_user_id: string; p_window_days?: number }
        Returns: Json
      }
      get_cashflow_projection: {
        Args: { horizon_days?: number }
        Returns: {
          expenses: number
          income: number
          month: string
          projected: number
        }[]
      }
      get_ledger_balances: { Args: { p_as_of_date?: string }; Returns: Json }
      get_security_summary: { Args: never; Returns: Json }
      get_sync_errors: {
        Args: { p_connection_id: string; p_limit?: number }
        Returns: Json
      }
      get_sync_history: {
        Args: { p_connection_id: string; p_limit?: number }
        Returns: Json
      }
      get_transactions_summary: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
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
      pair_transfer: {
        Args: {
          p_credit_transaction_id: string
          p_debit_transaction_id: string
          p_is_manual?: boolean
        }
        Returns: string
      }
      refresh_account_balances_view: { Args: never; Returns: undefined }
      revoke_all_sessions: { Args: never; Returns: number }
      revoke_device: { Args: { p_device_id: string }; Returns: boolean }
      seed_default_ledger_accounts: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      set_primary_account: { Args: { p_account_id: string }; Returns: boolean }
      trigger_sync: { Args: { p_connection_id: string }; Returns: Json }
      upsert_account: { Args: { p_data: Json }; Returns: string }
      upsert_transaction_idempotent: {
        Args: { p_data: Json; p_idempotency_key: string }
        Returns: string
      }
    }
    Enums: {
      account_type: "checking" | "savings" | "credit" | "investment"
      asset_class: "stock" | "fii" | "fixed_income" | "crypto" | "fund" | "etf" | "cash"
      bill_status: "pending" | "paid" | "overdue" | "canceled"
      card_brand: "visa" | "mastercard" | "elo" | "amex" | "other"
      categorization_source: "mcc" | "rule" | "user" | "ml" | "llm" | "manual"
      connection_status: "active" | "inactive" | "error" | "pending"
      consent_status: "pending" | "authorised" | "revoked" | "expired"
      insight_severity: "info" | "warning" | "critical"
      ledger_entry_type: "debit" | "credit"
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
      sync_status: "pending" | "running" | "completed" | "failed" | "cancelled"
      transaction_status: "pending" | "settled" | "cancelled" | "failed" | "reversed"
      transaction_type: "income" | "expense" | "transfer"
      webhook_event_status: "received" | "processing" | "processed" | "failed" | "duplicate"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      asset_class: ["stock", "fii", "fixed_income", "crypto", "fund", "etf", "cash"],
      bill_status: ["pending", "paid", "overdue", "canceled"],
      card_brand: ["visa", "mastercard", "elo", "amex", "other"],
      categorization_source: ["mcc", "rule", "user", "ml", "llm", "manual"],
      connection_status: ["active", "inactive", "error", "pending"],
      consent_status: ["pending", "authorised", "revoked", "expired"],
      insight_severity: ["info", "warning", "critical"],
      ledger_entry_type: ["debit", "credit"],
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
      sync_status: ["pending", "running", "completed", "failed", "cancelled"],
      transaction_status: ["pending", "settled", "cancelled", "failed", "reversed"],
      transaction_type: ["income", "expense", "transfer"],
      webhook_event_status: ["received", "processing", "processed", "failed", "duplicate"],
    },
  },
} as const
