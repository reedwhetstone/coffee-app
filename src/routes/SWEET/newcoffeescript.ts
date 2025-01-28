import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { supabase } from '$lib/server/db';

// Load environment variables
dotenv.config();

interface ScrapedData {
	productName: string | null;
	url: string;
	scoreValue: number | null;
	[key: string]: any; // This allows for dynamic string keys
}

async function collectInitUrlsData() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		await page.goto(
			'https://www.sweetmarias.com/green-coffee.html?product_list_limit=all&sm_status=1',
			{ timeout: 60000 }
		);
		await page.waitForTimeout(2000); // Give page time to load

		const urls = await page.evaluate(() => {
			const links = document.querySelectorAll('a.product-item-link.generated');
			return Array.from(links).map((link) => (link as HTMLAnchorElement).href);
		});

		await browser.close();
		return urls;
	} catch (error) {
		console.error('Error collecting URLs:', error);
		await browser.close();
		return [];
	}
}

async function scrapeUrl(url: string): Promise<ScrapedData | null> {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		await page.goto(url, { timeout: 60000 });
		await page.waitForTimeout(200);

		// Add product name extraction
		const productName = await page.evaluate(() => {
			const nameElement = document.querySelector(
				'#maincontent > div > div.column.main > div.product-main-container > div > div.page-title-wrapper.product > h1 > span'
			);
			return nameElement ? (nameElement as HTMLElement).innerText.trim() : null;
		});

		// Add description_short extraction
		const descriptionShort = await page.evaluate(() => {
			const descElement = document.querySelector(
				'#maincontent > div > div > div.product-main-container > div > div.product.attribute.overview > div > p'
			);
			return descElement ? (descElement as HTMLElement).innerText.trim() : null;
		});

		// Add score value extraction
		const scoreValue = await page.evaluate(() => {
			const scoreElement = document.querySelector('div.score-value');
			return scoreElement ? parseInt((scoreElement as HTMLElement).innerText, 10) : null;
		});

		// Add description_long extraction
		const descriptionLong = await page.evaluate(() => {
			const descElement = document.querySelector(
				'#product\\.info\\.description > div > div > div > div.column-right > div.product.attribute.cupping-notes > div.value > p'
			);
			return descElement ? (descElement as HTMLElement).innerText.trim() : null;
		});

		// Click farm notes tab and extract farm_notes
		await page.click('#tab-label-product-info-origin-notes-title');
		await page.waitForTimeout(200);
		const farmNotes = await page.evaluate(() => {
			const notesElement = document.querySelector(
				'#product-info-origin-notes > div > div > div.column-right > p'
			);
			return notesElement ? (notesElement as HTMLElement).innerText.trim() : null;
		});

		await page.click('#tab-label-product\\.info\\.specs-title');
		await page.waitForSelector('#product-attribute-specs-table', { state: 'visible' });

		const results = await page.evaluate(() => {
			const rows = document.querySelectorAll('#product-attribute-specs-table tbody tr');
			const data: { [key: string]: string } = {};

			rows.forEach((row) => {
				const header = row.querySelector('th')?.innerText.trim();
				const value = row.querySelector('td')?.innerText.trim();
				if (header && value) {
					data[header] = value;
				}
			});

			return data;
		});

		await browser.close();
		return {
			...results,
			scoreValue,
			productName,
			url,
			descriptionShort,
			descriptionLong,
			farmNotes
		};
	} catch (error) {
		console.error(`Error scraping ${url}:`, error);
		await browser.close();
		return null;
	}
}

async function checkExistingUrls(urls: string[]): Promise<string[]> {
	const ignoredUrls = [
		'https://www.sweetmarias.com/green-coffee-subscription-gift.html',
		'https://www.sweetmarias.com/roasted-subscription-gift.html',
		'https://www.sweetmarias.com/rstd-subs-1050.html'
	];

	const filteredUrls = urls.filter((url) => !ignoredUrls.includes(url));

	const { data: existingUrls, error } = await supabase
		.from('coffee_catalog')
		.select('link')
		.in('link', filteredUrls);

	if (error) throw error;

	const existingUrlSet = new Set(existingUrls.map((row) => row.link));
	return filteredUrls.filter((url) => !existingUrlSet.has(url));
}

async function updateDatabase() {
	try {
		const allProductUrls = await collectInitUrlsData();
		console.log(`Found ${allProductUrls.length} total products`);

		const newUrls = await checkExistingUrls(allProductUrls);
		console.log(`Found ${newUrls.length} new products to process`);

		for (const url of newUrls) {
			console.log(`Processing URL: ${url}`);
			const scrapedData = await scrapeUrl(url);

			if (scrapedData) {
				const { error } = await supabase.from('coffee_catalog').insert({
					name: scrapedData.productName,
					score_value: scrapedData.scoreValue,
					arrival_date: scrapedData['Arrival date'] || null,
					region: scrapedData['Region'] || null,
					processing: scrapedData['Processing'] || null,
					drying_method: scrapedData['Drying Method'] || null,
					lot_size: scrapedData['Lot size'] || null,
					bag_size: scrapedData['Bag size'] || null,
					packaging: scrapedData['Packaging'] || null,
					farm_gate: scrapedData['Farm Gate'] === 'Yes',
					cultivar_detail: scrapedData['Cultivar Detail'] || null,
					grade: scrapedData['Grade'] || null,
					appearance: scrapedData['Appearance'] || null,
					roast_recs: scrapedData['Roast Recommendations'] || null,
					type: scrapedData['Type'] || null,
					link: scrapedData.url,
					description_long: scrapedData.descriptionLong || null,
					description_short: scrapedData.descriptionShort || null,
					farm_notes: scrapedData.farmNotes || null,
					last_updated: new Date().toISOString()
				});

				if (error) throw error;
				console.log(`Successfully inserted product: ${scrapedData.productName}`);
			}
		}

		console.log('Database update complete');
		return { success: true };
	} catch (error) {
		console.error('Error updating database:', error);
		throw error;
	}
}

export { updateDatabase };
