import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	// Use the request URL to determine the correct domain
	const baseUrl = `${url.protocol}//${url.host}`;

	// Get current date in ISO format for lastmod
	const currentDate = new Date().toISOString().split('T')[0];

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<!-- Homepage - Highest priority -->
	<url>
		<loc>${baseUrl}/</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>weekly</changefreq>
		<priority>1.0</priority>
	</url>
	
	<!-- Contact page - High priority marketing page -->
	<url>
		<loc>${baseUrl}/contact</loc>
		<lastmod>${currentDate}</lastmod>
		<changefreq>monthly</changefreq>
		<priority>0.8</priority>
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
