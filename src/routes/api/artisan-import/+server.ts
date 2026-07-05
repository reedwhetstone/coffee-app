import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

/**
 * Replace an existing roast's curve/events from an Artisan export.
 *
 * Ownership of the roast time-series now lives in the canonical Parchment API.
 * This route no longer writes curves/events directly to Supabase; it
 * authenticates the dashboard session, then forwards the caller's own Supabase
 * session JWT as a Bearer credential to Parchment via the SDK
 * (`mode: 'session'`, PUT /v1/roasts/{id}/artisan-import). coffee-app and the
 * Parchment API share the same Supabase (prod) project, so the session token
 * validates API-side and resolves the user + `roast:write` entitlement. Parchment
 * re-derives the roast's curve, events, and metrics server-side atomically.
 *
 * The success payload preserves the legacy top-level fields the import dialogs
 * consume (`message`, `total_time`, `temperature_unit`, `milestones`,
 * `roast_events`) synthesized from the API's import summary + roast detail, and
 * also relays the raw `roast`/`import` objects for callers that want them.
 */
export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	try {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const roastId = formData.get('roastId') as string;

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}
		if (!roastId) {
			return json({ error: 'No roast ID provided' }, { status: 400 });
		}

		const roastIdNum = parseInt(roastId, 10);
		if (!Number.isFinite(roastIdNum)) {
			return json({ error: 'Invalid roast ID' }, { status: 400 });
		}

		// Validate file format - accept .alog, .alog.json, or .json files
		const fileName = file.name.toLowerCase();
		if (
			!fileName.endsWith('.alog') &&
			!fileName.endsWith('.alog.json') &&
			!fileName.endsWith('.json')
		) {
			return json(
				{
					error:
						'Unsupported file format. Please use .alog files from Artisan or .alog.json/.json files.'
				},
				{ status: 400 }
			);
		}

		const fileContent = await file.text();

		// Session mode forwards the logged-in user's Supabase token as Bearer; the
		// token never reaches the browser. Parchment enforces roast:write.
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response } = await client.roasts.replaceArtisanImport(roastIdNum, {
			fileName: file.name,
			fileContent,
			// pass original byte size for accurate import-log metadata
			fileSize: file.size
		});

		if (error || !data) {
			// Relay Parchment's status (401/403 entitlement, 400 invalid file,
			// 404 missing roast, 503 unavailable) so the dialogs surface the real
			// decision instead of a blanket 500.
			return json(
				{ error: error?.error?.message || 'Failed to import Artisan file' },
				{ status: response?.status ?? 500 }
			);
		}

		const { roast, import: summary } = data.data;

		// Rebuild the legacy `milestones` object (frontend counts keys whose value
		// is > 0) from the roast detail's milestone times.
		const milestones = {
			charge: roast.charge_time ?? 0,
			tp: roast.tp_time ?? 0,
			fc_start: roast.fc_start_time ?? 0,
			fc_end: roast.fc_end_time ?? 0,
			drop: roast.drop_time ?? 0
		};

		return json({
			success: true,
			message: `Successfully imported ${summary.temperaturePoints} data points from ${summary.fileName}`,
			milestones,
			total_time: roast.total_roast_time ?? 0,
			temperature_unit: roast.temperature_unit ?? 'F',
			milestone_events: summary.milestoneEvents,
			control_events: summary.controlEvents,
			roast_events: summary.milestoneEvents + summary.controlEvents,
			// Raw canonical payload for callers that want the full detail/summary.
			roast,
			import: summary
		});
	} catch (error) {
		console.error('Error importing Artisan file:', error);

		// Missing Parchment config is an operator error, not a client one.
		if (error instanceof ParchmentConfigError) {
			return json({ error: 'Artisan import is temporarily unavailable' }, { status: 503 });
		}

		const errorMessage = error instanceof Error ? error.message : 'Failed to import Artisan file';
		return json({ error: errorMessage }, { status: 500 });
	}
};
