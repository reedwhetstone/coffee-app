import { test, expect } from '@playwright/test';

test.use({
	storageState: 'tests/e2e/.auth/user.json'
});

// Types for collected errors
interface ConsoleError {
	type: string;
	text: string;
	location?: string;
}

interface NetworkError {
	url: string;
	status: number;
	statusText: string;
	method: string;
}

test('test', async ({ page }) => {
	// Collect errors throughout the test
	const consoleErrors: ConsoleError[] = [];
	const networkErrors: NetworkError[] = [];

	// Listen for console errors and warnings
	page.on('console', (msg) => {
		if (msg.type() === 'error' || msg.type() === 'warning') {
			consoleErrors.push({
				type: msg.type(),
				text: msg.text(),
				location: msg.location()?.url
			});
		}
	});

	// Listen for page errors (uncaught exceptions)
	page.on('pageerror', (error) => {
		consoleErrors.push({
			type: 'pageerror',
			text: error.message
		});
	});

	// Listen for failed network requests (4xx, 5xx, or network failures)
	page.on('response', (response) => {
		if (response.status() >= 400) {
			networkErrors.push({
				url: response.url(),
				status: response.status(),
				statusText: response.statusText(),
				method: response.request().method()
			});
		}
	});

	// Listen for requests that fail entirely (network errors, timeouts)
	page.on('requestfailed', (request) => {
		networkErrors.push({
			url: request.url(),
			status: 0,
			statusText: request.failure()?.errorText || 'Request failed',
			method: request.method()
		});
	});

	await page.goto('http://localhost:5173/catalog');
	await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
	await page.getByRole('link', { name: 'Beans' }).click();
	await page.getByRole('button', { name: 'Burundi Kayanza Masha' }).click();
	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByRole('spinbutton').first().click();
	await page.getByRole('spinbutton').first().click();
	await page.getByRole('spinbutton').first().dblclick();
	await page.getByRole('spinbutton').first().dblclick();
	await page.locator('textarea').click();
	await page.locator('textarea').fill(';ldflkjsd');
	await page.getByRole('spinbutton').first().click();
	await page.getByRole('spinbutton').first().fill('11');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.getByRole('button', { name: '☕ Cupping' }).click();
	await page.getByRole('button', { name: 'Edit Cupping Notes' }).click();
	await page.getByRole('slider').first().fill('5');
	await page.locator('#brew-method').selectOption('cold_brew');
	await page.locator('#body-score').fill('4');
	await page.getByRole('button', { name: 'Save Cupping Notes' }).click();
	await page.getByRole('button', { name: '🔥 Roasting' }).click();
	await page.getByRole('button', { name: 'Start New Roast' }).click();
	await page.getByRole('spinbutton', { name: 'Green Weight (oz)' }).click();
	await page.getByRole('spinbutton', { name: 'Green Weight (oz)' }).fill('1');
	await page.getByRole('textbox', { name: 'Roast Targets' }).click();
	await page.getByRole('textbox', { name: 'Roast Targets' }).fill('sdas');
	await page.getByRole('textbox', { name: 'Roast Notes' }).click();
	await page.getByRole('textbox', { name: 'Roast Targets' }).fill('sdasd');
	await page.getByRole('textbox', { name: 'Roast Notes' }).click();
	await page.getByRole('textbox', { name: 'Roast Notes' }).fill('asd');
	await page.getByRole('button', { name: 'Create Roast Profile' }).click();
	await page.getByRole('button', { name: 'Toggle Burundi Kayanza Masha' }).click();
	await page
		.getByRole('button', {
			name: 'Burundi Kayanza Masha Anaerobic Natural ID: 355 • 1/30/2026 Weight In 1 oz'
		})
		.click();
	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByRole('textbox').first().click();
	await page.getByRole('textbox').first().fill('asdsdfsf');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await page.getByRole('button', { name: '+' }).first().click();
	await page.getByRole('button', { name: '+' }).nth(1).click();
	await page.getByRole('button', { name: 'Charge' }).click();
	await page.getByRole('button', { name: 'Maillard' }).click();
	await page.getByRole('button', { name: 'FC Start' }).click();
	await page.getByRole('button', { name: 'FC Rolling' }).click();
	await page.getByRole('button', { name: 'FC End' }).click();
	await page.getByRole('button', { name: 'SC Start' }).click();
	await page.getByRole('button', { name: 'Drop' }).click();
	await page.getByRole('button', { name: 'Cool End' }).click();
	await page.getByRole('button', { name: 'Save Roast' }).click();
	await page.getByRole('button', { name: 'Save Roast' }).click();
	await page.getByRole('button', { name: '📋 Browse Profiles' }).click();
	await page
		.getByRole('button', {
			name: 'Burundi Kayanza Masha Anaerobic Natural ID: 355 • 1/30/2026 Weight In 1 oz'
		})
		.click();
	await page.locator('rect').click();
	page.once('dialog', (dialog) => {
		console.log(`Dialog message: ${dialog.message()}`);
		dialog.dismiss().catch(() => {});
	});
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByRole('button', { name: 'Toggle actions' }).click();
	await page.getByRole('button', { name: 'New Sale' }).click();
	await page.getByLabel('Coffee Name').selectOption('89');
	await page.getByLabel('Batch Name (optional)').selectOption('another test');
	await page.getByRole('spinbutton', { name: 'Amount Sold (oz)' }).click();
	await page.getByRole('spinbutton', { name: 'Amount Sold (oz)' }).fill('01');
	await page.getByRole('spinbutton', { name: 'Amount Sold (oz)' }).click();
	await page.getByRole('spinbutton', { name: 'Amount Sold (oz)' }).click();
	await page.getByRole('spinbutton', { name: 'Amount Sold (oz)' }).fill('1');
	await page.getByRole('spinbutton', { name: 'Sale Price ($)' }).click();
	await page.getByRole('spinbutton', { name: 'Sale Price ($)' }).fill('1');
	await page.getByRole('textbox', { name: 'Buyer' }).click();
	await page.getByRole('textbox', { name: 'Buyer' }).fill('test');
	await page.getByRole('button', { name: 'Create Sale' }).click();
	await page.getByRole('button', { name: 'Last 30 Days' }).click();
	await page.getByRole('button', { name: '3M' }).click();

	// Log all collected errors at the end of the test
	if (consoleErrors.length > 0) {
		console.log('\n=== CONSOLE ERRORS/WARNINGS ===');
		consoleErrors.forEach((err, i) => {
			console.log(`${i + 1}. [${err.type.toUpperCase()}] ${err.text}`);
			if (err.location) console.log(`   Location: ${err.location}`);
		});
	}

	if (networkErrors.length > 0) {
		console.log('\n=== NETWORK ERRORS ===');
		networkErrors.forEach((err, i) => {
			console.log(`${i + 1}. [${err.method}] ${err.url}`);
			console.log(`   Status: ${err.status} ${err.statusText}`);
		});
	}

	// Summary
	const totalErrors = consoleErrors.length + networkErrors.length;
	if (totalErrors > 0) {
		console.log(
			`\n=== SUMMARY: ${consoleErrors.length} console errors, ${networkErrors.length} network errors ===\n`
		);
	} else {
		console.log('\n=== NO ERRORS DETECTED ===\n');
	}

	// Optional: Fail the test if there are critical errors
	// Uncomment the next line to fail on any errors:
	// expect(networkErrors.filter(e => e.status >= 500)).toHaveLength(0);
});
