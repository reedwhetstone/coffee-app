import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.CHERRY_UI_BASE_URL ?? 'http://127.0.0.1:5198';
const out = fileURLToPath(
	new URL('../../../notes/pr-audits/assets/cherry-compact/', import.meta.url)
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
	executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
	headless: true,
	args: ['--no-sandbox']
});
const geometry = [];
const failures = [];
const checks = [];
const viewports = {
	desktop: { width: 1440, height: 900 },
	laptop: { width: 1366, height: 768 },
	mobile: { width: 390, height: 844 },
	narrow: { width: 320, height: 640 },
	reflow: { width: 683, height: 384 }
};

async function record(page, name, viewport) {
	const dimensions = await page.evaluate(() => {
		const rect = (selector) => {
			const element =
				selector === '[data-chat-composer]'
					? document.querySelector('form')?.parentElement
					: document.querySelector(selector);
			if (!element) return null;
			const { x, y, width, height } = element.getBoundingClientRect();
			return { x, y, width, height };
		};
		return {
			transcript: rect('[role="log"]'),
			composer: rect('[data-chat-composer]'),
			input: rect('textarea'),
			documentWidth: document.documentElement.scrollWidth,
			viewportWidth: innerWidth,
			viewportHeight: innerHeight
		};
	});
	geometry.push({ name, ...dimensions });
	expect(dimensions.documentWidth, `${name}: horizontal document overflow`).toBeLessThanOrEqual(
		viewport.width
	);
	if (!name.includes('evidence')) {
		expect(
			dimensions.input.y + dimensions.input.height,
			`${name}: input outside viewport`
		).toBeLessThanOrEqual(viewport.height);
	}
	await page.screenshot({ path: out + name + '.png' });
}

async function assertPanelVisible(page, label) {
	const trigger = page.locator(`summary[aria-label="${label}"]`);
	await trigger.click();
	const box = await trigger.locator('..').locator(':scope > div').boundingBox();
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
	expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
	return trigger;
}

