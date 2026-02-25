<script lang="ts">
	let {
		roastId,
		hasExistingData = false,
		onImportComplete
	}: {
		roastId: number;
		hasExistingData?: boolean;
		onImportComplete: () => Promise<void>;
	} = $props();

	let showDialog = $state(false);
	let selectedFile = $state<File | null>(null);

	function handleFileSelect(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
			const fileName = file.name.toLowerCase();
			if (
				!fileName.endsWith('.alog') &&
				!fileName.endsWith('.alog.json') &&
				!fileName.endsWith('.json')
			) {
				alert('Please select a valid Artisan .alog file.');
				return;
			}

			if (file.size > 50 * 1024 * 1024) {
				alert('File is too large. Please select a file smaller than 50MB.');
				return;
			}

			selectedFile = file;
		}
	}

	export function open() {
		if (hasExistingData) {
			const confirmed = confirm(
				'Warning: Importing an Artisan file will replace all existing roast data for this profile. This action cannot be undone. Continue?'
			);
			if (!confirmed) return;
		}
		showDialog = true;
	}

	function close() {
		showDialog = false;
		selectedFile = null;
	}

	async function importFile() {
		if (!selectedFile) return;

		try {
			console.log(`Importing Artisan file ${selectedFile.name} for roast ID ${roastId}`);

			const formData = new FormData();
			formData.append('file', selectedFile);
			formData.append('roastId', roastId.toString());

			const response = await fetch('/api/artisan-import', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to import Artisan file');
			}

			const result = await response.json();
			console.log('Artisan import successful:', result);

			const totalMinutes = Math.floor((result.total_time || 0) / 60);
			const totalSeconds = Math.floor((result.total_time || 0) % 60);
			const milestoneCount = Object.keys(result.milestones || {}).filter(
				(key) => result.milestones[key] > 0
			).length;

			const message =
				`✅ Successfully imported Artisan roast profile!\n\n` +
				`📁 File: ${selectedFile.name}\n` +
				`📊 Temperature points: ${result.message.match(/\d+/)?.[0] || 'Unknown'}\n` +
				`⏱️ Roast duration: ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}\n` +
				`🌡️ Temperature unit: ${result.temperature_unit}\n` +
				`🎯 Milestones: ${milestoneCount} detected\n` +
				`📈 Roast events: ${result.roast_events || 0}\n` +
				`📋 Roast phases: ${result.roast_phases || 0}\n` +
				`⚙️ Device data points: ${result.extra_device_points || 0}\n\n` +
				`Your coffee name has been preserved. The chart now shows both bean temperature (BT) and environmental temperature (ET) curves.`;

			alert(message);
			await onImportComplete();
		} catch (error) {
			console.error('Artisan import failed:', error);
			alert(
				`Failed to import Artisan file: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		} finally {
			close();
		}
	}
</script>

{#if showDialog}
	<div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
		<button type="button" class="fixed inset-0 bg-black/50" onclick={close} aria-label="Close modal"
		></button>
		<div class="flex min-h-screen items-center justify-center p-4">
			<div
				class="relative w-full max-w-md rounded-lg bg-background-secondary-light p-6 shadow-xl"
				role="dialog"
				aria-modal="true"
			>
				<h3 class="mb-4 text-lg font-semibold text-text-primary-light">
					Import Artisan Roast File
				</h3>

				<div class="mb-4">
					<label
						for="artisan-file-input"
						class="mb-2 block text-sm font-medium text-text-primary-light"
					>
						Select Artisan .alog file:
					</label>
					<input
						id="artisan-file-input"
						type="file"
						accept=".alog,.alog.json,.json"
						onchange={handleFileSelect}
						class="block w-full text-sm text-text-primary-light file:mr-4 file:rounded file:border-0 file:bg-background-tertiary-light file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-primary-light hover:file:bg-background-primary-light"
					/>
					<p class="mt-2 text-xs text-text-secondary-light">
						Import roast profile data from Artisan roasting software. This will replace all existing
						imported data for this profile.
					</p>
				</div>

				{#if selectedFile}
					<p class="mb-4 text-sm text-green-600">
						Selected: {selectedFile.name}
					</p>
				{/if}

				<div class="flex justify-end space-x-3">
					<button
						type="button"
						class="rounded bg-background-primary-light px-4 py-2 text-text-primary-light hover:bg-background-tertiary-light"
						onclick={close}
					>
						Cancel
					</button>
					<button
						type="button"
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
						onclick={importFile}
						disabled={!selectedFile}
					>
						Import File
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
