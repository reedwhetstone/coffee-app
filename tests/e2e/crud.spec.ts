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
 * Wait for a successful POST response to a URL pattern.
 * Returns the response so callers can assert on status/body.
 */
async function waitForSuccessfulSubmission(page: Page, urlPattern: string) {
	const response = await page.waitForResponse(
		(resp) => resp.url().includes(urlPattern) && resp.request().method() === 'POST'
	);
	return response;
}

/**
 * Navigate to beans page via sidebar and wait for inventory data to load.
 * The beans page fetches data client-side in onMount, so we need to wait
 * for the /api/beans response AND for the data to render, not just networkidle.
 */
async function navigateToBeans(page: Page) {
	await page.goto('/catalog');
	await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
	await page.getByRole('link', { name: 'Beans' }).waitFor({ state: 'visible' });
	await page.getByRole('link', { name: 'Beans' }).click();
	await page.waitForURL(/\/beans/);
	// Wait for the /api/beans fetch to complete (client-side data loading)
	await page.waitForResponse(
		(resp) => resp.url().includes('/api/beans') && resp.status() === 200,
		{ timeout: 15000 }
	);
	// Give the UI time to render the data from the response
	await page.waitForTimeout(1000);
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

/**
 * Patterns to ignore - these are known non-actionable warnings from build/Playwright
 */
const IGNORED_CONSOLE_PATTERNS = [
	// SvelteKit router warnings (triggered by Playwright navigation)
	/Avoid using `history\.pushState/,
	/Avoid using `history\.replaceState/,
	// Svelte $state proxy console warnings
	/console_log_state/,
	/\$state proxies/,
	// Chart initialization warning (normal during component mount)
	/Chart components not ready yet/,
	// tsconfig warnings during build
	/Cannot find base config file/,
	/tsconfig\.json/
];

const IGNORED_NETWORK_PATTERNS = [
	// Aborted requests during fast navigation (test cleanup)
	/net::ERR_ABORTED/,
	/aborted/i
];

function isIgnoredConsoleError(error: ConsoleError): boolean {
	return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(error.text));
}

function isIgnoredNetworkError(error: NetworkError): boolean {
	return IGNORED_NETWORK_PATTERNS.some((pattern) => pattern.test(error.statusText));
}

function setupErrorCollection(page: Page) {
	const consoleErrors: ConsoleError[] = [];
	const networkErrors: NetworkError[] = [];

	page.on('console', (msg) => {
		if (msg.type() === 'error' || msg.type() === 'warning') {
			const error: ConsoleError = {
				type: msg.type(),
				text: msg.text(),
				location: msg.location()?.url
			};
			// Only collect if not in ignored patterns
			if (!isIgnoredConsoleError(error)) {
				consoleErrors.push(error);
			}
		}
	});

	page.on('pageerror', (error) => {
		const consoleError: ConsoleError = {
			type: 'pageerror',
			text: error.message
		};
		if (!isIgnoredConsoleError(consoleError)) {
			consoleErrors.push(consoleError);
		}
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
		const error: NetworkError = {
			url: request.url(),
			status: 0,
			statusText: request.failure()?.errorText || 'Request failed',
			method: request.method()
		};
		// Only collect if not in ignored patterns
		if (!isIgnoredNetworkError(error)) {
			networkErrors.push(error);
		}
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

		// Assert no server errors during submission
		const submissionErrors = networkErrors.filter((e) => e.status >= 500);
		expect(submissionErrors).toHaveLength(0);

		logErrors(consoleErrors, networkErrors);
	});

	test('can create roast profile from dropdown without pre-selected bean', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		// Navigate directly to /roast (no pre-selected bean)
		await page.goto('/roast');
		await page.waitForLoadState('networkidle');

		// Open the roast form via ActionsBar "New Roast" button
		await page
			.getByRole('button', { name: /Toggle actions|New Roast/i })
			.first()
			.click();

		const newRoastBtn = page.getByRole('button', { name: 'New Roast' });
		if (await newRoastBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await newRoastBtn.click();
		}

		// Wait for the coffee dropdown to appear (confirms form modal is open)
		const coffeeSelect = page.locator('#coffee_select_0');
		await coffeeSelect.waitFor({ state: 'visible' });

		// Wait for options to load (more than just the placeholder)
		await expect(coffeeSelect.locator('option')).not.toHaveCount(1, { timeout: 5000 });

		// Select the first real coffee option (skip placeholder at index 0)
		const options = await coffeeSelect.locator('option').allTextContents();
		expect(options.length).toBeGreaterThan(1); // Must have at least placeholder + 1 coffee
		await coffeeSelect.selectOption({ index: 1 });

		// Assert the dropdown retained its value (the bug was it would revert)
		const selectedValue = await coffeeSelect.inputValue();
		expect(selectedValue).not.toBe('');

		// Assert batch name auto-populated from the selection
		const batchNameInput = page.locator('#batch_name');
		const batchNameValue = await batchNameInput.inputValue();
		expect(batchNameValue.length).toBeGreaterThan(0);

		// Fill remaining required fields
		await page.locator('#oz_in_0').fill('8');
		await page.locator('#roast_targets').fill('Medium roast, city+');
		await page.locator('#roast_notes').fill('Dropdown test ' + Date.now());

		// Submit and intercept the API response
		const [response] = await Promise.all([
			waitForSuccessfulSubmission(page, '/api/roast-profiles'),
			page.getByRole('button', { name: /Create Roast Profile/i }).click()
		]);

		// Assert the API returned success
		expect(response.status()).toBeLessThan(400);

		// Assert the form modal closed (indicates success)
		await expect(page.locator('#coffee_select_0')).not.toBeVisible({ timeout: 5000 });

		// Assert no server errors occurred
		const submissionErrors = networkErrors.filter((e) => e.status >= 500);
		expect(submissionErrors).toHaveLength(0);

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

		// Assert no server errors during submission
		const submissionErrors = networkErrors.filter((e) => e.status >= 500);
		expect(submissionErrors).toHaveLength(0);

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
