#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const STATIC_VALIDATION_VARS = [
	'PUBLIC_SUPABASE_URL',
	'PUBLIC_SUPABASE_ANON_KEY',
	'SUPABASE_SERVICE_ROLE_KEY',
	'STRIPE_SECRET_KEY',
	'STRIPE_WEBHOOK_SECRET'
];

const E2E_ONLY_VARS = ['E2E_TEST_EMAIL', 'E2E_TEST_USER_ID'];
const OPTIONAL_E2E_VARS = ['PLAYWRIGHT_BASE_URL'];
const EXAMPLE_KEYS = ['.env', '.env.local', '.env.test', '.env.test.example'];

function parseEnvFile(filePath) {
	if (!fs.existsSync(filePath)) return {};

	const content = fs.readFileSync(filePath, 'utf8');
	const entries = {};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
		if (!match) continue;
		let [, key, value] = match;
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		entries[key] = value;
	}

	return entries;
}

function readRepoEnv(repoRoot) {
	const merged = {};
	for (const relativePath of EXAMPLE_KEYS) {
		const filePath = path.join(repoRoot, relativePath);
		const parsed = parseEnvFile(filePath);
		for (const [key, value] of Object.entries(parsed)) {
			if (!(key in merged)) merged[key] = value;
		}
	}
	return merged;
}

function getMode(argv) {
	const mode = argv[2] || 'check';
	if (!['check', 'e2e'].includes(mode)) {
		console.error(`Unknown mode: ${mode}`);
		console.error('Usage: node scripts/check-env-contract.mjs [check|e2e]');
		process.exit(2);
	}
	return mode;
}

const repoRoot = process.cwd();
const mode = getMode(process.argv);
const repoEnv = readRepoEnv(repoRoot);
const combinedEnv = { ...repoEnv, ...process.env };

const requiredVars =
	mode === 'e2e' ? [...STATIC_VALIDATION_VARS, ...E2E_ONLY_VARS] : STATIC_VALIDATION_VARS;
const missingVars = requiredVars.filter((key) => {
	const value = combinedEnv[key];
	return value === undefined || value === '';
});

const satisfiedFromRepoFiles = requiredVars.filter(
	(key) => key in repoEnv && !(key in process.env)
);
const discoveredFiles = EXAMPLE_KEYS.filter((name) => fs.existsSync(path.join(repoRoot, name)));

console.log(`Env contract mode: ${mode}`);
console.log(`Checked repo: ${repoRoot}`);
console.log(`Env files inspected: ${discoveredFiles.length ? discoveredFiles.join(', ') : 'none'}`);
console.log(`Required vars (${requiredVars.length}): ${requiredVars.join(', ')}`);

if (mode === 'e2e') {
	console.log(`Optional vars: ${OPTIONAL_E2E_VARS.join(', ')}`);
}

if (satisfiedFromRepoFiles.length) {
	console.log(`Satisfied via repo-local env files: ${satisfiedFromRepoFiles.join(', ')}`);
}

if (missingVars.length) {
	console.error('VALIDATION_BLOCKED_ENV');
	console.error(`Missing required env vars: ${missingVars.join(', ')}`);
	console.error('Use scripts/bootstrap-worktree-env.sh to see the local validation env contract.');
	process.exit(1);
}

console.log('VALIDATION_PASS');
console.log('Required env contract satisfied for requested mode.');
