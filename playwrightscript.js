import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { initializeConnection } from './scriptDb.js';

// Load environment variables
dotenv.config();

async function scrapeUrl(url) {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		await page.goto(url, { timeout: 60000 });
		await page.waitForTimeout(200);

		// Add score value extraction
		const scoreValue = await page.evaluate(() => {
			const scoreElement = document.querySelector('div.score-value');
			return scoreElement ? parseInt(scoreElement.innerText, 10) : null;
		});

		await page.click('#tab-label-product\\.info\\.specs-title');
		await page.waitForSelector('#product-attribute-specs-table', { visible: true });

		const results = await page.evaluate(() => {
			const rows = document.querySelectorAll('#product-attribute-specs-table tbody tr');
			const data = {};

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
		return { ...results, scoreValue };
	} catch (error) {
		console.error(`Error scraping ${url}:`, error);
		await browser.close();
		return null;
	}
}

async function updateDatabase() {
	let connection;
	try {
		// Initialize the database connection
		connection = await initializeConnection();

		// Get all beans with links from the database
		const [beans] = await connection.execute(
			'SELECT id, link FROM `green_coffee_inv` WHERE link IS NOT NULL AND link != ""'
		);

		console.log(`Found ${beans.length} beans to update`);

		// Process each bean
		for (const bean of beans) {
			console.log(`Processing bean ID ${bean.id} with link: ${bean.link}`);

			const scrapedData = await scrapeUrl(bean.link);

			if (scrapedData) {
				// Map the scraped data to your database columns
				const updates = {
					region: scrapedData['Region'] || null,
					processing: scrapedData['Processing'] || null,
					drying_method: scrapedData['Drying Method'] || null,
					arrival_date: scrapedData['Arrival date'] || null,
					lot_size: scrapedData['Lot size'] || null,
					bag_size: scrapedData['Bag size'] || null,
					packaging: scrapedData['Packaging'] || null,
					farm_gate: scrapedData['Farm Gate'] === 'Yes' ? 1 : 0,
					cultivar_detail: scrapedData['Cultivar Detail'] || null,
					grade: scrapedData['Grade'] || null,
					appearance: scrapedData['Appearance'] || null,
					roast_recs: scrapedData['Roast Recommendations'] || null,
					type: scrapedData['Type'] || null,
					last_updated: new Date()
				};

				// Update the database using prepared statement
				await connection.execute(
					`UPDATE \`green_coffee_inv\` SET 
					region = ?, 
					processing = ?,
					drying_method = ?,
					arrival_date = ?,
					lot_size = ?,
					bag_size = ?,
					packaging = ?,
					farm_gate = ?,
					cultivar_detail = ?,
					grade = ?,
					appearance = ?,
					roast_recs = ?,
					type = ?,
					score_value = ?,
					last_updated = ?
					WHERE id = ?`,
					[
						updates.region,
						updates.processing,
						updates.drying_method,
						updates.arrival_date,
						updates.lot_size,
						updates.bag_size,
						updates.packaging,
						updates.farm_gate,
						updates.cultivar_detail,
						updates.grade,
						updates.appearance,
						updates.roast_recs,
						updates.type,
						scrapedData.scoreValue,
						updates.last_updated,
						bean.id
					]
				);

				console.log(`Successfully updated bean ID ${bean.id}`);
			}
		}

		console.log('Database update complete');
		process.exit(0); // Clean exit with success code
	} catch (error) {
		console.error('Error updating database:', error);
		process.exit(1); // Exit with error code
	} finally {
		if (connection) {
			await connection.end(); // Close database connection
		}
	}
}

// Run the script
updateDatabase().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
