import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Verify what Vercel deploys, outside the checkout: workspace dependencies and
// request-time environment must not rescue an incomplete production artifact.
const production = process.env.VERCEL_ENV === 'production';
const commit = process.env.VERCEL_GIT_COMMIT_SHA;
if (production) assert.match(commit ?? '', /^[0-9a-f]{40}$/);
const directory = await mkdtemp(join(tmpdir(), 'market-brief-artifact-'));
try {
	await cp('.vercel/output/functions/![-]/catchall.func', directory, {
		recursive: true,
		verbatimSymlinks: true
	});
	const probe = `
import assert from 'node:assert/strict';
const production = ${JSON.stringify(production)};
const commit = ${JSON.stringify(commit ?? null)};
// Deliberately opposite to build identity: runtime configuration cannot promote
// a preview artifact or relabel a production artifact.
process.env.VERCEL_ENV = production ? 'preview' : 'production';
process.env.VERCEL_GIT_COMMIT_SHA = 'f'.repeat(40);
const { load } = await import('./.svelte-kit/output/server/entries/pages/blog/_slug_/_page.server.ts.js');
const { load: loadArchive } = await import('./.svelte-kit/output/server/entries/pages/blog/_page.server.ts.js');
const archive = await loadArchive({ url: new URL('https://www.purveyors.io/blog?format=market-brief') });
// The packaged public registry owns publication, not source filenames. Unpublished
// draft:true content must neither gain a manifest nor prevent deployment.
const slugs = archive.posts.filter(post => post.format === 'market-brief' && !post.draft).map(post => post.slug);
let checked = 0;
for (const slug of slugs) {
  const result = await load({ params: { slug }, url: new URL('https://www.purveyors.io/blog/' + slug) });
  assert.ok(result.marketBriefReader, 'reader missing: ' + slug);
  if (!production) {
    assert.equal(result.marketBriefDeployment, undefined, 'non-production artifact advertised identity');
    continue;
  }
  const renderer = await import('./.svelte-kit/output/server/chunks/marketBriefEmail.js');
  const projection = renderer.buildMarketBriefEmailProjection(result.metadata, renderer.getRawMarketBriefSource(slug));
  assert.deepEqual(result.marketBriefDeployment, {
    schemaVersion: 1, publication: 'market-brief', edition: result.metadata.edition,
    slug, canonicalUrl: projection.canonicalUrl, productionCommit: commit,
    rendererVersion: projection.rendererVersion, projectionSha256: projection.sha256
  }, 'packaged projection identity mismatch: ' + slug);
  checked++;
}
console.log(JSON.stringify({ status: 'pass', target: production ? 'production' : 'non-production', editions: slugs.length, projections: checked }));
`;
	const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
		cwd: directory,
		env: { NODE_ENV: 'production' },
		encoding: 'utf8',
		timeout: 30_000,
		maxBuffer: 1024 * 1024
	});
	if (result.stdout) process.stdout.write(result.stdout);
	if (result.stderr) process.stderr.write(result.stderr);
	assert.equal(result.status, 0, 'Market Brief deployment artifact failed verification');
} finally {
	await rm(directory, { recursive: true, force: true });
}
