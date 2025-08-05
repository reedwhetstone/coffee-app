import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const roastId = url.searchParams.get('roast_id');
		if (!roastId) {
			return json({ error: 'No roast_id provided' }, { status: 400 });
		}

		// Verify ownership of the roast profile
		const { data: profile } = await supabase
			.from('roast_profiles')
			.select('user, batch_name')
			.eq('roast_id', roastId)
			.single();

		if (!profile || profile.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const parsedId = parseInt(roastId, 10);
		let deletedCounts = {
			artisan_import_log: 0,
			roast_events: 0,
			roast_phases: 0,
			roast_temperatures: 0,
			extra_device_data: 0,
			profile_log: 0
		};

		// Delete from all related tables in proper order
		// Note: We don't delete the roast_profiles record itself, just clear its data

		// 1. Delete artisan import log entries
		const { data: deletedImportLog, error: importLogError } = await supabase
			.from('artisan_import_log')
			.delete()
			.eq('roast_id', parsedId)
			.select('import_id');

		if (importLogError) {
			console.error('Error deleting artisan import log:', importLogError);
			return json({ error: 'Failed to clear artisan import log' }, { status: 500 });
		}
		deletedCounts.artisan_import_log = deletedImportLog?.length || 0;

		// 2. Delete roast events
		const { data: deletedEvents, error: eventsError } = await supabase
			.from('roast_events')
			.delete()
			.eq('roast_id', parsedId)
			.select('event_id');

		if (eventsError) {
			console.error('Error deleting roast events:', eventsError);
			return json({ error: 'Failed to clear roast events' }, { status: 500 });
		}
		deletedCounts.roast_events = deletedEvents?.length || 0;

		// 3. Delete roast temperatures
		const { data: deletedTemperatures, error: temperaturesError } = await supabase
			.from('roast_temperatures')
			.delete()
			.eq('roast_id', parsedId)
			.select('temp_id');

		if (temperaturesError) {
			console.error('Error deleting roast temperatures:', temperaturesError);
			return json({ error: 'Failed to clear roast temperatures' }, { status: 500 });
		}
		deletedCounts.roast_temperatures = deletedTemperatures?.length || 0;

		// 4. Note: roast_phases table no longer exists, skipping
		deletedCounts.roast_phases = 0;

		// 5. Delete extra device data
		const { data: deletedDeviceData, error: deviceError } = await supabase
			.from('extra_device_data')
			.delete()
			.eq('roast_id', parsedId)
			.select('device_data_id');

		if (deviceError) {
			console.error('Error deleting extra device data:', deviceError);
			return json({ error: 'Failed to clear extra device data' }, { status: 500 });
		}
		deletedCounts.extra_device_data = deletedDeviceData?.length || 0;

		// 6. Delete profile log entries
		const { data: deletedProfileLog, error: profileLogError } = await supabase
			.from('profile_log')
			.delete()
			.eq('roast_id', parsedId)
			.select('log_id');

		if (profileLogError) {
			console.error('Error deleting profile log:', profileLogError);
			return json({ error: 'Failed to clear profile log' }, { status: 500 });
		}
		deletedCounts.profile_log = deletedProfileLog?.length || 0;

		// Optional: Reset some roast_profiles fields to clear imported data while preserving core profile
		const { error: resetError } = await supabase
			.from('roast_profiles')
			.update({
				// Clear Artisan-specific fields while preserving user-entered data
				title: null,
				roaster_type: null,
				roaster_size: null,
				roast_uuid: null,
				weight_unit: null,
				temperature_unit: 'F',
				// Clear milestone timings
				charge_time: null,
				dry_end_time: null,
				fc_start_time: null,
				fc_end_time: null,
				sc_start_time: null,
				drop_time: null,
				cool_time: null,
				// Clear milestone temperatures
				charge_temp: null,
				dry_end_temp: null,
				fc_start_temp: null,
				fc_end_temp: null,
				sc_start_temp: null,
				drop_temp: null,
				cool_temp: null,
				// Clear phase calculations
				dry_percent: null,
				maillard_percent: null,
				development_percent: null,
				total_roast_time: null,
				weight_loss_percent: null,
				// Clear chart settings
				chart_x_min: null,
				chart_x_max: null,
				chart_y_min: null,
				chart_y_max: null,
				chart_z_min: null,
				chart_z_max: null,
				// Clear weight data
				weight_in: null,
				weight_out: null,
				// Reset data source
				data_source: 'manual'
			})
			.eq('roast_id', parsedId);

		if (resetError) {
			console.error('Error resetting roast profile fields:', resetError);
			// This is non-critical, so we don't fail the entire operation
		}

		const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);

		return json({
			success: true,
			message: `Successfully cleared roast data. Deleted ${totalDeleted} total records.`,
			deleted_counts: deletedCounts,
			batch_name: profile.batch_name
		});
	} catch (error) {
		console.error('Error clearing roast data:', error);
		return json({ error: 'Failed to clear roast data' }, { status: 500 });
	}
};
