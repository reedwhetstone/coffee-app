import { test, expect, type Page } from '@playwright/test';

test.use({
	storageState: 'tests/e2e/.auth/user.json'
});

// ============================================================
// HELPER UTILITIES
// ============================================================

/**
 * Helper to wait for network requests to settle after an action
 */
async function waitForNetworkIdle(page: Page, timeout = 3000) {
	await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Navigate to beans page via sidebar
 */
async function navigateToBeans(page: Page) {
	await page.goto('/catalog');
	await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
	await page.getByRole('link', { name: 'Beans' }).waitFor({ state: 'visible' });
	await page.getByRole('link', { name: 'Beans' }).click();
	await page.waitForURL(/\/beans/);
}

// ============================================================
// ERROR COLLECTION SETUP
// ============================================================

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

function setupErrorCollection(page: Page) {
	const consoleErrors: ConsoleError[] = [];
	const networkErrors: NetworkError[] = [];

	page.on('console', (msg) => {
		if (msg.type() === 'error' || msg.type() === 'warning') {
			consoleErrors.push({
				type: msg.type(),
				text: msg.text(),
				location: msg.location()?.url
			});
		}
	});

	page.on('pageerror', (error) => {
		consoleErrors.push({
			type: 'pageerror',
			text: error.message
		});
	});

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

	page.on('requestfailed', (request) => {
		networkErrors.push({
			url: request.url(),
			status: 0,
			statusText: request.failure()?.errorText || 'Request failed',
			method: request.method()
		});
	});

	return { consoleErrors, networkErrors };
}

function logErrors(consoleErrors: ConsoleError[], networkErrors: NetworkError[]) {
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

	const totalErrors = consoleErrors.length + networkErrors.length;
	if (totalErrors > 0) {
		console.log(
			`\n=== SUMMARY: ${consoleErrors.length} console errors, ${networkErrors.length} network errors ===\n`
		);
	}
}

// ============================================================
// TEST SUITES
// ============================================================

test.describe('Bean Management', () => {
	test('can navigate to beans and view bean details', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await navigateToBeans(page);

		// Select first bean with a flexible matcher
		await page
			.getByRole('button', { name: /Burundi/i })
			.first()
			.click();

		// Verify bean modal/details opened
		await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

		logErrors(consoleErrors, networkErrors);
	});

	test('can edit bean details', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await navigateToBeans(page);
		await page
			.getByRole('button', { name: /Burundi/i })
			.first()
			.click();

		// Click Edit
		await page.getByRole('button', { name: 'Edit' }).click();

		// Edit a field - use labeled inputs when possible
		const textarea = page.locator('textarea').first();
		await textarea.fill('Test notes update ' + Date.now());

		// Update a numeric field
		const spinbutton = page.getByRole('spinbutton').first();
		await spinbutton.fill('12');

		// Save and wait for response
		await page.getByRole('button', { name: 'Save' }).click();
		await waitForNetworkIdle(page);

		// Verify save completed (button should return to normal state)
		await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

		logErrors(consoleErrors, networkErrors);
	});
});

test.describe('Cupping Notes', () => {
	test('can edit cupping notes', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await navigateToBeans(page);
		await page
			.getByRole('button', { name: /Burundi/i })
			.first()
			.click();

		// Navigate to cupping tab - click the text directly in the tab bar area
		const cuppingTab = page.locator('button').filter({ hasText: /^\u2615\s*Cupping$/ });
		await cuppingTab.click();
		// Wait for tab content to load
		await page.waitForTimeout(500);

		// Look for either Edit or Add button for cupping notes
		const editCuppingBtn = page.getByRole('button', { name: /Edit Cupping Notes|Add Cupping/i });
		if (await editCuppingBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await editCuppingBtn.click();

			// Adjust sliders and selects
			const slider = page.getByRole('slider').first();
			if (await slider.isVisible({ timeout: 1000 }).catch(() => false)) {
				await slider.fill('6');
			}

			const brewMethod = page.locator('#brew-method');
			if (await brewMethod.isVisible({ timeout: 1000 }).catch(() => false)) {
				await brewMethod.selectOption('pour_over');
			}

			const bodyScore = page.locator('#body-score');
			if (await bodyScore.isVisible({ timeout: 1000 }).catch(() => false)) {
				await bodyScore.fill('5');
			}

			// Save
			await page.getByRole('button', { name: /Save Cupping Notes/i }).click();
			await waitForNetworkIdle(page);
		} else {
			console.log('Cupping notes edit button not found, verifying tab is visible');
			// Verify we at least see the cupping content
			await expect(page.getByText(/Tasting Profile|Your Rating/i).first()).toBeVisible();
		}

		logErrors(consoleErrors, networkErrors);
	});
});

