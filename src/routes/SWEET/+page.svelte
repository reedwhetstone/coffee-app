<script lang="ts">
	let logs: string[] = [];

	async function runCoffeeScript() {
		try {
			logs = [...logs, 'Starting coffee script...'];
			const response = await fetch('/api/run-coffee', { method: 'POST' });
			if (!response.ok) throw new Error('Failed to run coffee script');
			logs = [...logs, 'Coffee script executed successfully'];
		} catch (error) {
			logs = [...logs, `Error running coffee script: ${error}`];
		}
	}

	async function runPlaywrightScript() {
		try {
			logs = [...logs, 'Starting playwright script...'];
			const response = await fetch('/api/run-playwright', { method: 'POST' });
			if (!response.ok) throw new Error('Failed to run playwright script');
			logs = [...logs, 'Playwright script executed successfully'];
		} catch (error) {
			logs = [...logs, `Error running playwright script: ${error}`];
		}
	}
</script>

<div class="my-4 flex gap-4">
	<button
		on:click={runCoffeeScript}
		class="cursor-pointer rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
	>
		Run Coffee Script
	</button>
	<button
		on:click={runPlaywrightScript}
		class="cursor-pointer rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
	>
		Run Playwright Script
	</button>
</div>

<div class="mt-4 max-h-60 overflow-y-auto rounded bg-black p-4 font-mono text-green-400">
	{#each logs as log}
		<div>{log}</div>
	{/each}
</div>
