import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(
	new URL('../../../notes/pr-audits/assets/cherry-reading/', import.meta.url)
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
	executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
	headless: true,
	args: ['--no-sandbox']
});
const results = [];
const base = process.env.CHERRY_UI_BASE_URL ?? 'http://127.0.0.1:5198';
for (const [name, viewport, drawer] of [
	['desktop', { width: 1366, height: 768 }, false],
	['mobile', { width: 390, height: 844 }, false],
	['drawer', { width: 1366, height: 768 }, true]
]) {
	const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.route('**/*', (route) =>
		route.request().url().startsWith(base) ? route.continue() : route.abort()
	);
	try {
		await page.goto(`${base}/?state=reading${drawer ? '&surface=drawer' : ''}`);
		if (drawer)
			await page.getByRole('button', { name: 'Cherry Synthesis Agent', exact: true }).click();
		const input = page.getByRole('textbox');
		const log = page.getByRole('log');
		const gap = () => log.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
		const requestCount = () =>
			page.evaluate(() => window.fixtureRequests.filter((r) => r.url === '/api/chat').length);
		await expect(input).toBeEnabled();
		await expect.poll(gap).toBeLessThan(5);
		await input.fill('Original request');
		await input.press('Enter');
		await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
		await expect.poll(gap).toBeLessThan(5);
		// A real wheel action disengages following, not just a synthetic scroll event.
		await log.hover();
		await page.mouse.wheel(0, -1800);
		await expect(page.getByRole('button', { name: 'Jump to latest', exact: true })).toBeVisible();
		await input.fill('My next question');
		await input.press('Enter');
		await expect.poll(requestCount).toBe(1);
		const readingTop = await log.evaluate((el) => el.scrollTop);
		await page.evaluate(() =>
			window.fixtureStream.emit('\n\nNew output while reading older answers. '.repeat(45))
		);
		await expect(
			page.getByRole('button', { name: 'New output · Jump to latest', exact: true })
		).toBeVisible();
		// Wait across queued frames and late layout to catch delayed forced scrolling.
		await page.evaluate(
			() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
		);
		expect(Math.abs((await log.evaluate((el) => el.scrollTop)) - readingTop)).toBeLessThan(5);
		await expect(input).toBeFocused();
		await input.press('Shift+Enter');
		await input.pressSequentially('A second line');
		const draft = await input.inputValue();
		await page.evaluate(
			() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
		);
		expect(Math.abs((await log.evaluate((el) => el.scrollTop)) - readingTop)).toBeLessThan(5);
		if (drawer) {
			await page.getByRole('button', { name: 'Close Cherry Synthesis Agent', exact: true }).click();
			await page.evaluate(() => window.fixtureStream.emit(' More output while drawer is closed.'));
			await page.getByRole('button', { name: 'Cherry Synthesis Agent', exact: true }).click();
			await expect(input).toHaveValue(draft);
			await expect(
				page.getByRole('button', { name: 'New output · Jump to latest', exact: true })
			).toBeVisible();
			expect(Math.abs((await log.evaluate((el) => el.scrollTop)) - readingTop)).toBeLessThan(5);
		}
		await page.screenshot({ path: out + name + '-reading.png' });
		// Keyboard activation returns focus to the latest message, not the page body.
		const jump = page.getByRole('button', { name: 'New output · Jump to latest', exact: true });
		await jump.focus();
		await jump.press('Enter');
		await expect.poll(gap).toBeLessThan(5);
		await expect(page.locator('[id^="msg-working-answer"]')).toBeFocused();
		await page.evaluate(() =>
			window.fixtureStream.emit('\n\nFollowing the latest output again. '.repeat(20))
		);
		await expect.poll(gap).toBeLessThan(5);
		await page.evaluate(() => window.fixtureStream.finish());
		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(input).toHaveValue(draft);
		expect(await requestCount()).toBe(1);
		// Evidence source navigation deliberately pauses following even after completion.
		await page.getByRole('button', { name: /^Evidence \d/ }).click();
		await page.getByRole('button', { name: 'Go to source message' }).click();
		await expect(page.locator('#msg-answer-1')).toBeFocused();
		await expect(page.getByRole('button', { name: 'Jump to latest', exact: true })).toBeVisible();
		await expect(input).toHaveValue(draft);
		// Manual return to the bottom acknowledges output without pressing the control.
		await log.evaluate((el) => {
			el.scrollTop = el.scrollHeight;
		});
		await expect(page.getByRole('button', { name: /Jump to latest/ })).toHaveCount(0);
		await input.fill('Second request');
		await input.press('Enter');
		await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
		await input.fill('Draft survives stop');
		await page.getByRole('button', { name: 'Stop response' }).click();
		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(input).toHaveValue('Draft survives stop');
		await input.fill('Third request');
		await input.press('Enter');
		await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
		await input.fill('Draft survives retry');
		await page.evaluate(() => window.fixtureStream.fail());
		await page.getByRole('button', { name: 'Retry', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
		expect(
			await page.evaluate(
				() =>
					window.fixtureRequests
						.filter((r) => r.url === '/api/chat')
						.at(-1)
						.body.messages.at(-1).parts
			)
		).toEqual([{ type: 'text', text: 'Third request' }]);
		await expect(input).toHaveValue('Draft survives retry');
		await page.evaluate(() => window.fixtureStream.finish());
		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(input).toHaveValue('Draft survives retry');
		expect(await requestCount()).toBe(4);
		if (drawer) {
			await page.getByRole('button', { name: 'Close Cherry Synthesis Agent', exact: true }).click();
			await page.getByRole('button', { name: 'Cherry Synthesis Agent', exact: true }).click();
			await expect(input).toHaveValue('Draft survives retry');
		}
		expect(errors).toEqual([]);
		results.push({ name, status: 'pass' });
		console.log('PASS', name);
	} catch (error) {
		results.push({ name, status: 'fail', error: String(error), stack: error.stack, errors });
		await page.screenshot({ path: out + name + '-failure.png' });
		console.error('FAIL', name, String(error));
	} finally {
		await page.close();
	}
}
await browser.close();
await writeFile(
	out + 'results.json',
	JSON.stringify(
		{
			fixture:
				'100-turn synthetic conversation in actual root/chat components; desktop, mobile and drawer; no production data.',
			results
		},
		null,
		'\t'
	) + '\n'
);
if (results.some((r) => r.status === 'fail')) process.exitCode = 1;
