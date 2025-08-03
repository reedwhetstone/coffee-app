/**
 * Parser for Artisan .alog files which use Python literal syntax
 * Converts Python literals to JSON format for processing
 */

export function parseAlogFile(alogContent: string): any {
	try {
		// Convert Python literal syntax to JSON
		let jsonContent = alogContent;

		// Replace Python boolean values with JSON equivalents
		jsonContent = jsonContent.replace(/\bTrue\b/g, 'true');
		jsonContent = jsonContent.replace(/\bFalse\b/g, 'false');
		jsonContent = jsonContent.replace(/\bNone\b/g, 'null');

		// Remove trailing commas in arrays and objects
		// This regex removes commas that are followed by whitespace and then a closing bracket/brace
		jsonContent = jsonContent.replace(/,(\s*[}\]])/g, '$1');

		// Handle Python-style comments (# comments) - remove them
		jsonContent = jsonContent.replace(/#[^\r\n]*/g, '');

		// Handle Python-style single quotes - convert to double quotes
		// This is tricky because we need to avoid replacing quotes inside strings
		jsonContent = convertSingleQuotesToDouble(jsonContent);

		// Try to parse as JSON
		const parsed = JSON.parse(jsonContent);
		return parsed;
	} catch (error) {
		console.error('Failed to parse .alog file:', error);
		throw new Error(
			`Invalid .alog file format: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Convert Python-style single quotes to double quotes while preserving string content
 */
function convertSingleQuotesToDouble(content: string): string {
	let result = '';
	let inDoubleQuotes = false;
	let inSingleQuotes = false;
	let escaped = false;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		const prevChar = i > 0 ? content[i - 1] : '';

		if (escaped) {
			result += char;
			escaped = false;
			continue;
		}

		if (char === '\\') {
			escaped = true;
			result += char;
			continue;
		}

		if (char === '"' && !inSingleQuotes) {
			inDoubleQuotes = !inDoubleQuotes;
			result += char;
		} else if (char === "'" && !inDoubleQuotes) {
			if (inSingleQuotes) {
				// End of single-quoted string - convert to double quote
				result += '"';
				inSingleQuotes = false;
			} else {
				// Start of single-quoted string - convert to double quote
				result += '"';
				inSingleQuotes = true;
			}
		} else {
			result += char;
		}
	}

	return result;
}

/**
 * Validate that a file is likely an Artisan .alog file
 */
export function isValidAlogFile(content: string): boolean {
	// Check for common Artisan file markers
	const hasArtisanMarkers =
		content.includes('"timex"') ||
		content.includes("'timex'") ||
		content.includes('"temp1"') ||
		content.includes("'temp1'") ||
		content.includes('"timeindex"') ||
		content.includes("'timeindex'");

	const hasPythonSyntax =
		content.includes('True') || content.includes('False') || content.includes('None');

	// Should start with { and end with }
	const trimmed = content.trim();
	const hasObjectStructure = trimmed.startsWith('{') && trimmed.endsWith('}');

	return hasArtisanMarkers && (hasPythonSyntax || hasObjectStructure);
}

/**
 * Clean up common .alog file formatting issues
 */
export function preprocessAlogContent(content: string): string {
	// Remove any BOM (Byte Order Mark)
	content = content.replace(/^\uFEFF/, '');

	// Normalize line endings
	content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

	// Remove any trailing whitespace/newlines
	content = content.trim();

	return content;
}

/**
 * Main function to handle .alog file processing
 */
export function processAlogFile(fileContent: string): any {
	// Preprocess the content
	const cleanContent = preprocessAlogContent(fileContent);

	// Validate it looks like an .alog file
	if (!isValidAlogFile(cleanContent)) {
		throw new Error('File does not appear to be a valid Artisan .alog file');
	}

	// Parse the Python literal syntax to JSON
	return parseAlogFile(cleanContent);
}
