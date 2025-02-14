import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL || '',
	process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function scrapeUrlsAndPrices(): Promise<Array<{ url: string; price: number | null }>> {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		await page.goto(
			'https://www.sweetmarias.com/green-coffee.html?product_list_limit=all&sm_status=1',
			{ timeout: 60000 }
		);
		await page.waitForTimeout(2000); // Give page time to load

		// Debug: Log the number of elements found
		await page.evaluate(() => {
			console.log('Products found:', document.querySelectorAll('tr.item').length);
		});

		const urlsAndPrices = await page.evaluate(() => {
			const products = document.querySelectorAll('tr.item');
			return Array.from(products).map((product) => {
				const link = product.querySelector('.product-item-link') as HTMLAnchorElement;
				const priceElement = product.querySelector('.price-wrapper .price') as HTMLElement;

				const url = link ? link.href : null;
				const priceText = priceElement ? priceElement.innerText.trim() : null;
				const price = priceText ? parseFloat(priceText.replace('$', '')) : null;

				// Debug: Log each product's data
				console.log('Product:', { url, priceText, price });

				return { url, price };
			});
		});

		console.log('Scraped data:', urlsAndPrices); // Debug log

		await browser.close();
		const filteredResults = urlsAndPrices.filter(
			(item): item is { url: string; price: number | null } =>
				item.url !== null && typeof item.url === 'string'
		);
		console.log('Filtered results:', filteredResults); // Debug log
		return filteredResults;
	} catch (error) {
		console.error('Error collecting URLs and prices:', error);
		await browser.close();
		return [];
	}
}

async function updatePrices() {
	try {
		const urlsAndPrices = await scrapeUrlsAndPrices();
		console.log(`Found ${urlsAndPrices.length} products to update prices for.`);

		// Get all existing products from sweet_maria that are in stock
		const { data: products, error: fetchError } = await supabase
			.from('coffee_catalog')
			.select('id, link')
			.eq('source', 'sweet_maria')
			.eq('stocked', true);

		if (fetchError) throw fetchError;

		// Create a map of URL to price for quick lookup
		const priceMap = new Map(urlsAndPrices.map((item) => [item.url, item.price]));

		// Update prices for each product
		for (const product of products) {
			const price = priceMap.get(product.link);

			if (price !== undefined) {
				const { error: updateError } = await supabase
					.from('coffee_catalog')
					.update({ cost_lb: price })
					.eq('id', product.id);

				if (updateError) {
					console.error(`Error updating price for ID ${product.id}:`, updateError);
				} else {
					console.log(`Successfully updated price to $${price} for ID ${product.id}`);
				}
			}
		}

		console.log('Price update complete');
		return { success: true };
	} catch (error) {
		console.error('Error updating prices:', error);
		throw error;
	}
}

// Run the script if it's the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
	updatePrices()
		.then((result) => {
			if (result.success) {
				console.log('Successfully completed price updates');
			}
			process.exit(0);
		})
		.catch((error) => {
			console.error('Error:', error);
			process.exit(1);
		});
}

export { updatePrices };
