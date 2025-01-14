import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { initializeConnection } from './scriptDb.js';
import type { Connection } from 'mysql2/promise';

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

		// Add score value extraction
		const scoreValue = await page.evaluate(() => {
			const scoreElement = document.querySelector('div.score-value');
			return scoreElement ? parseInt((scoreElement as HTMLElement).innerText, 10) : null;
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
		return { ...results, scoreValue, productName, url };
	} catch (error) {
		console.error(`Error scraping ${url}:`, error);
		await browser.close();
		return null;
	}
}

async function checkExistingUrls(connection: Connection, urls: string[]): Promise<string[]> {
	// URLs to ignore
	const ignoredUrls = [
		'https://www.sweetmarias.com/green-coffee-subscription-gift.html',
		'https://www.sweetmarias.com/roasted-subscription-gift.html',
		'https://www.sweetmarias.com/rstd-subs-1050.html'
	];

	// Filter out ignored URLs first
	const filteredUrls = urls.filter((url) => !ignoredUrls.includes(url));

	// Create placeholders for the SQL query
	const placeholders = filteredUrls.map(() => '?').join(',');
	const [rows] = await connection.execute(
		`SELECT link FROM coffee_catalog WHERE link IN (${placeholders})`,
		filteredUrls
	);
	const existingUrls = new Set((rows as any[]).map((row) => row.link));
	return filteredUrls.filter((url) => !existingUrls.has(url));
}

async function updateDatabase() {
	let connection;
	try {
		connection = await initializeConnection();

		// Collect all product URLs
		const allProductUrls = await collectInitUrlsData();
		console.log(`Found ${allProductUrls.length} total products`);

		// Filter out existing URLs
		const newUrls = await checkExistingUrls(connection, allProductUrls);
		console.log(`Found ${newUrls.length} new products to process`);

		// Take only first N URLs for testing
		//const urlsToProcess = newUrls.slice(0, 1);
		//console.log(`Processing first ${urlsToProcess.length} URLs`);

		// Process each URL
		for (const url of newUrls) {
			console.log(`Processing URL: ${url}`);
			const scrapedData = await scrapeUrl(url);

			if (scrapedData) {
				// Insert into coffee_catalog table
				await connection.execute(
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
						last_updated
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
						scrapedData['Farm Gate'] === 'Yes' ? 1 : 0,
						scrapedData['Cultivar Detail'] || null,
						scrapedData['Grade'] || null,
						scrapedData['Appearance'] || null,
						scrapedData['Roast Recommendations'] || null,
						scrapedData['Type'] || null,
						scrapedData.url
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
		if (connection) {
			await connection.end(); // Close database connection
		}
	}
}

export { updateDatabase };
