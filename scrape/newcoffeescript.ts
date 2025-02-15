//run with -- npm run scrape
// npm run scrape sweet-marias
// npm run scrape captain-coffee

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
	available?: boolean; // Add this optional field
}

// Add new interfaces for source-specific implementations
interface CoffeeSource {
	name: string;
	collectInitUrlsData(): Promise<ProductData[]>;
	scrapeUrl(url: string, price: number | null): Promise<ScrapedData | null>;
	baseUrl: string;
}

// Refactor Sweet Maria's specific code into a class
class SweetMariasSource implements CoffeeSource {
	name = 'sweet_maria';
	baseUrl = 'https://www.sweetmarias.com/green-coffee.html?product_list_limit=all&sm_status=1';

	async collectInitUrlsData(): Promise<ProductData[]> {
		const browser = await chromium.launch({ headless: false });
		const context = await browser.newContext();
		const page = await context.newPage();

		try {
			await page.goto(this.baseUrl, { timeout: 60000 });
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

	async scrapeUrl(url: string, price: number | null): Promise<ScrapedData | null> {
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

			const specs = await page.evaluate(() => {
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

			// Transform the raw specs data into a structured object
			return {
				productName,
				url,
				scoreValue,
				descriptionShort,
				descriptionLong,
				farmNotes,
				cost_lb: price,
				arrivalDate: specs['Arrival date'] || null,
				region: specs['Region'] || null,
				processing: specs['Processing'] || null,
				dryingMethod: specs['Drying Method'] || null,
				lotSize: specs['Lot size'] || null,
				bagSize: specs['Bag size'] || null,
				packaging: specs['Packaging'] || null,
				cultivarDetail: specs['Cultivar Detail'] || null,
				grade: specs['Grade'] || null,
				appearance: specs['Appearance'] || null,
				roastRecs: specs['Roast Recommendations'] || null,
				type: specs['Type'] || null
			};
		} catch (error) {
			console.error(`Error scraping ${url}:`, error);
			await browser.close();
			return null;
		}
	}
}

// Example structure for a new coffee source
class CaptainCoffeeSource implements CoffeeSource {
	name = 'captain_coffee';
	baseUrl = 'https://thecaptainscoffee.com/collections/green-coffee';

	async collectInitUrlsData(): Promise<ProductData[]> {
		const browser = await chromium.launch({ headless: false });
		const context = await browser.newContext();
		const page = await context.newPage();

		// Add console listener
		page.on('console', (msg) => console.log('Browser:', msg.text()));

		try {
			await page.goto(this.baseUrl, { timeout: 60000 });
			await page.waitForTimeout(2000);

			const initPageData = await page.evaluate(() => {
				console.log('Starting page evaluation...');
				const products = document.querySelectorAll('.product-collection.products-grid.row > div');
				console.log('Found products:', products.length);

				return Array.from(products).map((product) => {
					const linkElement = product.querySelector('.product-image > a') as HTMLAnchorElement;
					let productData: {
						variants?: Array<{ price: number; available: boolean; title: string }>;
					} = {};

					try {
						const jsonElement = product.querySelector('[data-json-product]');
						const jsonString = jsonElement?.getAttribute('data-json-product');

						if (jsonString) {
							const cleanedJson = jsonString.replace(/[\n\r\t]/g, '').replace(/\\/g, '\\\\');
							productData = JSON.parse(cleanedJson);

							// Find the 1 lb variant
							const oneLbVariant = productData.variants?.find((v) => v.title.includes('1 lb'));
							if (oneLbVariant) {
								const url = linkElement ? linkElement.href : null;
								const price = oneLbVariant.available ? oneLbVariant.price / 100 : null;

								console.log('Found 1 lb variant:', {
									url,
									price,
									available: oneLbVariant.available
								});

								// Only return price if the variant is available
								return {
									url,
									price: oneLbVariant.available ? price : null
								};
							}
						}
					} catch (e) {
						console.error('Failed to parse product JSON:', e);
					}

					return { url: null, price: null };
				});
			});

			console.log('All collected data:', initPageData);
			await browser.close();

			const filteredResults = initPageData.filter(
				(item): item is ProductData =>
					item.url !== null && typeof item.url === 'string' && item.price !== null
			);
			console.log('Filtered results:', filteredResults);

			return filteredResults;
		} catch (error) {
			console.error('Error collecting initial page data:', error);
			await browser.close();
			return [];
		}
	}

	async scrapeUrl(url: string, price: number | null): Promise<ScrapedData | null> {
		const browser = await chromium.launch({ headless: false });
		const context = await browser.newContext();
		const page = await context.newPage();

		try {
			await page.goto(url, { timeout: 60000 });
			await page.waitForTimeout(2000);

			// Product Name
			const productName = await page.evaluate(() => {
				const nameElement = document.querySelector(
					'div.row.product_top.horizontal-tabs > div.col-md-6.product-shop > h1 > span'
				);
				return nameElement ? nameElement.textContent?.trim() : null;
			});

			// Importer (type)
			const importer = await page.evaluate(() => {
				const importerElement = document.querySelector('div.vendor-product > span > a');
				return importerElement ? importerElement.textContent?.trim() : null;
			});

			// Score Value
			const scoreValue = await page.evaluate(() => {
				const scoreElement = document.querySelector(
					'div.short-description > p > em > i > a > strong'
				);
				if (scoreElement) {
					const text = scoreElement.textContent?.trim();
					if (text?.includes('3')) return 91.5;
					if (text?.includes('6')) return 87.5;
				}
				return 85;
			});

			// Short Description
			const descriptionShort = await page.evaluate(() => {
				const descElement = document.querySelector('div.short-description > p > em');
				return descElement ? descElement.textContent?.trim() : null;
			});

			// Long Description (Tab 3)
			const descriptionLong = await page.evaluate(() => {
				const container = document.querySelector('#collapse-tab3 > div');
				if (!container) return null;

				const paragraphs = Array.from(container.querySelectorAll('p'))
					.filter((p) => !p.textContent?.includes('Reminder! This coffee is raw'))
					.map((p) => p.textContent?.trim())
					.filter(Boolean);

				return paragraphs.join('\n\n');
			});

			// Details (Tab 4)
			const details = await page.evaluate(() => {
				const container = document.querySelector('#collapse-tab4 > div');
				if (!container) return {};

				// Extract arrival, harvest dates, and packaging
				const dateText = container.querySelector('p:nth-child(1)')?.textContent || '';
				let remainingText = dateText;
				let packaging = null;

				// Extract packaging information first
				if (remainingText.toLowerCase().includes('packed')) {
					const [beforePacked, afterPacked] = remainingText.split(/packed/i);
					remainingText = beforePacked.trim();
					packaging = afterPacked.trim();
				}

				// Then split remaining text for arrival and harvest dates
				const [arrivalDate, harvestDate] = remainingText.toLowerCase().includes('harvest')
					? [remainingText.split(/harvest/i)[0], 'Harvest' + remainingText.split(/harvest/i)[1]]
					: [remainingText, null];

				// Extract cupping notes
				const cuppingRows = [
					'Acidity & Brightness',
					'Balance & Finish',
					'Body & Texture',
					'Flavors'
				]
					.map((header) => {
						const row = Array.from(container.querySelectorAll('p')).find((p) =>
							p.textContent?.includes(header)
						);
						return row ? row.textContent?.trim() : null;
					})
					.filter(Boolean);

				// Extract other details
				const rows = Array.from(container.querySelectorAll('p'));
				const details: { [key: string]: string } = {};

				rows.forEach((row) => {
					const text = row.textContent?.trim() || '';
					if (text.includes('Grade:')) details.grade = text;
					if (text.includes('Processing:')) details.processing = text;
					if (text.includes('Grower:')) details.grower = text;
					if (text.includes('Region:')) details.region = text;
					if (text.includes('Varietals:')) details.cultivar = text;
				});

				return {
					arrivalDate,
					harvestDate,
					packaging,
					cuppingNotes: cuppingRows.join('\n'),
					...details
				};
			});

			// Roast Recommendations (Tab 5)
			const roastRecs = await page.evaluate(() => {
				const container = document.querySelector('#collapse-tab5 > div');
				return container ? container.textContent?.trim() : null;
			});

			// Farm Notes (Tab 6)
			const farmNotes = await page.evaluate(() => {
				const container = document.querySelector('#collapse-tab6 > div');
				return container ? container.textContent?.trim() : null;
			});

			await browser.close();

			return {
				productName,
				url,
				scoreValue,
				descriptionShort,
				descriptionLong,
				farmNotes: `${details.grower}\n${farmNotes}`.trim(),
				cost_lb: price,
				arrivalDate: details.arrivalDate?.replace('Arrival Date:', '').trim() || null,
				harvestDate: details.harvestDate?.replace('Harvest Year:', '').trim() || null,
				region: details.region?.replace('Region:', '').trim() || null,
				processing: details.processing?.replace('Processing:', '').trim() || null,
				dryingMethod: null,
				lotSize: null,
				bagSize: null,
				packaging: details.packaging,
				type: importer || null, // Store the actual importer text instead of boolean
				cultivarDetail: details.cultivar?.replace('Varietals:', '').trim() || null,
				grade: details.grade?.replace('Grade:', '').trim() || null,
				appearance: null,
				roastRecs,
				cuppingNotes: details.cuppingNotes
			};
		} catch (error) {
			console.error(`Error scraping ${url}:`, error);
			await browser.close();
			return null;
		}
	}
}

class BohdiLeafSource implements CoffeeSource {
	name = 'bohdi_leaf';
	baseUrl = 'https://www.bodhileafcoffee.com/collections/green-coffee';

	async collectInitUrlsData(): Promise<ProductData[]> {
		const browser = await chromium.launch({ headless: false });
		const context = await browser.newContext();
		const page = await context.newPage();

		try {
			await page.goto(this.baseUrl, { timeout: 60000 });
			await page.waitForTimeout(2000);

			const urlsAndPrices = await page.evaluate(() => {
				const products = document.querySelectorAll('.grid__item');
				return Array.from(products).map((product) => {
					const link = product.querySelector('a.full-unstyled-link') as HTMLAnchorElement;
					const priceElement = product.querySelector('.price__regular .price-item') as HTMLElement;

					const url = link ? link.href : null;
					const priceText = priceElement ? priceElement.innerText.trim() : null;
					const price = priceText ? parseFloat(priceText.replace('$', '')) : null;

					return { url, price };
				});
			});

			await browser.close();
			const filteredResults = urlsAndPrices.filter(
				(item): item is ProductData =>
					item.url !== null && typeof item.url === 'string' && item.price !== null
			);
			return filteredResults;
		} catch (error) {
			console.error('Error collecting URLs and prices:', error);
			await browser.close();
			return [];
		}
	}

	async scrapeUrl(url: string, price: number | null): Promise<ScrapedData | null> {
		const browser = await chromium.launch({ headless: false });
		const context = await browser.newContext();
		const page = await context.newPage();

		try {
			await page.goto(url, { timeout: 60000 });
			await page.waitForTimeout(2000);

			const productData = await page.evaluate(() => {
				const productName =
					document.querySelector('.product__title h1')?.textContent?.trim() || null;
				const descriptionElement = document.querySelector('.product__description');
				const description = descriptionElement?.textContent?.trim() || null;

				// Split description into parts
				let descriptionShort = null;
				let descriptionLong = null;
				let farmNotes = null;

				if (description) {
					const parts = description.split('\n').filter((part) => part.trim());
					descriptionShort = parts[0] || null;
					descriptionLong = parts.slice(1).join('\n') || null;
				}

				// Extract details from the description
				const details: { [key: string]: string | null } = {};
				const detailsText = description || '';

				// Common patterns to look for
				const patterns = {
					region: /Region:\s*([^\n]+)/i,
					processing: /Process(?:ing)?:\s*([^\n]+)/i,
					cultivarDetail: /Variet(?:y|ies|als):\s*([^\n]+)/i,
					grade: /Grade:\s*([^\n]+)/i,
					elevation: /Elevation:\s*([^\n]+)/i,
					harvestDate: /Harvest:\s*([^\n]+)/i,
					arrivalDate: /Arrival:\s*([^\n]+)/i
				};

				Object.entries(patterns).forEach(([key, pattern]) => {
					const match = detailsText.match(pattern);
					details[key] = match ? match[1].trim() : null;
				});

				return {
					productName,
					descriptionShort,
					descriptionLong,
					farmNotes,
					...details
				};
			});

			await browser.close();

			return {
				productName: productData.productName,
				url,
				scoreValue: null,
				descriptionShort: productData.descriptionShort,
				descriptionLong: productData.descriptionLong,
				farmNotes: productData.farmNotes,
				cost_lb: price,
				arrivalDate: productData.arrivalDate,
				harvestDate: productData.harvestDate,
				region: productData.region,
				processing: productData.processing,
				dryingMethod: null,
				lotSize: null,
				bagSize: null,
				packaging: null,
				cultivarDetail: productData.cultivarDetail,
				grade: productData.grade,
				appearance: null,
				roastRecs: null,
				type: null,
				cuppingNotes: null
			};
		} catch (error) {
			console.error(`Error scraping ${url}:`, error);
			await browser.close();
			return null;
		}
	}
}

// Modified database update function to handle multiple sources
async function updateDatabase(source: CoffeeSource) {
	try {
		if (!(await confirmStep(`Step 1: About to collect all product URLs from ${source.name}`))) {
			return { success: false, message: 'Aborted before URL collection' };
		}

		const productsData = await source.collectInitUrlsData();
		const inStockUrls = productsData.map((item) => item.url);
		console.log(`Found ${inStockUrls.length} total products on ${source.name}`);

		// Update existing products for this source
		const { data: dbProducts, error: fetchError } = await supabase
			.from('coffee_catalog')
			.select('link')
			.eq('source', source.name);

		if (fetchError) throw fetchError;
		console.log(`Found ${dbProducts?.length || 0} ${source.name} products in database`);

		if (
			!(await confirmStep(
				`Step 2: About to set all ${dbProducts?.length || 0} existing ${source.name} products to stocked = false`
			))
		) {
			return { success: false, message: 'Aborted before updating stock status' };
		}

		// Set all existing ${source.name} products to stocked = false
		const { error: updateError } = await supabase
			.from('coffee_catalog')
			.update({ stocked: false })
			.eq('source', source.name);

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
				.eq('source', source.name);

			if (stockedError) throw stockedError;
		}

		// Get new URLs to process (ones not in our database)
		const newUrls = await checkExistingUrls(inStockUrls);

		// Add debugging to verify the updates
		const { data: stillStocked, error: checkError } = await supabase
			.from('coffee_catalog')
			.select('link')
			.eq('source', source.name)
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
			const scrapedData = await source.scrapeUrl(url, price);

			if (scrapedData) {
				const { error } = await supabase.from('coffee_catalog').insert({
					name: scrapedData.productName,
					score_value: scrapedData.scoreValue,
					arrival_date: scrapedData.arrivalDate,
					harvest_date: scrapedData.harvestDate,
					region: scrapedData.region,
					processing: scrapedData.processing,
					drying_method: scrapedData.dryingMethod,
					lot_size: scrapedData.lotSize,
					bag_size: scrapedData.bagSize,
					packaging: scrapedData.packaging,
					cultivar_detail: scrapedData.cultivarDetail,
					grade: scrapedData.grade,
					appearance: scrapedData.appearance,
					roast_recs: scrapedData.roastRecs,
					type: scrapedData.type,
					link: scrapedData.url,
					description_long: scrapedData.descriptionLong,
					description_short: scrapedData.descriptionShort,
					cupping_notes: scrapedData.cuppingNotes,
					farm_notes: scrapedData.farmNotes,
					last_updated: new Date().toISOString(),
					source: source.name,
					cost_lb: scrapedData.cost_lb,
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

async function checkExistingUrls(urls: string[]): Promise<string[]> {
	// Filter out URLs containing unwanted patterns
	const filteredUrls = urls.filter((url) => {
		return (
			// list of patterns to filter out
			!url.includes('roasted') &&
			!url.includes('subscription') &&
			!url.includes('rstd-subs-') &&
			!url.includes('-set-') &&
			!url.includes('-set.html') &&
			!url.includes('-blend') &&
			!url.includes('-sampler')
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

// Main execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
	const sourceMap = {
		sweet_maria: new SweetMariasSource(),
		captain_coffee: new CaptainCoffeeSource(),
		bohdi_leaf: new BohdiLeafSource()
	};

	const sourceName = process.argv[2];
	if (!sourceName) {
		console.error(
			`Error: No source specified. Please use "${Object.keys(sourceMap).join('" or "')}"`
		);
		process.exit(1);
	}

	const source = sourceMap[sourceName as keyof typeof sourceMap];
	if (!source) {
		console.error(
			`Error: Invalid source specified. Valid options are: "${Object.keys(sourceMap).join('" or "')}"`
		);
		process.exit(1);
	}

	updateDatabase(source)
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
