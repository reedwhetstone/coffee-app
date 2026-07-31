import { env } from '$env/dynamic/private';
import { ParchmentConfigError } from '$lib/server/parchmentClient';

export function getAccountDeletionProviderCredential(): string {
	const credential = env.PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL?.trim();
	if (!credential) {
		throw new ParchmentConfigError(
			'PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL is not configured.'
		);
	}
	if (credential.length < 32) {
		throw new ParchmentConfigError(
			'PARCHMENT_ACCOUNT_DELETION_PROVIDER_CREDENTIAL must be at least 32 characters.'
		);
	}
	return credential;
}
