import type { RequestHandler } from './$types';
import { getAllPosts } from '$lib/server/blog';

export const GET: RequestHandler = async ({ url }) => {
	// Use the request URL to determine the correct domain
	const baseUrl = `${url.protocol}//${url.host}`;

	// Get current date in ISO format for lastmod
	const currentDate = new Date().toISOString().split('T')[0];

	// Load published blog posts for dynamic sitemap entries
	const posts = await getAllPosts();

	const blogPostEntries = posts
		.filter((post) => !post.draft)
		.map(
			(post) => `
	<url>
		<loc>${baseUrl}/blog/${post.slug}</loc>
		<lastmod>${post.date}</lastmod>
		<changefreq>monthly</changefreq>
		<priority>0.8</priority>
	</url>`
		)
		.join('');

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<!-- Homepage - Highest priority -->
	<url>
		<loc>${baseUrl}/</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>weekly</changefreq>
		<priority>1.0</priority>
	</url>

	<!-- Public catalog and analytics - High priority data pages -->
	<url>
		<loc>${baseUrl}/catalog</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>daily</changefreq>
		<priority>0.7</priority>
	</url>

	<url>
		<loc>${baseUrl}/analytics</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>daily</changefreq>
		<priority>0.7</priority>
	</url>

	<!-- Blog index -->
	<url>
		<loc>${baseUrl}/blog</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>weekly</changefreq>
		<priority>0.8</priority>
	</url>
${blogPostEntries}
	<!-- API page - High priority marketing page -->
	<url>
		<loc>${baseUrl}/api</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>weekly</changefreq>
		<priority>0.5</priority>
	</url>

	<!-- Parchment Console -->
	<url>
		<loc>${baseUrl}/api-dashboard</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>weekly</changefreq>
		<priority>0.5</priority>
	</url>

	<!-- Contact page -->
	<url>
		<loc>${baseUrl}/contact</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>monthly</changefreq>
		<priority>0.5</priority>
	</url>

	<!-- Authentication pages - Medium priority -->
	<url>
		<loc>${baseUrl}/auth</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>monthly</changefreq>
		<priority>0.6</priority>
	</url>

	<!-- Subscription pages - Medium priority -->
	<url>
		<loc>${baseUrl}/subscription</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>monthly</changefreq>
		<priority>0.6</priority>
	</url>

	<url>
		<loc>${baseUrl}/subscription/success</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>monthly</changefreq>
		<priority>0.2</priority>
	</url>

	<!-- Cookie policy - Lower priority utility page -->
	<url>
		<loc>${baseUrl}/no-cookies</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>yearly</changefreq>
		<priority>0.2</priority>
	</url>
</urlset>`;

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};
