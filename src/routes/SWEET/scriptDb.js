import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

let dbConn;

async function initializeConnection() {
	console.log('Initializing database connection...');
	try {
		dbConn = new Pool({
			host: process.env.DB_HOST,
			database: process.env.DB_NAME,
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD,
			port: process.env.DB_PORT || 5432 // PostgreSQL default port
		});

		// Test the connection
		await dbConn.query('SELECT NOW()');
		console.log('Database connection established successfully');
		return dbConn;
	} catch (error) {
		console.error('Error establishing database connection:', error);
		throw error;
	}
}

export { initializeConnection };
