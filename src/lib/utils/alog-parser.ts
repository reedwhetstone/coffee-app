/**
 * Parser for Artisan .alog files which use Python literal syntax
 * Converts Python literals to JSON format for processing
 */

export function parseAlogFile(alogContent: string): any {
	// Convert Python literal syntax to JSON
	let jsonContent = alogContent;

	try {
		console.log('Starting alog parsing...');

		// Replace Python boolean values with JSON equivalents (case-sensitive, whole words only)
		jsonContent = jsonContent.replace(/\bTrue\b/g, 'true');
		jsonContent = jsonContent.replace(/\bFalse\b/g, 'false');
		jsonContent = jsonContent.replace(/\bNone\b/g, 'null');
		console.log('Replaced Python booleans');

		// Handle Python-style comments (# comments) - remove them
		// But be careful not to remove # characters inside strings (like hex colors)
		jsonContent = removeCommentsCarefully(jsonContent);
		console.log('Removed comments');

		// For files that are already mostly JSON, skip complex single quote conversion
		// Just handle specific cases where single quotes are used
		if (jsonContent.includes("'")) {
			console.log('File contains single quotes, applying conversion...');
			// Debug: check problem area before conversion
			const problemStart = 72050;
			if (jsonContent.length > problemStart) {
				const beforeContext = jsonContent.substring(problemStart - 50, problemStart + 50);
				console.log('Before quote conversion:', beforeContext);
			}

			jsonContent = convertSingleQuotesToDouble(jsonContent);
			console.log('Converted single quotes');

			// Debug: check problem area after conversion
			if (jsonContent.length > problemStart) {
				const afterContext = jsonContent.substring(problemStart - 50, problemStart + 50);
				console.log('After quote conversion:', afterContext);
			}
		} else {
			console.log('No single quotes found, skipping conversion');
		}

		// Clean up control characters in strings - but be more careful
		jsonContent = cleanControlCharacters(jsonContent);
		console.log('Cleaned control characters');

		// Fix common array/object formatting issues
		jsonContent = fixFormattingIssues(jsonContent);
		console.log('Fixed formatting issues');

		// Final cleanup: handle any remaining problematic patterns
		// The debug shows we have `[""` (missing closing bracket), not `[""]`
		// Fix the specific unterminated array pattern
		jsonContent = jsonContent.replace(/"extradevicecolor1":\s*\[""/g, '"extradevicecolor1": []');
		jsonContent = jsonContent.replace(/"extradevicecolor2":\s*\[""/g, '"extradevicecolor2": []');
		// More general pattern for unterminated arrays with empty strings
		jsonContent = jsonContent.replace(/:\s*\[""/g, ': []');
		
		// Debug: Final check of problem area
		const problemStart = 72050;
		if (jsonContent.length > problemStart) {
			const finalContext = jsonContent.substring(problemStart - 50, problemStart + 50);
			console.log('Final content at problem area:', finalContext);
		}

		// Try to parse as JSON
		const parsed = JSON.parse(jsonContent);
		return parsed;
	} catch (error) {
		console.error('Failed to parse .alog file:', error);
		// Provide more context about where the error occurred
		if (error instanceof SyntaxError && error.message.includes('position')) {
			const match = error.message.match(/position (\d+)/);
			if (match) {
				const position = parseInt(match[1]);
				const context = getErrorContext(jsonContent, position, 150);
				console.log('Error context (extended):', context);

				// Try to save the processed content to a temp file for debugging
				console.log('Content length:', jsonContent.length);
				console.log('Characters around error position:');
				for (let i = position - 10; i <= position + 10; i++) {
					if (i >= 0 && i < jsonContent.length) {
						const char = jsonContent[i];
						const code = char.charCodeAt(0);
						console.log(
							`${i}: '${char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : char}' (${code})`
						);
					}
				}

				throw new Error(`Invalid .alog file format: ${error.message}\nContext: ...${context}...`);
			}
		}
		throw new Error(
			`Invalid .alog file format: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Remove Python-style comments while preserving # characters inside strings
 */
function removeCommentsCarefully(content: string): string {
	let result = '';
	let inString = false;
	let escaped = false;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

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

		if (char === '"') {
			inString = !inString;
			result += char;
			continue;
		}

		// If we find a # outside of a string, it's a comment - remove everything until newline
		if (char === '#' && !inString) {
			// Skip everything until we find a newline
			while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
				i++;
			}
			// Don't increment i again in the for loop, let it handle the newline
			i--;
			continue;
		}

		result += char;
	}

	return result;
}

/**
 * Clean up control characters in JSON strings
 */
function cleanControlCharacters(content: string): string {
	let result = '';
	let inString = false;
	let escaped = false;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];

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

		if (char === '"') {
			inString = !inString;
			result += char;
			continue;
		}

		// If we're inside a string, handle control characters
		if (inString) {
			const charCode = char.charCodeAt(0);

			// Handle common control characters that need escaping in JSON
			if (charCode < 32) {
				switch (char) {
					case '\n':
						result += '\\n';
						break;
					case '\r':
						result += '\\r';
						break;
					case '\t':
						result += '\\t';
						break;
					case '\b':
						result += '\\b';
						break;
					case '\f':
						result += '\\f';
						break;
					default:
						// For other control characters, use unicode escape
						result += '\\u' + charCode.toString(16).padStart(4, '0');
						break;
				}
			} else {
				result += char;
			}
		} else {
			result += char;
		}
	}

	return result;
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
			// Check if this is likely a property name or string value
			// Skip apostrophes that are likely part of contractions
			const nextChar = i + 1 < content.length ? content[i + 1] : '';
			const prevChar = i > 0 ? content[i - 1] : '';

			// Skip apostrophes in contractions like "don't", "can't", etc.
			if (prevChar.match(/[a-zA-Z]/) && nextChar.match(/[a-zA-Z]/)) {
				result += char;
				continue;
			}

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

	// Safety check: if we ended in single quotes, close the string
	if (inSingleQuotes) {
		console.warn('Warning: Unterminated single quote detected, adding closing quote');
		result += '"';
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
 * Fix common formatting issues that can cause JSON parsing errors
 */
function fixFormattingIssues(content: string): string {
	// Remove trailing commas in arrays and objects (more comprehensive)
	// This regex removes commas that are followed by whitespace and then a closing bracket/brace
	content = content.replace(/,(\s*[}\]])/g, '$1');

	// Fix double commas
	content = content.replace(/,,+/g, ',');

	// Fix empty elements in arrays (like [,] or [1,,2])
	content = content.replace(/\[\s*,/g, '[');
	content = content.replace(/,\s*,/g, ',');
	content = content.replace(/,\s*\]/g, ']');

	// Skip all color-related properties to avoid parsing issues
	// Handle both complete and malformed color arrays
	content = content.replace(/"[^"]*color[^"]*":\s*\[[^\]]*\]/gi, (match) => {
		const propertyName = match.match(/"([^"]*color[^"]*)"/i)?.[1] || 'color_property';
		return `"${propertyName}": []`;
	});

	// Specifically handle malformed color arrays like [""]
	content = content.replace(/"([^"]*color[^"]*)":\s*\[""\]/gi, '"$1": []');

	// Handle any remaining unterminated arrays
	content = content.replace(/\["$/gm, '[]');
	content = content.replace(/\["\s*$/gm, '[]');

	return content;
}

/**
 * Get context around an error position for better debugging
 */
function getErrorContext(content: string, position: number, contextLength: number = 50): string {
	const start = Math.max(0, position - contextLength);
	const end = Math.min(content.length, position + contextLength);
	return content.substring(start, end);
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
