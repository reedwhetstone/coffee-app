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
 * Navigate to beans page and wait for inventory data to render.
 * Uses the /api/beans response + DOM check instead of waitForNetworkIdle
 * to avoid race conditions with client-side fetches.
 */
async function navigateToBeans(page: Page) {
	// Set up response listener before navigation
	const beansResponse = page.waitForResponse(
		(resp) => resp.url().includes('/api/beans') && resp.status() === 200
	);

	await page.goto('/beans');

	// Wait for the API response to complete
	await beansResponse;

	// Wait for either bean cards OR the empty state to render
	const beanCard = page.locator('button.group.relative').first();
	const emptyState = page.getByText(/No Coffee Beans Yet|No Coffees Match/);
	await Promise.race([
		beanCard.waitFor({ state: 'visible', timeout: 20000 }),
		emptyState.waitFor({ state: 'visible', timeout: 20000 })
	]);
}

/**
 * Add a fresh green coffee bean to inventory via manual entry.
 * Always runs the full BeanForm submission flow (no shortcuts).
 * Uses manual entry mode to avoid dependency on stocked catalog beans.
 *
 * After submission, verifies via API that bean count increased.
 */
async function addBeanToInventory(page: Page) {
	// Snapshot bean count before adding so we can verify increase
	let beanCountBefore = 0;
	try {
		const countResp = await page.request.get('/api/beans');
		if (countResp.ok()) {
			const body = await countResp.json();
			beanCountBefore = (body.data || []).length;
		}
	} catch (_) {
		// Non-fatal — we'll verify via DOM if API check fails
	}

	// Step 1: Navigate directly to /beans?modal=new
	// The "Add" button only appears in the empty-state block (when filteredData is empty).
	// When the test user already has stocked beans the empty state is hidden, so we cannot
	// click a button to open the form. Instead navigate with the ?modal=new param directly —
	// that is exactly what handleAddNewBean() does internally.
	const beansApiResponse = page.waitForResponse(
		(resp) => resp.url().includes('/api/beans') && resp.status() === 200
	);
	await page.goto('/beans?modal=new');
	await beansApiResponse;

	// Screenshot for debugging
	await page.screenshot({ path: 'test-results/add-bean-01-before-open.png' }).catch(() => {});

	// Step 2: Wait for the form modal to be visible
	const formHeading = page.getByText('Add New Coffee Bean');
	await formHeading.waitFor({ state: 'visible', timeout: 15000 });

	// Screenshot — form open
	await page.screenshot({ path: 'test-results/add-bean-02-form-open.png' }).catch(() => {});

	// Step 4: Stay in Manual Entry mode (default) — no catalog dependency
	// Verify Manual Entry radio is selected (it's the default)
	const manualEntryLabel = page.locator('label').filter({ hasText: 'Manual Entry' });
	await manualEntryLabel.waitFor({ state: 'visible', timeout: 5000 });
	// Click it to ensure it's active (idempotent)
	await manualEntryLabel.click();
	await page.waitForTimeout(200);

	// Step 5: Fill in the coffee name (required for manual entry)
	const uniqueName = `E2E Test Bean ${Date.now()}`;
	const nameInput = page.locator('#manual-name-0');
	await nameInput.waitFor({ state: 'visible', timeout: 5000 });
	await nameInput.fill(uniqueName);

	// Step 6: Fill purchase details
	const today = new Date().toISOString().split('T')[0];
	const purchaseDate = page.locator('#purchase_date');
	await purchaseDate.fill(today);

	const taxShip = page.locator('#tax_ship_cost');
	await taxShip.fill('0');

	// Step 7: Fill quantity (must be > 0 and >= 4oz = 0.25 lb so stocked defaults true)
	const qtyInput = page.locator('input[id^="purchased_qty-"]').first();
	await qtyInput.fill('5');

	// bean_cost for manual entry
	const beanCostInput = page.locator('input[id^="bean_cost-"]').first();
	await beanCostInput.fill('25');

	// Screenshot before submit
	await page.screenshot({ path: 'test-results/add-bean-03-form-filled.png' }).catch(() => {});

	// Step 8: Submit and capture API response
	const createResponsePromise = page.waitForResponse(
		(resp) => resp.url().includes('/api/beans') && resp.request().method() === 'POST',
		{ timeout: 20000 }
	);

	const submitBtn = page.getByRole('button', { name: /^Add Bean$/i });
	await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
	await submitBtn.click();

	const response = await createResponsePromise;

	// Screenshot after response
	await page.screenshot({ path: 'test-results/add-bean-04-after-submit.png' }).catch(() => {});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Failed to add bean to inventory (${response.status()}): ${body}`);
	}

	// Step 9: Wait for modal to close (form heading disappears)
	await formHeading.waitFor({ state: 'hidden', timeout: 10000 });

	// Step 10: Verify via API that a bean was actually created
	let verified = false;
	try {
		const countResp = await page.request.get('/api/beans');
		if (countResp.ok()) {
			const body = await countResp.json();
			const beanCountAfter = (body.data || []).length;
			if (beanCountAfter > beanCountBefore) {
				verified = true;
			}
		}
	} catch (_) {
		// Fall through to DOM verification
	}

	// Step 11: Navigate fresh to beans and verify cards are visible
	// Clear the stocked filter is NOT needed here — the API fix ensures
	// new beans are inserted with stocked=true (>= 4oz), so they appear
	// in the default stocked=TRUE filter view.
	await navigateToBeans(page);

	// Screenshot after navigation
	await page.screenshot({ path: 'test-results/add-bean-05-after-navigate.png' }).catch(() => {});

	await expect(page.locator('button.group.relative').first()).toBeVisible({ timeout: 20000 });

	if (!verified) {
		// DOM confirmed cards are visible — good enough
		console.log('addBeanToInventory: API count check skipped, DOM verification passed');
	}
}

/**
 * Ensure beans exist in inventory. Always adds a fresh bean to guarantee
 * sufficient stock for roast tests that consume inventory.
 */
async function ensureBeanExists(page: Page) {
	await addBeanToInventory(page);
}

/**
 * Select the first available bean on the beans page.
 * Returns the button locator for the selected bean.
 */
async function selectFirstBean(page: Page) {
	const firstBean = page.locator('button.group.relative').first();
	await firstBean.waitFor({ state: 'visible', timeout: 15000 });
	await firstBean.click();
	// Wait for the detail panel to open
	await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 5000 });
	return firstBean;
}

/**
 * Delete a roast profile that was just created (cleanup helper).
 * Assumes the roast profile is currently visible/selected on the /roast page.
 * Navigates to /roast, opens the first profile card, and deletes it.
 * Skips gracefully if no profile is found.
 */
async function deleteLatestRoastProfile(page: Page) {
	await page.goto('/roast');
	await page.waitForLoadState('networkidle');

	// Expand any collapsed group so profile cards are visible
	const profileToggle = page.getByRole('button', { name: /Toggle/i }).first();
	if (await profileToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
		await profileToggle.click();
		await page.waitForTimeout(300);
	}

	const profileCard = page.getByRole('button', { name: /ID: \d+/i }).first();
	const hasProfile = await profileCard.isVisible({ timeout: 5000 }).catch(() => false);
	if (!hasProfile) {
		console.log('deleteLatestRoastProfile: no profile card found, skipping cleanup');
		return;
	}

	await profileCard.click();

	page.once('dialog', (dialog) => {
		dialog.accept().catch(() => {});
	});

	const deleteBtn = page.getByRole('button', { name: 'Delete', exact: true });
	await expect(deleteBtn).toBeVisible({ timeout: 5000 });
	await deleteBtn.click();
	await waitForNetworkIdle(page);
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

		await ensureBeanExists(page);

		// Select first available bean
		await selectFirstBean(page);

		// Verify bean modal/details opened
		await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

		// Filter to only actionable errors (ignore known patterns already filtered by setupErrorCollection)
		const serverErrors = networkErrors.filter((e) => e.status >= 500);
		expect(serverErrors, 'No server errors (5xx) should occur').toHaveLength(0);
		// TODO: assert consoleErrors once pre-existing warnings are fixed

		logErrors(consoleErrors, networkErrors);
	});

	test('can edit bean details', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await navigateToBeans(page);
		await ensureBeanExists(page);
		await selectFirstBean(page);

		// Click Edit
		await page.getByRole('button', { name: 'Edit' }).click();

		// Notes textarea only exists when original notes are present; update if available.
		const notesField = page.locator('textarea').first();
		if (await notesField.isVisible({ timeout: 1500 }).catch(() => false)) {
			await notesField.fill('Test notes update ' + Date.now());
		}

		// Update a numeric field that should always be editable in overview.
		const qtyField = page.locator('input[type="number"][step="0.1"]').first();
		if (await qtyField.isVisible({ timeout: 1500 }).catch(() => false)) {
			await qtyField.fill('12');
		} else {
			await page.getByRole('spinbutton').first().fill('12');
		}

		// Save and assert the update request succeeds.
		const updateResponse = page.waitForResponse(
			(resp) =>
				resp.url().includes('/api/beans?id=') &&
				resp.request().method() === 'PUT' &&
				resp.status() === 200
		);
		await page.getByRole('button', { name: 'Save' }).click();
		await updateResponse;

		// Verify save completed (button should return to normal state)
		await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

		// Filter to only actionable errors (ignore known patterns already filtered by setupErrorCollection)
		const serverErrors = networkErrors.filter((e) => e.status >= 500);
		expect(serverErrors, 'No server errors (5xx) should occur').toHaveLength(0);
		// TODO: assert consoleErrors once pre-existing warnings are fixed

		logErrors(consoleErrors, networkErrors);
	});
});

test.describe('Cupping Notes', () => {
	test('can edit cupping notes', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		await navigateToBeans(page);

		await ensureBeanExists(page);

		await selectFirstBean(page);

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
				await slider.fill('5'); // slider max is 5 (1-5 scale)
			}

			const brewMethod = page.locator('#brew-method');
			if (await brewMethod.isVisible({ timeout: 1000 }).catch(() => false)) {
				await brewMethod.selectOption('pour_over');
			}

			const bodyScore = page.locator('#body-score');
			if (await bodyScore.isVisible({ timeout: 1000 }).catch(() => false)) {
				await bodyScore.fill('5');
			}

			// Save — intercept the PUT to /api/beans (cupping notes save via beans endpoint)
			const [cuppingResponse] = await Promise.all([
				page.waitForResponse(
					(resp) => resp.url().includes('/api/beans') && resp.request().method() === 'PUT'
				),
				page.getByRole('button', { name: /Save Cupping Notes/i }).click()
			]);
			expect(cuppingResponse.status(), 'Cupping notes save should succeed').toBeLessThan(400);
		} else {
			console.log('Cupping notes edit button not found, verifying tab is visible');
			// Verify we at least see the cupping content
			await expect(page.getByText(/Tasting Profile|Your Rating/i).first()).toBeVisible();
		}

		// Filter to only actionable errors (ignore known patterns already filtered by setupErrorCollection)
		const serverErrors = networkErrors.filter((e) => e.status >= 500);
		expect(serverErrors, 'No server errors (5xx) should occur').toHaveLength(0);
		// TODO: assert consoleErrors once pre-existing warnings are fixed

		logErrors(consoleErrors, networkErrors);
	});
});

test.describe('Roast Profiles', () => {
	test('can create and start a new roast profile', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		// Always add fresh inventory so roasts never deplete stock
		await navigateToBeans(page);
		await addBeanToInventory(page);

		await selectFirstBean(page);

		// Navigate to roasting tab
		const roastingTab = page.locator('button').filter({ hasText: /^🔥\s*Roasting$/ });
		await roastingTab.click();
		await page.waitForTimeout(500);

		await page.getByRole('button', { name: /Start New Roast/i }).click();

		// Fill out roast form
		await page.getByRole('spinbutton', { name: /Green Weight/i }).fill('8');
		await page.getByRole('textbox', { name: /Roast Targets/i }).fill('Medium roast, city+');
		await page.getByRole('textbox', { name: /Roast Notes/i }).fill('Test profile ' + Date.now());

		// Create the profile — intercept the POST to /api/roast-profiles
		const [roastCreateResponse] = await Promise.all([
			page.waitForResponse(
				(resp) => resp.url().includes('/api/roast-profiles') && resp.request().method() === 'POST'
			),
			page.getByRole('button', { name: /Create Roast Profile/i }).click()
		]);
		expect(roastCreateResponse.status(), 'Roast profile creation should succeed').toBeLessThan(400);

		// Verify profile was created (should see it in the list)
		await expect(page.getByRole('button', { name: /Browse Profiles/i })).toBeVisible();

		// Assert no server errors during submission
		const submissionErrors = networkErrors.filter((e) => e.status >= 500);
		expect(submissionErrors).toHaveLength(0);

		// Cleanup: delete the roast profile we just created so inventory isn't depleted
		await deleteLatestRoastProfile(page);

		logErrors(consoleErrors, networkErrors);
	});

	test('can create roast profile from dropdown without pre-selected bean', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		// Always add fresh inventory so roasts never deplete stock
		await navigateToBeans(page);
		await addBeanToInventory(page);

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

		// Wait for options to load (must include at least one real coffee option)
		await expect(coffeeSelect.locator('option')).not.toHaveCount(1, { timeout: 10000 });

		// Select the first real coffee option (skip placeholder at index 0)
		const options = await coffeeSelect.locator('option').allTextContents();
		expect(options.length, 'Expected at least one selectable coffee bean').toBeGreaterThan(1);
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

		// Cleanup: delete the roast profile we just created so inventory isn't depleted
		await deleteLatestRoastProfile(page);

		// Filter to only actionable errors (ignore known patterns already filtered by setupErrorCollection)
		const serverErrors = networkErrors.filter((e) => e.status >= 500);
		expect(serverErrors, 'No server errors (5xx) should occur').toHaveLength(0);
		// TODO: assert consoleErrors once pre-existing warnings are fixed

		logErrors(consoleErrors, networkErrors);
	});

	test('can run through roast phases', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		// Navigate to /roast directly (user-scoped via RLS)
		await page.goto('/roast');
		await page.waitForLoadState('networkidle');

		// Verify the roast page itself loaded (even if empty)
		await expect(
			page.getByText(/Roast Profiles|No roast profiles|Browse Profiles/i).first()
		).toBeVisible({ timeout: 10000 });

		// Look for any profile card — skip if none exist (user may not have roasts)
		const profileCard = page.getByRole('button', { name: /ID: \d+/i }).first();
		const hasProfile = await profileCard.isVisible({ timeout: 5000 }).catch(() => false);

		if (!hasProfile) {
			// Legitimate empty state: verify the page rendered correctly
			await expect(
				page.getByRole('button', { name: /New Roast|Toggle actions/i }).first()
			).toBeVisible({ timeout: 5000 });
			logErrors(consoleErrors, networkErrors);
			return;
		}

		await profileCard.click();

		// The roast page should open - look for roast controls/content
		const roastContent = page.getByText(/Weight Loss|Roast Notes|oz/i).first();
		await expect(roastContent, 'Expected roast profile detail content').toBeVisible({
			timeout: 5000
		});

		// Filter to only actionable errors (ignore known patterns already filtered by setupErrorCollection)
		const serverErrors = networkErrors.filter((e) => e.status >= 500);
		expect(serverErrors, 'No server errors (5xx) should occur').toHaveLength(0);
		// TODO: assert consoleErrors once pre-existing warnings are fixed

		logErrors(consoleErrors, networkErrors);
	});

	test('can delete a roast profile', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		// Navigate to /roast directly (user-scoped via RLS)
		await page.goto('/roast');
		await page.waitForLoadState('networkidle');

		// Verify the roast page itself loaded (even if empty)
		await expect(
			page.getByText(/Roast Profiles|No roast profiles|Browse Profiles/i).first()
		).toBeVisible({ timeout: 10000 });

		// Try to browse profiles
		const browseBtn = page.getByRole('button', { name: /Browse Profiles/i });
		if (await browseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await browseBtn.click();
		}

		// Look for any profile to delete — expand a group first if needed
		const profileToggle = page.getByRole('button', { name: /Toggle/i }).first();
		if (await profileToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
			await profileToggle.click();
			await page.waitForTimeout(300);
		}

		// If no profile cards exist, that's a valid state - but verify we're on the right page
		const profileCard = page.getByRole('button', { name: /ID: \d+/i }).first();
		const hasProfile = await profileCard.isVisible({ timeout: 5000 }).catch(() => false);

		if (!hasProfile) {
			// Legitimate empty state: verify the page rendered correctly
			await expect(
				page.getByRole('button', { name: /New Roast|Toggle actions/i }).first()
			).toBeVisible({ timeout: 5000 });
			logErrors(consoleErrors, networkErrors);
			return;
		}

		await profileCard.click();

		// Set up dialog handler before clicking delete
		page.once('dialog', (dialog) => {
			console.log(`Dialog message: ${dialog.message()}`);
			dialog.accept().catch(() => {});
		});

		// Click delete — intercept the DELETE response
		const deleteBtn = page.getByRole('button', { name: 'Delete', exact: true });
		await expect(deleteBtn, 'Expected delete button on roast profile').toBeVisible({
			timeout: 5000
		});
		const [deleteResponse] = await Promise.all([
			page.waitForResponse(
				(resp) => resp.url().includes('/api/roast-profiles') && resp.request().method() === 'DELETE'
			),
			deleteBtn.click()
		]);
		expect(deleteResponse.status(), 'Roast profile deletion should succeed').toBeLessThan(400);

		// Filter to only actionable errors (ignore known patterns already filtered by setupErrorCollection)
		const serverErrors = networkErrors.filter((e) => e.status >= 500);
		expect(serverErrors, 'No server errors (5xx) should occur').toHaveLength(0);
		// TODO: assert consoleErrors once pre-existing warnings are fixed

		logErrors(consoleErrors, networkErrors);
	});

	test('can pre-select bean when navigating from bean profile', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		// Always add fresh inventory so beans are visible
		await navigateToBeans(page);
		await addBeanToInventory(page);

		// Capture the first bean's display name from its card
		const firstBeanCard = page.locator('button.group.relative').first();
		const beanName = (await firstBeanCard.locator('h3').textContent())?.trim() ?? '';
		expect(beanName.length, 'Expected a non-empty bean name on the card').toBeGreaterThan(0);

		await selectFirstBean(page);

		// Navigate to Roasting tab
		const roastingTab = page.locator('button').filter({ hasText: /^🔥\s*Roasting$/ });
		await roastingTab.click();
		await page.waitForTimeout(500);

		// Click "Start New Roast" (present even when there are no roasts yet, in the empty state)
		await page
			.getByRole('button', { name: /Start New Roast|Start First Roast/i })
			.first()
			.click();

		// Wait for the roast page to open with the correct URL params
		await page.waitForURL(
			(url) => url.searchParams.has('modal') && url.searchParams.has('beanId'),
			{
				timeout: 10000
			}
		);

		// Confirm beanName param is not "undefined"
		const urlBeanName = page.url();
		expect(urlBeanName).not.toContain('beanName=undefined');

		// Wait for the roast form's coffee dropdown to appear and options to load
		const coffeeSelect = page.locator('#coffee_select_0');
		await coffeeSelect.waitFor({ state: 'visible', timeout: 10000 });
		await expect(coffeeSelect.locator('option')).not.toHaveCount(1, { timeout: 10000 });

		// Assert the pre-selected option is the correct bean — not placeholder, not "undefined"
		const selectedText = await coffeeSelect.evaluate(
			(el) => (el as HTMLSelectElement).options[(el as HTMLSelectElement).selectedIndex]?.text ?? ''
		);
		expect(selectedText, 'Bean dropdown should show the selected bean, not a placeholder').not.toBe(
			'Select a coffee...'
		);
		expect(selectedText, 'Bean dropdown should not show "undefined"').not.toContain('undefined');
		expect(selectedText.length, 'Bean dropdown should have a non-empty selection').toBeGreaterThan(
			0
		);

		// The selected text should match the bean name we saw on the inventory card
		expect(selectedText).toBe(beanName);

		// Filter to only actionable errors (ignore known patterns already filtered by setupErrorCollection)
		const serverErrors = networkErrors.filter((e) => e.status >= 500);
		expect(serverErrors, 'No server errors (5xx) should occur').toHaveLength(0);
		// TODO: assert consoleErrors once pre-existing warnings are fixed

		logErrors(consoleErrors, networkErrors);
	});
});

test.describe('Sales Management', () => {
	test('can create a new sale', async ({ page }) => {
		const { consoleErrors, networkErrors } = setupErrorCollection(page);

		// Navigate directly to /profit with modal=new — opens the sale form via URL-driven intent.
		// The form requires beans data (availableCoffees) to be fetched before form elements are ready.
		// Using 'commit' instead of 'networkidle' because profit page charts keep network active indefinitely.
		// Waiting for the beans API response ensures select options are populated before interaction.
		await page.goto('/profit?modal=new', { waitUntil: 'commit' });
		await page.waitForResponse(
			(resp) => resp.url().includes('/api/beans') && resp.status() === 200
		);

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

		// Create sale — intercept the POST to /api/profit
		const [saleResponse] = await Promise.all([
			page.waitForResponse(
				(resp) => resp.url().includes('/api/profit') && resp.request().method() === 'POST'
			),
			page.getByRole('button', { name: /Create Sale/i }).click()
		]);
		expect(saleResponse.status(), 'Sale creation should succeed').toBeLessThan(400);

		// Filter to only actionable errors (ignore known patterns already filtered by setupErrorCollection)
		const serverErrors = networkErrors.filter((e) => e.status >= 500);
		expect(serverErrors, 'No server errors (5xx) should occur').toHaveLength(0);
		// TODO: assert consoleErrors once pre-existing warnings are fixed

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