for (const [size, viewport] of Object.entries(viewports)) {
	for (const state of ['narrow', 'reflow'].includes(size)
		? ['settled', 'context', 'drawer']
		: ['empty', 'settled', 'working', 'error', 'context', 'evidence', 'drawer']) {
		const name = `${size}-${state}`;
		const page = await browser.newPage({
			viewport,
			colorScheme: 'light',
			hasTouch: ['mobile', 'narrow'].includes(size),
			isMobile: ['mobile', 'narrow'].includes(size)
		});
		await page.route('**/*', (route) =>
			new URL(route.request().url()).origin === base ? route.continue() : route.abort()
		);
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		try {
			await page.goto(
				`${base}/?state=${state === 'drawer' ? 'settled' : state}${state === 'drawer' ? '&surface=drawer' : ''}`
			);
			if (state === 'drawer')
				await page.getByRole('button', { name: 'Cherry Synthesis Agent', exact: true }).click();
			await expect(
				page.getByRole('textbox', { name: 'Message Cherry Synthesis Agent' })
			).toBeEnabled();
			await page.evaluate(() => document.fonts.ready);
			if (state === 'drawer') {
				const focused = page.locator(':focus');
				await expect(focused).toBeVisible();
				expect(
					await focused.evaluate(
						(el) =>
							!!el.closest('[role="dialog"]') &&
							(!el.closest('details:not([open])') || el.tagName === 'SUMMARY')
					)
				).toBe(true);
			}
			await page.waitForTimeout(250);
			if (['working', 'error'].includes(state)) {
				await page.getByRole('textbox').fill('Compare these coffees');
				await page.getByRole('button', { name: 'Send message' }).click();
				if (state === 'working')
					await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
				else await expect(page.getByRole('alert')).toBeVisible();
			}
			if (state === 'context') {
				const label = await page
					.locator('summary[aria-label^="Context:"]')
					.getAttribute('aria-label');
				await assertPanelVisible(page, label);
			}
			if (state === 'evidence') {
				await page.getByRole('button', { name: /^Evidence \d/ }).click();
				await expect(page.getByRole('button', { name: 'Go to source message' })).toBeVisible();
			}
			if (!['working', 'error', 'evidence'].includes(state))
				await page.getByRole('log').evaluate((element) => {
					element.scrollTop = 0;
				});
			await page.waitForTimeout(200);
			await record(page, name, viewport);
			if (['desktop', 'laptop', 'mobile'].includes(size) && ['empty', 'settled'].includes(state)) {
				const transcript = geometry.at(-1).transcript.height;
				expect(transcript).toBeGreaterThanOrEqual(size === 'mobile' ? 507 : viewport.height - 144);
			}
			if (state === 'settled' || state === 'drawer') {
				const menu = await assertPanelVisible(page, 'Workspace actions');
				await page.keyboard.press('Escape');
				await expect(menu).toBeFocused();
				await expect(menu.locator('..')).not.toHaveAttribute('open');
				await expect(page.getByRole('textbox')).toBeVisible();
				await menu.click();
				await page.getByRole('button', { name: 'Conversation memory' }).click();
				await expect(page.getByRole('dialog', { name: 'Memory document' })).toBeVisible();
				await page.keyboard.press('Escape');
				await expect(menu).toBeFocused();
				const context = page.locator('summary[aria-label^="Context:"]');
				await context.click();
				const toggle = page.getByRole('button', { name: /^Workspace memory/ });
				await expect(toggle).toHaveAttribute('aria-pressed', 'true');
				await toggle.click();
				await expect(toggle).toHaveAttribute('aria-pressed', 'false');
				await page.keyboard.press('Escape');
				await expect(context).toBeFocused();
				const suggestions = await assertPanelVisible(page, 'Suggested prompts');
				const suggested = suggestions.locator('..').getByRole('button').first();
				await suggested.click();
				await expect(page.getByRole('textbox')).not.toHaveValue('');
				await expect(page.getByRole('textbox')).toBeFocused();
				await expect(suggestions.locator('..')).not.toHaveAttribute('open');
				if (state === 'drawer') {
					const draft = await page.getByRole('textbox').inputValue();
					await page
						.getByRole('button', { name: 'Close Cherry Synthesis Agent', exact: true })
						.click();
					await page.getByRole('button', { name: 'Cherry Synthesis Agent', exact: true }).click();
					await expect(page.getByRole('textbox')).toHaveValue(draft);
				}
				if (size === 'mobile' && state !== 'drawer') {
					await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toHaveCount(0);
					await page.getByRole('button', { name: 'Open app menu' }).click();
					await expect(page.getByRole('dialog', { name: 'Menu', exact: true })).toBeVisible();
					await page.keyboard.press('Escape');
					await expect(page.getByRole('button', { name: 'Open app menu' })).toBeFocused();
				}
			}
			if (state === 'evidence') {
				await page.getByRole('button', { name: 'Go to source message' }).click();
				await expect(page.locator('#msg-answer-1')).toBeFocused();
				await expect(page.getByRole('button', { name: /^Evidence \d/ })).toHaveAttribute(
					'aria-expanded',
					'false'
				);
			}
			expect(errors).toEqual([]);
			checks.push(name);
			console.log('PASS', name);
		} catch (error) {
			failures.push({ name, error: String(error), pageErrors: errors });
			await page.screenshot({ path: out + name + '-failure.png' });
			console.error('FAIL', name, String(error).slice(0, 600));
		} finally {
			await page.close();
		}
	}
}
await browser.close();
await writeFile(out + 'geometry.json', JSON.stringify(geometry, null, 2) + '\n');
await writeFile(
	out + 'results.json',
	JSON.stringify(
		{
			fixture:
				'Actual root +layout, /chat +page, app navigation, workspace, composer, evidence, and drawer; synthetic auth/network; no SSR or real mobile keyboard.',
			checks,
			failures
		},
		null,
		2
	) + '\n'
);
console.log(`${checks.length} passed; ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
