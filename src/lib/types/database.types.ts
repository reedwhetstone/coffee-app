export interface Database {
	public: {
		Tables: {
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
					last_updated: string;
					oz_in: number | null;
					oz_out: number | null;
					roast_notes: string | null;
					roast_targets: string | null;
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
				};
				Insert: Omit<Database['public']['Tables']['profile_log']['Row'], 'log_id'>;
				Update: Partial<Database['public']['Tables']['profile_log']['Row']>;
			};
		};
	};
}
