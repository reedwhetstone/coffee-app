import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let dbConn;

async function initializeConnection() {
	console.log('Initializing database connection...');
	try {
		dbConn = await mysql.createConnection({
			host: process.env.DB_HOST,
			database: process.env.DB_NAME,
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD
		});
		console.log('Database connection established successfully');
		return dbConn;
	} catch (error) {
		console.error('Error establishing database connection:', error);
		throw error;
	}
}

export { initializeConnection };
