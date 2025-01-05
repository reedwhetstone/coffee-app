import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch({ headless: false }); // Launch browser in non-headless mode for debugging
	const context = await browser.newContext();
	const page = await context.newPage();

	// Navigate to the URL
	await page.goto('https://www.sweetmarias.com/ethiopia-dry-process-hambela-goro-7627.html', {
		timeout: 60000
	});

	// Wait for a specific amount of time after the page load (e.g., 1 second)
	await page.waitForTimeout(200); // Wait for N seconds

	// Click the tab to reveal the hidden content
	await page.click('#tab-label-product\\.info\\.specs-title');

	// Wait for the table to become visible
	await page.waitForSelector('#product-attribute-specs-table', { visible: true });

	// Extract all the texts from the table rows (assuming rows are in <th> and <td> elements)
	const results = await page.evaluate(() => {
		const rows = document.querySelectorAll('#product-attribute-specs-table tbody tr'); // Get all rows
		const data = [];

		// Loop through all rows
		rows.forEach((row) => {
			const headerCells = row.querySelectorAll('th'); // Get all header cells (first column)
			const dataCells = row.querySelectorAll('td'); // Get all data cells (second column onward)
			const rowData = [];

			// Extract text from each header cell (th) and data cell (td)
			headerCells.forEach((cell) => {
				rowData.push(cell.innerText.trim()); // Store the trimmed text from th
			});

			dataCells.forEach((cell) => {
				rowData.push(cell.innerText.trim()); // Store the trimmed text from td
			});

			data.push(rowData); // Push row data into the results array
		});

		return data; // Return the entire table data as a 2D array
	});

	// Log the extracted text from all rows
	console.log('Extracted Table Data:', results);

	await browser.close(); // Close the browser
})();
