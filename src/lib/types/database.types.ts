export interface Database {
	public: {
		Tables: {
			coffee_chunks: {
				Row: {
					id: string;
					coffee_id: number;
					chunk_type: 'profile' | 'tasting' | 'origin' | 'commercial' | 'processing';
					content: string;
					metadata: Record<string, any>;
					embedding: number[];
					created_at: string;
					updated_at: string;
				};
				Insert: Omit<
					Database['public']['Tables']['coffee_chunks']['Row'],
					'created_at' | 'updated_at'
				>;
				Update: Partial<Database['public']['Tables']['coffee_chunks']['Row']>;
			};
			green_coffee_inv: {
				Row: {
					id: number;
					name: string;
					rank: number | null;
					notes: string | null;
					purchase_date: string | null;
					arrival_date: string | null;
					region: string | null;
					processing: string | null;
					drying_method: string | null;
					lot_size: string | null;
					bag_size: string | null;
					packaging: string | null;
					farm_gate: boolean | null;
					cultivar_detail: string | null;
					grade: string | null;
					appearance: string | null;
					roast_recs: string | null;
					type: string | null;
					link: string | null;
					purchased_qty_lbs: number | null;
					bean_cost: number | null;
					tax_ship_cost: number | null;
					last_updated: string;
				};
				Insert: Omit<Database['public']['Tables']['green_coffee_inv']['Row'], 'id'>;
				Update: Partial<Database['public']['Tables']['green_coffee_inv']['Row']>;
			};
			sales: {
				Row: {
					id: number;
					green_coffee_inv_id: number;
					oz_sold: number;
					price: number;
					buyer: string | null;
					batch_name: string | null;
					sell_date: string;
				};
				Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id'>;
				Update: Partial<Database['public']['Tables']['sales']['Row']>;
			};
			roast_profiles: {
				Row: {
					roast_id: number;
					batch_name: string;
					coffee_id: number;
					coffee_name: string;
					roast_date: string;
					oz_in: number | null;
					oz_out: number | null;
					roast_notes: string | null;
					roast_targets: string | null;
					last_updated: string | null;
					user: string | null;
					title: string | null;
					roaster_type: string | null;
					roaster_size: number | null;
					roast_uuid: string | null;
					temperature_unit: string | null;
					charge_time: number | null;
					dry_end_time: number | null;
					fc_start_time: number | null;
					fc_end_time: number | null;
					sc_start_time: number | null;
					drop_time: number | null;
					cool_time: number | null;
					charge_temp: number | null;
					dry_end_temp: number | null;
					fc_start_temp: number | null;
					fc_end_temp: number | null;
					sc_start_temp: number | null;
					drop_temp: number | null;
					cool_temp: number | null;
					dry_percent: number | null;
					maillard_percent: number | null;
					development_percent: number | null;
					total_roast_time: number | null;
					data_source: string | null;
					chart_z_max: number | null;
					chart_z_min: number | null;
					chart_y_max: number | null;
					chart_y_min: number | null;
					chart_x_max: number | null;
					chart_x_min: number | null;
				};
				Insert: Omit<Database['public']['Tables']['roast_profiles']['Row'], 'roast_id'>;
				Update: Partial<Database['public']['Tables']['roast_profiles']['Row']>;
			};
			profile_log: {
				Row: {
					log_id: number;
					roast_id: number;
					fan_setting: number;
					heat_setting: number;
					start: boolean;
					maillard: boolean;
					fc_start: boolean;
					fc_rolling: boolean;
					fc_end: boolean;
					sc_start: boolean;
					drop: boolean;
					end: boolean;
					time: string;
					bean_temp: number | null;
					charge: boolean;
				};
				Insert: Omit<Database['public']['Tables']['profile_log']['Row'], 'log_id'>;
				Update: Partial<Database['public']['Tables']['profile_log']['Row']>;
			};
			profiles: {
				Row: {
					id: string;
					user_id: string;
					username: string | null;
					full_name: string | null;
					avatar_url: string | null;
					updated_at: string;
				};
				Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'updated_at'>;
				Update: Partial<Database['public']['Tables']['profiles']['Row']>;
			};
			api_keys: {
				Row: {
					id: string;
					user_id: string;
					key_hash: string;
					name: string;
					created_at: string;
					last_used_at: string | null;
					is_active: boolean;
					permissions: Record<string, any>;
				};
				Insert: Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at'>;
				Update: Partial<Database['public']['Tables']['api_keys']['Row']>;
			};
			api_usage: {
				Row: {
					id: string;
					api_key_id: string;
					endpoint: string;
					timestamp: string;
					response_time_ms: number | null;
					status_code: number | null;
					user_agent: string | null;
					ip_address: string | null;
				};
				Insert: Omit<Database['public']['Tables']['api_usage']['Row'], 'id' | 'timestamp'>;
				Update: Partial<Database['public']['Tables']['api_usage']['Row']>;
			};
		};
	};
}
