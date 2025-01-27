import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';

export async function GET() {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const { rows } = await dbConn.query('SELECT * FROM roast_profiles');
		return json({ data: rows });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ data: [], error: 'Failed to fetch data' });
	}
}

export async function POST({ request }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const data = await request.json();
		const profiles = Array.isArray(data) ? data : [data];

		// Start transaction
		const client = await dbConn.connect();
		try {
			await client.query('BEGIN');

			const results = await Promise.all(
				profiles.map(async (profileData) => {
					if (!profileData.coffee_id) {
						throw new Error('coffee_id is required for all profiles');
					}

					const coffeeExists = await client.query(
						'SELECT id, name FROM green_coffee_inv WHERE id = $1',
						[profileData.coffee_id]
					);

					if (!coffeeExists.rows.length) {
						throw new Error(`Invalid coffee_id - coffee not found: ${profileData.coffee_id}`);
					}

					// Prepare profile data
					const profile = {
						batch_name:
							profileData.batch_name ||
							`${coffeeExists.rows[0].name} - ${new Date().toLocaleDateString()}`,
						coffee_id: profileData.coffee_id,
						coffee_name: profileData.coffee_name || coffeeExists.rows[0].name,
						roast_date: profileData.roast_date
							? new Date(profileData.roast_date).toISOString().slice(0, 19).replace('T', ' ')
							: new Date().toISOString().slice(0, 19).replace('T', ' '),
						last_updated: profileData.last_updated
							? new Date(profileData.last_updated).toISOString().slice(0, 19).replace('T', ' ')
							: new Date().toISOString().slice(0, 19).replace('T', ' '),
						oz_in: profileData.oz_in || null,
						oz_out: profileData.oz_out || null,
						roast_notes: profileData.roast_notes || null,
						roast_targets: profileData.roast_targets || null
					};

					const query = `
						INSERT INTO roast_profiles (
							batch_name,
							coffee_id,
							coffee_name,
							roast_date,
							last_updated,
							oz_in,
							oz_out,
							roast_notes,
							roast_targets
						) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
						RETURNING *
					`;

					const {
						rows: [newRoast]
					} = await client.query(query, [
						profile.batch_name,
						profile.coffee_id,
						profile.coffee_name,
						profile.roast_date,
						profile.last_updated,
						profile.oz_in,
						profile.oz_out,
						profile.roast_notes,
						profile.roast_targets
					]);

					return newRoast;
				})
			);

			await client.query('COMMIT');
			return json(results);
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('Error creating roast profiles:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create roast profiles'
			},
			{ status: 500 }
		);
	}
}

export async function DELETE({ url, request }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	const id = url.searchParams.get('id');
	if (id) {
		try {
			const client = await dbConn.connect();
			try {
				await client.query('BEGIN');
				await client.query('DELETE FROM profile_log WHERE roast_id = $1', [id]);
				await client.query('DELETE FROM roast_profiles WHERE roast_id = $1', [id]);
				await client.query('COMMIT');
				return json({ success: true });
			} catch (error) {
				await client.query('ROLLBACK');
				throw error;
			} finally {
				client.release();
			}
		} catch (error) {
			console.error('Error deleting roast profile and associated data:', error);
			return json({ success: false, error: 'Failed to delete roast profile' }, { status: 500 });
		}
	}

	try {
		const { batch_name, roast_date } = await request.json();
		const client = await dbConn.connect();

		try {
			await client.query('BEGIN');
			await client.query(
				'DELETE FROM profile_log pl USING roast_profiles rp WHERE pl.roast_id = rp.roast_id AND rp.batch_name = $1 AND rp.roast_date = $2',
				[batch_name, roast_date]
			);
			await client.query('DELETE FROM roast_profiles WHERE batch_name = $1 AND roast_date = $2', [
				batch_name,
				roast_date
			]);
			await client.query('COMMIT');
			return json({ success: true });
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('Error deleting batch profiles:', error);
		return json({ success: false, error: 'Failed to delete batch profiles' }, { status: 500 });
	}
}

export async function PUT({ url, request }) {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const id = url.searchParams.get('id');
		const updates = await request.json();

		const { roast_id: _, has_log_data: __, ...updateData } = updates;

		// Format dates for PostgreSQL
		if (updateData.roast_date) {
			updateData.roast_date = new Date(updateData.roast_date)
				.toISOString()
				.slice(0, 19)
				.replace('T', ' ');
		}
		if (updateData.last_updated) {
			updateData.last_updated = new Date(updateData.last_updated)
				.toISOString()
				.slice(0, 19)
				.replace('T', ' ');
		}

		// Convert object to UPDATE query
		const setClause = Object.keys(updateData)
			.map((key, index) => `${key} = $${index + 1}`)
			.join(', ');
		const values = Object.values(updateData);

		const {
			rows: [updatedRoast]
		} = await dbConn.query(
			`UPDATE roast_profiles SET ${setClause} WHERE roast_id = $${values.length + 1} RETURNING *`,
			[...values, id]
		);

		return new Response(JSON.stringify(updatedRoast), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return new Response(JSON.stringify({ error: 'Failed to update roast profile' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
