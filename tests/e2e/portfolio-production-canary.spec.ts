import { expect, test } from '@playwright/test';

const PARCHMENT_API = 'https://api.purveyors.io';

test('production tracked-lot session path restores its prior state', async ({ page }) => {
	const cookies = await page.context().cookies();
	const authCookies = cookies
		.filter((cookie) => /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/.test(cookie.name))
		.sort((left, right) => {
			const leftIndex = Number(left.name.match(/\.(\d+)$/)?.[1] ?? 0);
			const rightIndex = Number(right.name.match(/\.(\d+)$/)?.[1] ?? 0);
			return leftIndex - rightIndex;
		});
	expect(authCookies.length).toBeGreaterThan(0);

	const session = JSON.parse(authCookies.map((cookie) => cookie.value).join('')) as {
		access_token: string;
	};
	expect(session.access_token).toBeTruthy();
	const headers = { Authorization: `Bearer ${session.access_token}` };

	// Clean up rows left by earlier canary assertion retries. Each id was
	// selected only after proving it absent from the pre-canary owner set.
	for (const leakedCanaryId of [653, 416, 417]) {
		const cleanupResponse = await page.request.delete(
			`${PARCHMENT_API}/v1/portfolio/tracked-lots/${leakedCanaryId}`,
			{ headers }
		);
		expect(cleanupResponse.ok()).toBe(true);
	}

	const meResponse = await page.request.get(`${PARCHMENT_API}/v1/me`, { headers });
	expect(meResponse.ok()).toBe(true);
	expect(await meResponse.json()).toMatchObject({
		authenticated: true,
		authKind: 'session',
		primaryAppRole: 'member'
	});

	const beforeResponse = await page.request.get(
		`${PARCHMENT_API}/v1/portfolio/tracked-lots?summaryLimit=0`,
		{ headers }
	);
	expect(beforeResponse.ok()).toBe(true);
	const before = (await beforeResponse.json()) as { data: { catalogIds: number[] } };

	const catalogResponse = await page.request.get(`${PARCHMENT_API}/v1/catalog?limit=25`, {
		headers
	});
	expect(catalogResponse.ok()).toBe(true);
	const catalog = (await catalogResponse.json()) as { data: Array<{ id: number }> };
	const catalogId = catalog.data.find(({ id }) => !before.data.catalogIds.includes(id))?.id;
	expect(catalogId).toBeDefined();

	let tracked = false;
	try {
		const trackResponse = await page.request.put(
			`${PARCHMENT_API}/v1/portfolio/tracked-lots/${catalogId}`,
			{ headers }
		);
		const trackBody = await trackResponse.json();
		expect(trackResponse.status(), JSON.stringify(trackBody)).toBe(200);
		tracked = true;
		expect(trackBody).toMatchObject({ data: { catalogId, tracked: true } });

		const trackedResponse = await page.request.get(
			`${PARCHMENT_API}/v1/portfolio/tracked-lots?summaryLimit=0`,
			{ headers }
		);
		expect(trackedResponse.ok()).toBe(true);
		const trackedState = (await trackedResponse.json()) as { data: { catalogIds: number[] } };
		expect(trackedState.data.catalogIds).toContain(catalogId);

		const untrackResponse = await page.request.delete(
			`${PARCHMENT_API}/v1/portfolio/tracked-lots/${catalogId}`,
			{ headers }
		);
		expect(untrackResponse.status()).toBe(200);
		expect(await untrackResponse.json()).toMatchObject({
			data: { catalogId, tracked: false }
		});
		tracked = false;
	} finally {
		if (tracked && catalogId !== undefined) {
			await page.request.delete(`${PARCHMENT_API}/v1/portfolio/tracked-lots/${catalogId}`, {
				headers
			});
		}
	}

	const afterResponse = await page.request.get(
		`${PARCHMENT_API}/v1/portfolio/tracked-lots?summaryLimit=0`,
		{ headers }
	);
	expect(afterResponse.ok()).toBe(true);
	const after = (await afterResponse.json()) as { data: { catalogIds: number[] } };
	expect(after.data.catalogIds).toEqual(before.data.catalogIds);
});
