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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          last_used_at: string | null
          name: string
          permissions: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          last_used_at?: string | null
          name: string
          permissions?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          api_key_id: string | null
          endpoint: string
          id: string
          ip_address: unknown
          response_time_ms: number | null
          status_code: number | null
          timestamp: string | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          endpoint: string
          id?: string
          ip_address?: unknown
          response_time_ms?: number | null
          status_code?: number | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          endpoint?: string
          id?: string
          ip_address?: unknown
          response_time_ms?: number | null
          status_code?: number | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_import_log: {
        Row: {
          artisan_version: string | null
          file_size: number | null
          filename: string | null
          import_id: number
          import_timestamp: string | null
          original_data: Json | null
          processing_messages: string[] | null
          processing_status: string | null
          roast_id: number | null
          total_data_points: number | null
          user_id: string
        }
        Insert: {
          artisan_version?: string | null
          file_size?: number | null
          filename?: string | null
          import_id?: number
          import_timestamp?: string | null
          original_data?: Json | null
          processing_messages?: string[] | null
          processing_status?: string | null
          roast_id?: number | null
          total_data_points?: number | null
          user_id: string
        }
        Update: {
          artisan_version?: string | null
          file_size?: number | null
          filename?: string | null
          import_id?: number
          import_timestamp?: string | null
          original_data?: Json | null
          processing_messages?: string[] | null
          processing_status?: string | null
          roast_id?: number | null
          total_data_points?: number | null
          user_id?: string
        }
        Relationships: []
      }
      coffee_catalog: {
        Row: {
          ai_description: string | null
          ai_tasting_notes: Json | null
          appearance: string | null
          arrival_date: string | null
          bag_size: string | null
          coffee_user: string | null
          continent: string | null
          cost_lb: number | null
          country: string | null
          cultivar_detail: string | null
          cupping_notes: string | null
          description_long: string | null
          description_short: string | null
          drying_method: string | null
          farm_notes: string | null
          grade: string | null
          id: number
          last_updated: string | null
          link: string | null
          lot_size: string | null
          name: string
          packaging: string | null
          processing: string | null
          public_coffee: boolean | null
          region: string | null
          roast_recs: string | null
          score_value: number | null
          source: string | null
          stocked: boolean | null
          stocked_date: string | null
          type: string | null
          unstocked_date: string | null
        }
        Insert: {
          ai_description?: string | null
          ai_tasting_notes?: Json | null
          appearance?: string | null
          arrival_date?: string | null
          bag_size?: string | null
          coffee_user?: string | null
          continent?: string | null
          cost_lb?: number | null
          country?: string | null
          cultivar_detail?: string | null
          cupping_notes?: string | null
          description_long?: string | null
          description_short?: string | null
          drying_method?: string | null
          farm_notes?: string | null
          grade?: string | null
          id?: number
          last_updated?: string | null
          link?: string | null
          lot_size?: string | null
          name: string
          packaging?: string | null
          processing?: string | null
          public_coffee?: boolean | null
          region?: string | null
          roast_recs?: string | null
          score_value?: number | null
          source?: string | null
          stocked?: boolean | null
          stocked_date?: string | null
          type?: string | null
          unstocked_date?: string | null
        }
        Update: {
          ai_description?: string | null
          ai_tasting_notes?: Json | null
          appearance?: string | null
          arrival_date?: string | null
          bag_size?: string | null
          coffee_user?: string | null
          continent?: string | null
          cost_lb?: number | null
          country?: string | null
          cultivar_detail?: string | null
          cupping_notes?: string | null
          description_long?: string | null
          description_short?: string | null
          drying_method?: string | null
          farm_notes?: string | null
          grade?: string | null
          id?: number
          last_updated?: string | null
          link?: string | null
          lot_size?: string | null
          name?: string
          packaging?: string | null
          processing?: string | null
          public_coffee?: boolean | null
          region?: string | null
          roast_recs?: string | null
          score_value?: number | null
          source?: string | null
          stocked?: boolean | null
          stocked_date?: string | null
          type?: string | null
          unstocked_date?: string | null
        }
        Relationships: []
      }
      coffee_chunks: {
        Row: {
          chunk_type: string
          coffee_id: number | null
          content: string
          created_at: string | null
          embedding: string
          id: string
          metadata: Json
          updated_at: string | null
        }
        Insert: {
          chunk_type: string
          coffee_id?: number | null
          content: string
          created_at?: string | null
          embedding: string
          id: string
          metadata: Json
          updated_at?: string | null
        }
        Update: {
          chunk_type?: string
          coffee_id?: number | null
          content?: string
          created_at?: string | null
          embedding?: string
          id?: string
          metadata?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coffee_chunks_coffee_id_fkey"
            columns: ["coffee_id"]
            isOneToOne: false
            referencedRelation: "coffee_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      green_coffee_inv: {
        Row: {
          bean_cost: number | null
          catalog_id: number | null
          cupping_notes: Json | null
          id: number
          last_updated: string | null
          notes: string | null
          purchase_date: string | null
          purchased_qty_lbs: number | null
          rank: number | null
          stocked: boolean | null
          tax_ship_cost: number | null
          user: string | null
        }
        Insert: {
          bean_cost?: number | null
          catalog_id?: number | null
          cupping_notes?: Json | null
          id?: number
          last_updated?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchased_qty_lbs?: number | null
          rank?: number | null
          stocked?: boolean | null
          tax_ship_cost?: number | null
          user?: string | null
        }
        Update: {
          bean_cost?: number | null
          catalog_id?: number | null
          cupping_notes?: Json | null
          id?: number
          last_updated?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchased_qty_lbs?: number | null
          rank?: number | null
          stocked?: boolean | null
          tax_ship_cost?: number | null
          user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "green_coffee_inv_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "coffee_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "green_coffee_inv_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roast_events: {
        Row: {
          automatic: boolean | null
          category: string | null
          created_at: string | null
          event_id: number
          event_string: string | null
          event_type: number
          event_value: string | null
          notes: string | null
          roast_id: number
          subcategory: string | null
          time_seconds: number
          user_generated: boolean | null
        }
        Insert: {
          automatic?: boolean | null
          category?: string | null
          created_at?: string | null
          event_id?: number
          event_string?: string | null
          event_type: number
          event_value?: string | null
          notes?: string | null
          roast_id: number
          subcategory?: string | null
          time_seconds: number
          user_generated?: boolean | null
        }
        Update: {
          automatic?: boolean | null
          category?: string | null
          created_at?: string | null
          event_id?: number
          event_string?: string | null
          event_type?: number
          event_value?: string | null
          notes?: string | null
          roast_id?: number
          subcategory?: string | null
          time_seconds?: number
          user_generated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "roast_events_roast_id_fkey"
            columns: ["roast_id"]
            isOneToOne: false
            referencedRelation: "roast_profiles"
            referencedColumns: ["roast_id"]
          },
        ]
      }
      roast_profiles: {
        Row: {
          auc: number | null
          batch_name: string
          charge_temp: number | null
          charge_time: number | null
          chart_x_max: number | null
          chart_x_min: number | null
          chart_y_max: number | null
          chart_y_min: number | null
          chart_z_max: number | null
          chart_z_min: number | null
          coffee_id: number
          coffee_name: string
          cool_temp: number | null
          cool_time: number | null
          data_source: string | null
          development_percent: number | null
          drop_temp: number | null
          drop_time: number | null
          dry_end_temp: number | null
          dry_end_time: number | null
          dry_percent: number | null
          dry_phase_delta_temp: number | null
          dry_phase_ror: number | null
          fc_end_temp: number | null
          fc_end_time: number | null
          fc_start_temp: number | null
          fc_start_time: number | null
          finish_phase_ror: number | null
          last_updated: string | null
          maillard_percent: number | null
          mid_phase_ror: number | null
          oz_in: number | null
          oz_out: number | null
          roast_date: string
          roast_id: number
          roast_notes: string | null
          roast_targets: string | null
          roast_uuid: string | null
          roaster_size: number | null
          roaster_type: string | null
          sc_start_temp: number | null
          sc_start_time: number | null
          temperature_unit: string | null
          total_roast_time: number | null
          total_ror: number | null
          tp_temp: number | null
          tp_time: number | null
          user: string | null
          weight_loss_percent: number | null
        }
        Insert: {
          auc?: number | null
          batch_name: string
          charge_temp?: number | null
          charge_time?: number | null
          chart_x_max?: number | null
          chart_x_min?: number | null
          chart_y_max?: number | null
          chart_y_min?: number | null
          chart_z_max?: number | null
          chart_z_min?: number | null
          coffee_id: number
          coffee_name: string
          cool_temp?: number | null
          cool_time?: number | null
          data_source?: string | null
          development_percent?: number | null
          drop_temp?: number | null
          drop_time?: number | null
          dry_end_temp?: number | null
          dry_end_time?: number | null
          dry_percent?: number | null
          dry_phase_delta_temp?: number | null
          dry_phase_ror?: number | null
          fc_end_temp?: number | null
          fc_end_time?: number | null
          fc_start_temp?: number | null
          fc_start_time?: number | null
          finish_phase_ror?: number | null
          last_updated?: string | null
          maillard_percent?: number | null
          mid_phase_ror?: number | null
          oz_in?: number | null
          oz_out?: number | null
          roast_date: string
          roast_id?: number
          roast_notes?: string | null
          roast_targets?: string | null
          roast_uuid?: string | null
          roaster_size?: number | null
          roaster_type?: string | null
          sc_start_temp?: number | null
          sc_start_time?: number | null
          temperature_unit?: string | null
          total_roast_time?: number | null
          total_ror?: number | null
          tp_temp?: number | null
          tp_time?: number | null
          user?: string | null
          weight_loss_percent?: number | null
        }
        Update: {
          auc?: number | null
          batch_name?: string
          charge_temp?: number | null
          charge_time?: number | null
          chart_x_max?: number | null
          chart_x_min?: number | null
          chart_y_max?: number | null
          chart_y_min?: number | null
          chart_z_max?: number | null
          chart_z_min?: number | null
          coffee_id?: number
          coffee_name?: string
          cool_temp?: number | null
          cool_time?: number | null
          data_source?: string | null
          development_percent?: number | null
          drop_temp?: number | null
          drop_time?: number | null
          dry_end_temp?: number | null
          dry_end_time?: number | null
          dry_percent?: number | null
          dry_phase_delta_temp?: number | null
          dry_phase_ror?: number | null
          fc_end_temp?: number | null
          fc_end_time?: number | null
          fc_start_temp?: number | null
          fc_start_time?: number | null
          finish_phase_ror?: number | null
          last_updated?: string | null
          maillard_percent?: number | null
          mid_phase_ror?: number | null
          oz_in?: number | null
          oz_out?: number | null
          roast_date?: string
          roast_id?: number
          roast_notes?: string | null
          roast_targets?: string | null
          roast_uuid?: string | null
          roaster_size?: number | null
          roaster_type?: string | null
          sc_start_temp?: number | null
          sc_start_time?: number | null
          temperature_unit?: string | null
          total_roast_time?: number | null
          total_ror?: number | null
          tp_temp?: number | null
          tp_time?: number | null
          user?: string | null
          weight_loss_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roast_profiles_coffee_id_fkey"
            columns: ["coffee_id"]
            isOneToOne: false
            referencedRelation: "green_coffee_inv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roast_profiles_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roast_temperatures: {
        Row: {
          ambient_temp: number | null
          bean_temp: number | null
          created_at: string | null
          data_quality: string | null
          data_source: string | null
          environmental_temp: number | null
          inlet_temp: number | null
          roast_id: number
          ror_bean_temp: number | null
          temp_id: number
          time_seconds: number
        }
        Insert: {
          ambient_temp?: number | null
          bean_temp?: number | null
          created_at?: string | null
          data_quality?: string | null
          data_source?: string | null
          environmental_temp?: number | null
          inlet_temp?: number | null
          roast_id: number
          ror_bean_temp?: number | null
          temp_id?: number
          time_seconds: number
        }
        Update: {
          ambient_temp?: number | null
          bean_temp?: number | null
          created_at?: string | null
          data_quality?: string | null
          data_source?: string | null
          environmental_temp?: number | null
          inlet_temp?: number | null
          roast_id?: number
          ror_bean_temp?: number | null
          temp_id?: number
          time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "roast_temperatures_roast_id_fkey"
            columns: ["roast_id"]
            isOneToOne: false
            referencedRelation: "roast_profiles"
            referencedColumns: ["roast_id"]
          },
        ]
      }
      role_audit_logs: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          new_role: string
          old_role: string | null
          session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_role: string
          old_role?: string | null
          session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trigger_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_role?: string
          old_role?: string | null
          session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          batch_name: string | null
          buyer: string
          green_coffee_inv_id: number
          id: number
          oz_sold: number
          price: number
          purchase_date: string
          sell_date: string
          user: string | null
        }
        Insert: {
          batch_name?: string | null
          buyer: string
          green_coffee_inv_id: number
          id?: number
          oz_sold: number
          price: number
          purchase_date: string
          sell_date: string
          user?: string | null
        }
        Update: {
          batch_name?: string | null
          buyer?: string
          green_coffee_inv_id?: number
          id?: number
          oz_sold?: number
          price?: number
          purchase_date?: string
          sell_date?: string
          user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_green_coffee_inv_id_fkey"
            columns: ["green_coffee_inv_id"]
            isOneToOne: false
            referencedRelation: "green_coffee_inv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_links: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          resource_id: string
          resource_type: string
          share_token: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          resource_id: string
          resource_type: string
          share_token: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          resource_id?: string
          resource_type?: string
          share_token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      stripe_customers: {
        Row: {
          created_at: string | null
          customer_id: string
          email: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          email?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          email?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stripe_session_processing: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          role_updated: boolean | null
          session_id: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          role_updated?: boolean | null
          session_id: string
          started_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          role_updated?: boolean | null
          session_id?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_role: string[]
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_role?: string[]
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_role?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      celsius_to_fahrenheit: { Args: { temp_c: number }; Returns: number }
      fahrenheit_to_celsius: { Args: { temp_f: number }; Returns: number }
      get_api_usage_summary: {
        Args: { key_id: string; start_date: string }
        Returns: {
          day: string
          request_count: number
          avg_response_time_ms: number
          success_count: number
          error_count: number
        }[]
      }
      get_chart_data_raw: {
        Args: { roast_id_param: number; sample_rate?: number }
        Returns: {
          category: string
          data_type: string
          event_string: string
          field_name: string
          subcategory: string
          time_seconds: number
          value_numeric: number
        }[]
      }
      get_chart_data_sampled: {
        Args: { roast_id_param: number; target_points?: number }
        Returns: {
          category: string
          data_type: string
          event_string: string
          field_name: string
          subcategory: string
          time_milliseconds: number
          value_numeric: number
        }[]
      }
      get_chart_metadata: {
        Args: { roast_id_param: number }
        Returns: {
          charge_time_ms: number
          roast_duration_minutes: number
          ror_max: number
          ror_min: number
          temp_max: number
          temp_min: number
          time_max_ms: number
          time_min_ms: number
          total_data_points: number
        }[]
      }
      get_even_temp_ids: {
        Args: { roast_id_param: number }
        Returns: {
          ambient_temp: number | null
          bean_temp: number | null
          created_at: string | null
          data_quality: string | null
          data_source: string | null
          environmental_temp: number | null
          inlet_temp: number | null
          roast_id: number
          ror_bean_temp: number | null
          temp_id: number
          time_seconds: number
        }[]
      }
      get_roast_control_events: {
        Args: { p_roast_id: number }
        Returns: {
          category: string
          event_string: string
          event_value: string
          time_seconds: number
        }[]
      }
      get_roast_milestone_events: {
        Args: { p_roast_id: number }
        Returns: {
          category: string
          event_string: string
          time_seconds: number
        }[]
      }
      get_roast_temperature_data: {
        Args: { p_roast_id: number }
        Returns: {
          ambient_temp: number
          bean_temp: number
          environmental_temp: number
          ror_bean_temp: number
          time_seconds: number
        }[]
      }
      match_coffee_catalog: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
          stocked_only?: boolean
        }
        Returns: {
          appearance: string
          arrival_date: string
          bag_size: string
          cost_lb: number
          cultivar_detail: string
          cupping_notes: string
          description_long: string
          description_short: string
          drying_method: string
          farm_notes: string
          grade: string
          id: number
          last_updated: string
          link: string
          lot_size: string
          name: string
          packaging: string
          processing: string
          region: string
          roast_recs: string
          score_value: number
          similarity: number
          source: string
          stocked: boolean
          type: string
        }[]
      }
      match_coffee_chunks: {
        Args: {
          chunk_types?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_type: string
          coffee_id: number
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_coffee_current_inventory: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          appearance: string
          arrival_date: string
          bag_size: string
          cost_lb: number
          cultivar_detail: string
          cupping_notes: string
          description_long: string
          description_short: string
          drying_method: string
          farm_notes: string
          grade: string
          id: number
          last_updated: string
          link: string
          lot_size: string
          name: string
          packaging: string
          processing: string
          region: string
          roast_recs: string
          score_value: number
          similarity: number
          source: string
          stocked: boolean
          stocked_date: string
          type: string
          unstocked_date: string
        }[]
      }
      match_coffee_historical: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          appearance: string
          arrival_date: string
          bag_size: string
          cost_lb: number
          cultivar_detail: string
          cupping_notes: string
          description_long: string
          description_short: string
          drying_method: string
          farm_notes: string
          grade: string
          id: number
          last_updated: string
          link: string
          lot_size: string
          name: string
          packaging: string
          processing: string
          region: string
          roast_recs: string
          score_value: number
          similarity: number
          source: string
          stocked: boolean
          stocked_date: string
          type: string
          unstocked_date: string
        }[]
      }
      seconds_to_mmss: { Args: { seconds: number }; Returns: string }
      similarity: {
        Args: { match_threshold: number; query_embedding: string }
        Returns: number
      }
      update_green_coffee_from_catalog: {
        Args: Record<PropertyKey, never>
        Returns: {
          bean_cost: number | null
          catalog_id: number | null
          cupping_notes: Json | null
          id: number
          last_updated: string | null
          notes: string | null
          purchase_date: string | null
          purchased_qty_lbs: number | null
          rank: number | null
          stocked: boolean | null
          tax_ship_cost: number | null
          user: string | null
        }[]
      }
    }
    Enums: {
      suppliers:
        | "sweet_maria"
        | "bodhi_leaf"
        | "theta_ridge"
        | "burman"
        | "captain_coffee"
        | "genuine_origin"
        | "showroom_coffee"
      user_role:
        | "viewer"
        | "member"
        | "admin"
        | "api_viewer"
        | "api_member"
        | "api_enterprise"
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
      suppliers: [
        "sweet_maria",
        "bodhi_leaf",
        "theta_ridge",
        "burman",
        "captain_coffee",
        "genuine_origin",
        "showroom_coffee",
      ],
      user_role: [
        "viewer",
        "member",
        "admin",
        "api_viewer",
        "api_member",
        "api_enterprise",
      ],
    },
  },
} as const
