// src/lib/server/db.ts
import mysql from 'mysql2/promise';
import type { Connection as dbConnection } from 'mysql2/promise';
import { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } from '$env/static/private';

let dbConn: dbConnection | undefined;

async function initializeConnection() {
	console.log('Initializing database connection...');
	try {
		dbConn = await mysql.createConnection({
			host: DB_HOST,
			database: DB_NAME,
			user: DB_USER,
			password: DB_PASSWORD
		});
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
export function getDbConn(): dbConnection {
	if (!dbConn) {
		throw new Error('Database connection is not established yet.');
	}
	return dbConn;
}

export { dbConn };
