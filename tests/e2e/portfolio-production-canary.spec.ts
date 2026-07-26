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
		const trackResponse = await page.request.put(`/api/catalog/${catalogId}/track`, {
			data: { tracked: true }
		});
		const trackBody = await trackResponse.json();
		expect(trackResponse.status(), JSON.stringify(trackBody)).toBe(200);
		expect(trackBody).toMatchObject({ catalogId, tracked: true });
		tracked = true;

		const trackedResponse = await page.request.get(
			`${PARCHMENT_API}/v1/portfolio/tracked-lots?summaryLimit=0`,
			{ headers }
		);
		expect(trackedResponse.ok()).toBe(true);
		const trackedState = (await trackedResponse.json()) as { data: { catalogIds: number[] } };
		expect(trackedState.data.catalogIds).toContain(catalogId);

		const untrackResponse = await page.request.put(`/api/catalog/${catalogId}/track`, {
			data: { tracked: false }
		});
		expect(untrackResponse.status()).toBe(200);
		expect(await untrackResponse.json()).toMatchObject({ catalogId, tracked: false });
		tracked = false;
	} finally {
		if (tracked && catalogId !== undefined) {
			await page.request.put(`/api/catalog/${catalogId}/track`, {
				data: { tracked: false }
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
