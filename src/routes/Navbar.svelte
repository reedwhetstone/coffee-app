<script>
	import { page } from '$app/state'; // Modern usage
	import { afterNavigate } from '$app/navigation'; // For handling navigation events

	let routeId = page.route.id;

	// Update `routeId` after each navigation
	afterNavigate(() => {
		routeId = page.route.id;
	});
</script>

<nav class="border-sky-800 bg-white dark:bg-gray-800">
	<div class="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between p-4">
		<button
			data-collapse-toggle="navbar-default"
			type="button"
			class="inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-800 md:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-gray-600"
			aria-controls="navbar-default"
			aria-expanded="false"
		>
			<span class="sr-only">Open main menu</span>
			<svg
				class="h-5 w-5"
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 17 14"
			>
				<path
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M1 1h15M1 7h15M1 13h15"
				/>
			</svg>
		</button>
		<div class="hidden w-full md:block md:w-auto" id="navbar-default">
			<ul
				class="mt-4 flex flex-col rounded-lg border border-gray-100 bg-gray-50 p-4 font-medium md:mt-0 md:flex-row md:space-x-8 md:border-0 md:bg-white md:p-0 rtl:space-x-reverse dark:border-gray-800 dark:bg-gray-800 md:dark:bg-gray-800"
			>
				<li>
					<a
						href="/"
						class="px-3 py-2 hover:bg-gray-100 {routeId === '/' ? 'text-sky-800' : 'text-gray-600'}
							hover:bg-transparent hover:text-sky-800 md:border-0 md:p-0 dark:hover:bg-gray-800">PURCHASED</a
					>
				</li>
				<li>
					<a
						href="/ROAST"
						class="px-3 py-2 hover:bg-gray-100 {routeId === '/ROAST'
							? 'text-sky-800'
							: 'text-gray-600'}
							hover:bg-transparent hover:text-sky-800 md:border-0 md:p-0 dark:hover:bg-gray-800">ROAST</a
					>
				</li>
				<li>
					<a
						href="/PROFIT"
						class="px-3 py-2 hover:bg-gray-100 {routeId === '/PROFIT'
							? 'text-sky-800'
							: 'text-gray-600'}
							hover:bg-transparent hover:text-sky-800 md:border-0 md:p-0 dark:hover:bg-gray-800">PROFIT</a
					>
				</li>
				<li>
					<a
						href="/SALES"
						class="px-3 py-2 hover:bg-gray-100 {routeId === '/SALES'
							? 'text-sky-800'
							: 'text-gray-600'}
							hover:bg-transparent hover:text-sky-800 md:border-0 md:p-0 dark:hover:bg-gray-800">SALES</a
					>
				</li>
			</ul>
		</div>
	</div>
</nav>
