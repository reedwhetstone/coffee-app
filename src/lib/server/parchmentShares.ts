import type {
	InventoryShareGrant,
	InventoryShareGrantCreateRequest,
	InventoryShareInventory,
	ParchmentClient
} from '@purveyors/sdk';

type ParchmentResult<T> = {
	data?: T;
	error?: unknown;
	response?: Response;
};

export class ParchmentShareError extends Error {
	constructor(
		public status: number,
		public body: unknown
	) {
		super(extractParchmentMessage(body));
		this.name = 'ParchmentShareError';
	}
}

function extractParchmentMessage(body: unknown): string {
	if (typeof body !== 'object' || body === null) return 'Parchment share request failed';

	if (
		'error' in body &&
		typeof body.error === 'object' &&
		body.error !== null &&
		'message' in body.error &&
		typeof body.error.message === 'string'
	) {
		return body.error.message;
	}

	if ('message' in body && typeof body.message === 'string') return body.message;
	return 'Parchment share request failed';
}

function unwrapResult<T>(result: ParchmentResult<T>, missingMessage: string): T {
	if (result.error) {
		if (result.response) throw new ParchmentShareError(result.response.status, result.error);
		throw result.error instanceof Error
			? result.error
			: new Error('Parchment share request failed', { cause: result.error });
	}

	if (result.data === undefined) {
		throw new ParchmentShareError(502, {
			error: { code: 'invalid_response', message: missingMessage }
		});
	}

	return result.data;
}

function isGrant(value: unknown): value is InventoryShareGrant {
	if (typeof value !== 'object' || value === null) return false;
	const grant = value as Record<string, unknown>;
	return (
		typeof grant.id === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(grant.id) &&
		typeof grant.token === 'string' &&
		/^[a-f0-9]{64}$/.test(grant.token) &&
		typeof grant.expiresAt === 'string' &&
		!Number.isNaN(Date.parse(grant.expiresAt)) &&
		typeof grant.scope === 'object' &&
		grant.scope !== null
	);
}

/** Create one owner-scoped share grant through Parchment's session contract. */
export async function createParchmentInventoryShareGrant(
	client: ParchmentClient,
	body: InventoryShareGrantCreateRequest
): Promise<InventoryShareGrant> {
	const response = unwrapResult(
		(await client.inventory.shareGrants.create(body)) as ParchmentResult<{
			data: InventoryShareGrant;
		}>,
		'Parchment did not return an inventory share grant'
	);

	if (!isGrant(response.data)) {
		throw new ParchmentShareError(502, {
			error: {
				code: 'invalid_response',
				message: 'Parchment returned an invalid inventory share grant'
			}
		});
	}

	return response.data;
}

/** Redeem a bearer capability anonymously through Parchment. */
export async function redeemParchmentInventoryShareGrant(
	client: ParchmentClient,
	token: string
): Promise<InventoryShareInventory[]> {
	const response = unwrapResult(
		(await client.inventory.shareGrants.redeem({ token })) as ParchmentResult<{
			data: InventoryShareInventory[];
		}>,
		'Parchment did not return an inventory share response'
	);

	if (!Array.isArray(response.data)) {
		throw new ParchmentShareError(502, {
			error: {
				code: 'invalid_response',
				message: 'Parchment returned an invalid inventory share response'
			}
		});
	}

	return response.data;
}
