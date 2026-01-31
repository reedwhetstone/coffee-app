import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function globalSetup() {
	if (!process.env.CI) {
		// Load .env first (Supabase vars), then .env.test (test credentials override)
		dotenv.config({ path: path.resolve(__dirname, '../../.env') });
		dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
	}

	const required = [
		'E2E_TEST_EMAIL',
		'PUBLIC_SUPABASE_URL',
		'PUBLIC_SUPABASE_ANON_KEY',
		'SUPABASE_SERVICE_ROLE_KEY'
	];
	const missing = required.filter((key) => !process.env[key]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required E2E environment variables: ${missing.join(', ')}\n` +
				`Local: ensure .env has Supabase vars and .env.test has test credentials.\n` +
				`CI: add these as GitHub Secrets.`
		);
	}
}
