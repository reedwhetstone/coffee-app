import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { initializeConnection } from './scriptDb.js';
import type { PoolClient } from 'pg';

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

async function checkExistingUrls(connection: PoolClient, urls: string[]): Promise<string[]> {
	// URLs to ignore
	const ignoredUrls = [
		'https://www.sweetmarias.com/green-coffee-subscription-gift.html',
		'https://www.sweetmarias.com/roasted-subscription-gift.html',
		'https://www.sweetmarias.com/rstd-subs-1050.html'
	];

	// Filter out ignored URLs first
	const filteredUrls = urls.filter((url) => !ignoredUrls.includes(url));

	// PostgreSQL uses $1, $2, etc. for parameterized queries instead of ?
	const placeholders = filteredUrls.map((_, index) => `$${index + 1}`).join(',');
	const { rows } = await connection.query(
		`SELECT link FROM coffee_catalog WHERE link IN (${placeholders})`,
		filteredUrls
	);
	const existingUrls = new Set(rows.map((row) => row.link));
	return filteredUrls.filter((url) => !existingUrls.has(url));
}

async function updateDatabase() {
	let client;
	try {
		// Assuming initializeConnection() now returns a pg.Pool or pg.Client
		const pool = await initializeConnection();
		client = await pool.connect();

		// Collect all product URLs
		const allProductUrls = await collectInitUrlsData();
		console.log(`Found ${allProductUrls.length} total products`);

		// Filter out existing URLs
		const newUrls = await checkExistingUrls(client, allProductUrls);
		console.log(`Found ${newUrls.length} new products to process`);

		// Take only first N URLs for testing
		//const urlsToProcess = newUrls.slice(0, 1);
		//console.log(`Processing first ${urlsToProcess.length} URLs`);

		// Process each URL
		for (const url of newUrls) {
			console.log(`Processing URL: ${url}`);
			const scrapedData = await scrapeUrl(url);

			if (scrapedData) {
				// Update INSERT query to use PostgreSQL parameter syntax
				await client.query(
					`INSERT INTO coffee_catalog (
						name,
						score_value,
						arrival_date,
						region,
						processing,
						drying_method,
						lot_size,
						bag_size,
						packaging,
						farm_gate,
						cultivar_detail,
						grade,
						appearance,
						roast_recs,
						type,
						link,
						description_long,
						description_short,
						farm_notes,
						last_updated
					) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())`,
					[
						scrapedData.productName,
						scrapedData.scoreValue,
						scrapedData['Arrival date'] || null,
						scrapedData['Region'] || null,
						scrapedData['Processing'] || null,
						scrapedData['Drying Method'] || null,
						scrapedData['Lot size'] || null,
						scrapedData['Bag size'] || null,
						scrapedData['Packaging'] || null,
						scrapedData['Farm Gate'] === 'Yes' ? true : false, // Changed to boolean for PostgreSQL
						scrapedData['Cultivar Detail'] || null,
						scrapedData['Grade'] || null,
						scrapedData['Appearance'] || null,
						scrapedData['Roast Recommendations'] || null,
						scrapedData['Type'] || null,
						scrapedData.url,
						scrapedData.descriptionLong || null,
						scrapedData.descriptionShort || null,
						scrapedData.farmNotes || null
					]
				);

				console.log(`Successfully inserted product: ${scrapedData.productName}`);
			}
		}

		console.log('Database update complete');
		return { success: true };
	} catch (error) {
		console.error('Error updating database:', error);
		throw error;
	} finally {
		if (client) {
			await client.release(); // Release the client back to the pool
		}
	}
}

export { updateDatabase };
