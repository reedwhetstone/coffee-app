import { json } from '@sveltejs/kit';
import { upstreamFailure } from '$lib/server/referenceGeneration';

export function roastPlanFailure(error: unknown, status: number | undefined, fallback: string) {
	if (error && typeof error === 'object' && 'error' in error) {
		const detail = error.error;
		if (
			detail &&
			typeof detail === 'object' &&
			'code' in detail &&
			detail.code === 'roast_artisan_source_unavailable'
		) {
			return json(
				{
					code: 'roast_artisan_source_unavailable',
					reason: 'reason' in detail && typeof detail.reason === 'string' ? detail.reason : null,
					error:
						'message' in detail && typeof detail.message === 'string' ? detail.message : fallback
				},
				{ status: status ?? 400 }
			);
		}
	}
	return upstreamFailure(error, status, fallback);
}
