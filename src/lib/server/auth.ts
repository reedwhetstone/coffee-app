import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '../types/database.types';

export const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

export async function getProfile(userId: string) {
	const { data: profile, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('user_id', userId)
		.single();

	if (error) throw error;
	return profile;
}

export async function updateProfile({
	userId,
	username,
	fullName,
	avatarUrl
}: {
	userId: string;
	username?: string;
	fullName?: string;
	avatarUrl?: string;
}) {
	const { data, error } = await supabase
		.from('profiles')
		.upsert({
			user_id: userId,
			username,
			full_name: fullName,
			avatar_url: avatarUrl,
			updated_at: new Date().toISOString()
		})
		.select()
		.single();

	if (error) throw error;
	return data;
}