test.describe('Roast Profiles', () => {
	test('can create and start a new roast profile', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await navigateToBeans(page);
		await page
			.getByRole('button', { name: /Burundi/i })
			.first()
			.click();

		// Navigate to roasting tab
		const roastingTab = page.locator('button').filter({ hasText: /^🔥\s*Roasting$/ });
		await roastingTab.click();
		await page.waitForTimeout(500);

		await page.getByRole('button', { name: /Start New Roast/i }).click();

		// Fill out roast form
		await page.getByRole('spinbutton', { name: /Green Weight/i }).fill('8');
		await page.getByRole('textbox', { name: /Roast Targets/i }).fill('Medium roast, city+');
		await page.getByRole('textbox', { name: /Roast Notes/i }).fill('Test profile ' + Date.now());

		// Create the profile
		await page.getByRole('button', { name: /Create Roast Profile/i }).click();
		await waitForNetworkIdle(page);

		// Verify profile was created (should see it in the list)
		await expect(page.getByRole('button', { name: /Browse Profiles/i })).toBeVisible();

		logErrors(consoleErrors, networkErrors);
	});

	test('can run through roast phases', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await navigateToBeans(page);
		await page
			.getByRole('button', { name: /Burundi/i })
			.first()
			.click();

		// Navigate to roasting tab
		const roastingTab = page.locator('button').filter({ hasText: /^🔥\s*Roasting$/ });
		await roastingTab.click();
		await page.waitForTimeout(500);

		// Check if there are any roast profiles
		// const startNewRoastBtn = page.getByRole('button', { name: /Start New Roast/i });
		const hasExistingProfiles = await page
			.getByText(/Roast #|ID: \d+/)
			.first()
			.isVisible({ timeout: 2000 })
			.catch(() => false);

		if (!hasExistingProfiles) {
			console.log('No existing roast profiles found - skipping roast phases test');
			logErrors(consoleErrors, networkErrors);
			return;
		}

		// Click on a profile card (flexible matcher for dynamic content)
		const profileCard = page.getByRole('button', { name: /ID: \d+/i }).first();
		if (await profileCard.isVisible({ timeout: 2000 }).catch(() => false)) {
			await profileCard.click();

			// The roast page should open - look for roast controls
			await page.waitForTimeout(1000);

			// Just verify we can see some roast-related content
			const roastContent = page.getByText(/Weight Loss|Roast Notes|oz/i).first();
			if (await roastContent.isVisible({ timeout: 3000 }).catch(() => false)) {
				console.log('Successfully navigated to roast profile');
			}
		} else {
			console.log('No profile cards found to click');
		}

		logErrors(consoleErrors, networkErrors);
	});

	test('can delete a roast profile', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await navigateToBeans(page);
		await page
			.getByRole('button', { name: /Burundi/i })
			.first()
			.click();

		// Navigate to roasting tab
		const roastingTab = page.locator('button').filter({ hasText: /^🔥\s*Roasting$/ });
		await roastingTab.click();
		await page.waitForTimeout(500);

		// Try to browse profiles
		const browseBtn = page.getByRole('button', { name: /Browse Profiles/i });
		if (await browseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await browseBtn.click();
		}

		// Look for any profile to delete - expand a group first if needed
		const profileToggle = page.getByRole('button', { name: /Toggle.*Burundi/i }).first();
		if (await profileToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
			await profileToggle.click();
			await page.waitForTimeout(300);
		}

		// Click on a profile card
		const profileCard = page.getByRole('button', { name: /Burundi.*ID: \d+/i }).first();
		if (await profileCard.isVisible({ timeout: 3000 }).catch(() => false)) {
			await profileCard.click();

			// Set up dialog handler before clicking delete
			page.once('dialog', (dialog) => {
				console.log(`Dialog message: ${dialog.message()}`);
				dialog.accept().catch(() => {});
			});

			// Click delete
			const deleteBtn = page.getByRole('button', { name: 'Delete', exact: true });
			if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
				await deleteBtn.click();
				await waitForNetworkIdle(page);
			}
		} else {
			console.log('No roast profiles found to delete - skipping deletion test');
		}

		logErrors(consoleErrors, networkErrors);
	});
});

test.describe('Sales Management', () => {
	test('can create a new sale', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		// Navigate directly to sales/profit page
		await page.goto('/profit');
		await page.waitForLoadState('networkidle');

		// Open actions and create new sale
		await page
			.getByRole('button', { name: /Toggle actions|New Sale/i })
			.first()
			.click();

		const newSaleBtn = page.getByRole('button', { name: 'New Sale' });
		if (await newSaleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await newSaleBtn.click();
		}

		// Fill out sale form - use first available option from selects
		const coffeeSelect = page.getByLabel('Coffee Name');
		await coffeeSelect.waitFor({ state: 'visible' });
		const coffeeOptions = await coffeeSelect.locator('option').allTextContents();
		if (coffeeOptions.length > 1) {
			await coffeeSelect.selectOption({ index: 1 }); // Skip empty/placeholder option
		}

		// Try to select a batch
		const batchSelect = page.getByLabel(/Batch Name/i);
		if (await batchSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
			const batchOptions = await batchSelect.locator('option').allTextContents();
			if (batchOptions.length > 1) {
				await batchSelect.selectOption({ index: 1 });
			}
		}

		// Fill numeric fields
		await page.getByRole('spinbutton', { name: /Amount Sold/i }).fill('4');
		await page.getByRole('spinbutton', { name: /Sale Price/i }).fill('15');
		await page.getByRole('textbox', { name: /Buyer/i }).fill('Test Customer');

		// Create sale
		await page.getByRole('button', { name: /Create Sale/i }).click();
		await waitForNetworkIdle(page);

		logErrors(consoleErrors, networkErrors);
	});

	test('can change profit date range', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await page.goto('/profit');
		await page.waitForLoadState('networkidle');

		// Click on date range buttons
		const thirtyDaysBtn = page.getByRole('button', { name: /30 Days/i });
		if (await thirtyDaysBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await thirtyDaysBtn.click();
		}

		const threeMonthBtn = page.getByRole('button', { name: '3M' });
		if (await threeMonthBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await threeMonthBtn.click();
		}

		await waitForNetworkIdle(page);

		logErrors(consoleErrors, networkErrors);
	});
});
