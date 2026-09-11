import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOG_IMAGE_ROOT = fileURLToPath(new URL('../static/blog/images/', import.meta.url));
const FOUNDER_IMAGE = fileURLToPath(new URL('../static/founder.webp', import.meta.url));
const MAX_HERO_BYTES = 350_000;
const MAX_CARD_BYTES = 125_000;
const MAX_FOUNDER_BYTES = 250_000;

async function assertWebp(path, maxBytes) {
	const [metadata, header] = await Promise.all([stat(path), readFile(path)]);
	if (metadata.size > maxBytes) {
		throw new Error(`${path} is ${metadata.size} bytes; expected at most ${maxBytes}`);
	}
	if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WEBP') {
		throw new Error(`${path} is not a genuine WebP artifact`);
	}
}

const imageDirectories = await readdir(BLOG_IMAGE_ROOT, { withFileTypes: true });
for (const directory of imageDirectories.filter((entry) => entry.isDirectory())) {
	const base = join(BLOG_IMAGE_ROOT, directory.name);
	await assertWebp(join(base, 'hero.webp'), MAX_HERO_BYTES);
	await assertWebp(join(base, 'hero-card.webp'), MAX_CARD_BYTES);
}

await assertWebp(FOUNDER_IMAGE, MAX_FOUNDER_BYTES);

console.log(
	JSON.stringify({
		status: 'pass',
		blogImages: imageDirectories.filter((entry) => entry.isDirectory()).length,
		maxHeroBytes: MAX_HERO_BYTES,
		maxCardBytes: MAX_CARD_BYTES,
		maxFounderBytes: MAX_FOUNDER_BYTES
	})
);
