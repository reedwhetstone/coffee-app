import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const migrationDirectory = fileURLToPath(new URL('../supabase/migrations', import.meta.url));

let entries = [];
try {
	entries = await readdir(migrationDirectory);
} catch (error) {
	if (error?.code !== 'ENOENT') throw error;
}

if (entries.length > 0) {
	throw new Error(
		`coffee-app cannot contain database migrations. Author production DDL in reedwhetstone/parchment-api. Found: ${entries.join(', ')}`
	);
}

console.log('VALIDATION_PASS: Parchment is the sole database migration authority');
