import { json } from '@sveltejs/kit';
import { dbConn } from '$lib/server/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function GET() {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}

	try {
		const [rows] = await dbConn.query('SELECT * FROM roast_profiles');
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
		await dbConn.beginTransaction();

		try {
			const results = await Promise.all(
				profiles.map(async (profileData) => {
					// Validate required coffee_id
					if (!profileData.coffee_id) {
						throw new Error('coffee_id is required for all profiles');
					}

					// Verify coffee_id exists in green_coffee_inv
					const [coffeeExists]: any[] = await dbConn.query(
						'SELECT id, name FROM green_coffee_inv WHERE id = ?',
						[profileData.coffee_id]
					);

					if (!coffeeExists || !coffeeExists[0]) {
						throw new Error(`Invalid coffee_id - coffee not found: ${profileData.coffee_id}`);
					}

					// Prepare profile data
					const profile = {
						batch_name:
							profileData.batch_name ||
							`${coffeeExists[0].name} - ${new Date().toLocaleDateString()}`,
						coffee_id: profileData.coffee_id,
						coffee_name: profileData.coffee_name || coffeeExists[0].name,
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
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
					`;

					const values = [
						profile.batch_name,
						profile.coffee_id,
						profile.coffee_name,
						profile.roast_date,
						profile.last_updated,
						profile.oz_in,
						profile.oz_out,
						profile.roast_notes,
						profile.roast_targets
					];

					const [result] = (await dbConn.execute(query, values)) as [ResultSetHeader, any];
					const [newRoast] = (await dbConn.query(
						'SELECT * FROM roast_profiles WHERE roast_id = ?',
						[result.insertId]
					)) as [RowDataPacket[], any];

					return newRoast[0];
				})
			);

			// If we get here, all inserts were successful
			await dbConn.commit();
			return json(results);
		} catch (error) {
			// If any profile insert fails, roll back the transaction
			await dbConn.rollback();
			throw error;
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

	// Handle single profile deletion
	const id = url.searchParams.get('id');
	if (id) {
		if (!id) {
			return json({ success: false, error: 'No ID provided' }, { status: 400 });
		}

		try {
			// Start a transaction
			await dbConn.beginTransaction();

			try {
				// First delete associated profile logs
				await dbConn.query('DELETE FROM profile_log WHERE roast_id = ?', [id]);

				// Then delete the roast profile
				await dbConn.query('DELETE FROM roast_profiles WHERE roast_id = ?', [id]);

				// Commit the transaction
				await dbConn.commit();

				return json({ success: true });
			} catch (error) {
				// If anything fails, roll back the transaction
				await dbConn.rollback();
				throw error;
			}
		} catch (error) {
			console.error('Error deleting roast profile and associated data:', error);
			return json({ success: false, error: 'Failed to delete roast profile' }, { status: 500 });
		}
	}

	// Handle batch deletion
	try {
		const { batch_name, roast_date } = await request.json();

		// Start a transaction
		await dbConn.beginTransaction();

		try {
			// First delete associated profile logs for all matching profiles
			await dbConn.query(
				'DELETE pl FROM profile_log pl INNER JOIN roast_profiles rp ON pl.roast_id = rp.roast_id WHERE rp.batch_name = ? AND rp.roast_date = ?',
				[batch_name, roast_date]
			);

			// Then delete the roast profiles
			const [result] = await dbConn.query(
				'DELETE FROM roast_profiles WHERE batch_name = ? AND roast_date = ?',
				[batch_name, roast_date]
			);

			// Commit the transaction
			await dbConn.commit();

			return json({ success: true });
		} catch (error) {
			// If anything fails, roll back the transaction
			await dbConn.rollback();
			throw error;
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

		// Remove properties that don't exist in the database
		const { roast_id: _, has_log_data: __, ...updateData } = updates;

		// Format dates for MySQL
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

		await dbConn.query('UPDATE roast_profiles SET ? WHERE roast_id = ?', [updateData, id]);

		const [updatedRoast]: any[] = await dbConn.query(
			'SELECT * FROM roast_profiles WHERE roast_id = ?',
			[id]
		);

		return new Response(JSON.stringify(updatedRoast[0]), {
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
