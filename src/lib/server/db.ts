// src/lib/server/db.ts
import pkg from 'pg';
import { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } from '$env/static/private';

const { Pool } = pkg;

let dbConn: pkg.Pool | undefined;

async function initializeConnection() {
	console.log('Initializing database connection...');
	try {
		dbConn = new Pool({
			host: DB_HOST,
			database: DB_NAME,
			user: DB_USER,
			password: DB_PASSWORD
		});

		// Test the connection
		await dbConn.connect();
		console.log('Database connection established successfully');
	} catch (error) {
		console.error('Error establishing database connection:', error);
		throw error;
	}
}

initializeConnection().catch((error) => {
	console.error('Failed to initialize database connection:', error);
});

// Function to get the connection
export function getDbConn(): pkg.Pool {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}
	return dbConn;
}

export { dbConn };
