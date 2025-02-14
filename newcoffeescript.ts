//run with -- npm run scrape

import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL || '',
	process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface ScrapedData {
	productName: string | null;
	url: string;
	scoreValue: number | null;
	[key: string]: any; // This allows for dynamic string keys
}

interface ProductData {
	url: string;
	price: number | null;
}

async function collectInitUrlsData(): Promise<ProductData[]> {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		await page.goto(
			'https://www.sweetmarias.com/green-coffee.html?product_list_limit=all&sm_status=1',
			{ timeout: 60000 }
		);
		await page.waitForTimeout(2000);

		const urlsAndPrices = await page.evaluate(() => {
			const products = document.querySelectorAll('tr.item');
			return Array.from(products).map((product) => {
				const link = product.querySelector('.product-item-link') as HTMLAnchorElement;
				const priceElement = product.querySelector('.price-wrapper .price') as HTMLElement;

				const url = link ? link.href : null;
				const priceText = priceElement ? priceElement.innerText.trim() : null;
				const price = priceText ? parseFloat(priceText.replace('$', '')) : null;

				return { url, price };
			});
		});

		await browser.close();
		const filteredResults = urlsAndPrices.filter(
			(item): item is ProductData =>
				item.url !== null && typeof item.url === 'string' && item.price !== null // Only include items with valid prices
		);
		return filteredResults;
	} catch (error) {
		console.error('Error collecting URLs and prices:', error);
		await browser.close();
		return [];
	}
}

async function scrapeUrl(url: string, price: number | null): Promise<ScrapedData | null> {
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
			farmNotes,
			cost_lb: price
		};
	} catch (error) {
		console.error(`Error scraping ${url}:`, error);
		await browser.close();
		return null;
	}
}

async function checkExistingUrls(urls: string[]): Promise<string[]> {
	// Filter out URLs containing unwanted patterns
	const filteredUrls = urls.filter((url) => {
		return (
			!url.includes('roasted') &&
			!url.includes('subscription') &&
			!url.includes('rstd-subs-') &&
			!url.includes('-set-') &&
			!url.includes('-set.html')
		);
	});

	const { data: existingUrls, error } = await supabase
		.from('coffee_catalog')
		.select('link')
		.in('link', filteredUrls);

	if (error) throw error;

	const existingUrlSet = new Set(existingUrls.map((row) => row.link));
	return filteredUrls.filter((url) => !existingUrlSet.has(url));
}

// Add this helper function before updateDatabase
async function confirmStep(message: string): Promise<boolean> {
	console.log('\n' + message);
	process.stdout.write('Continue? (y/n): ');

	const response = await new Promise<string>((resolve) => {
		process.stdin.once('data', (data) => {
			resolve(data.toString().trim().toLowerCase());
		});
	});

	if (response !== 'y') {
		console.log('Operation aborted by user');
		return false;
	}
	return true;
}

async function updateDatabase() {
	try {
		if (
			!(await confirmStep("Step 1: About to collect all product URLs from Sweet Maria's website."))
		) {
			return { success: false, message: 'Aborted before URL collection' };
		}

		// First get all current products from the page
		const productsData = await collectInitUrlsData();
		const inStockUrls = productsData.map((item) => item.url);
		console.log(`Found ${inStockUrls.length} total products on Sweet Maria's website`);

		// Get all Sweet Maria products from database
		const { data: dbProducts, error: fetchError } = await supabase
			.from('coffee_catalog')
			.select('link')
			.eq('source', 'sweet_maria');

		if (fetchError) throw fetchError;
		console.log(`Found ${dbProducts?.length || 0} Sweet Maria products in database`);

		if (
			!(await confirmStep(
				`Step 2: About to set all ${dbProducts?.length || 0} existing Sweet Maria products to stocked = false`
			))
		) {
			return { success: false, message: 'Aborted before updating stock status' };
		}

		// Set all existing Sweet Maria products to stocked = false
		const { error: updateError } = await supabase
			.from('coffee_catalog')
			.update({ stocked: false })
			.eq('source', 'sweet_maria');

		if (updateError) throw updateError;

		// Create a map of URL to price for updates
		const priceMap = new Map(productsData.map((item) => [item.url, item.price]));

		// Then update stocked status and prices for in-stock items
		for (const url of inStockUrls) {
			const price = priceMap.get(url);
			const { error: stockedError } = await supabase
				.from('coffee_catalog')
				.update({
					stocked: true,
					cost_lb: price
				})
				.eq('link', url)
				.eq('source', 'sweet_maria');

			if (stockedError) throw stockedError;
		}

		// Get new URLs to process (ones not in our database)
		const newUrls = await checkExistingUrls(inStockUrls);

		// Add debugging to verify the updates
		const { data: stillStocked, error: checkError } = await supabase
			.from('coffee_catalog')
			.select('link')
			.eq('source', 'sweet_maria')
			.eq('stocked', true);

		if (checkError) throw checkError;
		console.log('Products now marked as stocked in DB:', stillStocked?.length || 0);
		console.log('Number of new URLs to process:', newUrls.length);

		// Process new products
		for (const url of newUrls) {
			if (!(await confirmStep(`Step 3: About to process URL: ${url}`))) {
				return { success: false, message: 'Aborted during product processing' };
			}

			const price = priceMap.get(url);
			const scrapedData = await scrapeUrl(url, price);

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
					last_updated: new Date().toISOString(),
					source: 'sweet_maria',
					cost_lb: scrapedData['Cost per lb'] || null,
					stocked: true
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

// Add this at the end of the file
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
	updateDatabase()
		.then((result) => {
			if (!result.success) {
				console.log(result.message);
			}
			process.exit(0);
		})
		.catch((error) => {
			console.error('Error:', error);
			process.exit(1);
		});
}
