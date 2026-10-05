import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { SavedReference } from '$lib/roast/roast-plan';
import SavedLibrary from './SavedLibrary.svelte';

vi.mock('$lib/profileStudio/analytics', () => ({ trackProfileStudioActivation: vi.fn() }));

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const KEPT = 'aaaaaaaa-0000-4000-8000-000000000002';
const PLAN = 'aaaaaaaa-0000-4000-8000-000000000003';
const SNAPSHOT = 'aaaaaaaa-0000-4000-8000-000000000004';
const ADDED = 'aaaaaaaa-0000-4000-8000-000000000005';

// Not UTF-8: a download that passed through text would not match.
const FILE_BYTES = new Uint8Array([0x7b, 0x27, 0xe9, 0x27, 0x7d, 0x80, 0x00, 0xff, 0xfe, 0xc3]);

function reference(overrides: Partial<SavedReference>): SavedReference {
	return {
		id: KEEPER,
		title: 'Guji natural, September keeper',
		notes: null,
		sourceClass: 'artisan_upload',
		status: 'active',
		artisanFileAvailable: true,
		currentRevisionId: `${overrides.id ?? KEEPER}-revision`,
		createdAt: '2026-09-28T12:00:00Z',
		updatedAt: '2026-09-28T12:00:00Z',
		sourceRoast: null,
		...overrides
	};
}

const keeper = reference({});
const kept = reference({
	id: KEPT,
	title: 'Colombia Sierra Nevada, Sept 24',
	sourceClass: 'executed_roast',
	createdAt: '2026-09-25T12:00:00Z',
	sourceRoast: { id: 4507, revision: 'revision-4507' }
});
const plan = reference({
	id: PLAN,
	title: 'Guji plan: +5°F through drying',
	sourceClass: 'generated_revision',
	artisanFileAvailable: false,
	createdAt: '2026-10-02T12:00:00Z'
});
/** A roast's curve kept without its Artisan file. */
const snapshot = reference({
	id: SNAPSHOT,
	title: 'Older Guji curve',
	sourceClass: 'executed_roast',
	artisanFileAvailable: false,
	createdAt: '2026-09-20T12:00:00Z',
	sourceRoast: { id: 4480, revision: 'revision-4480' }
});

const chart = {
	temperatureUnit: 'F',
	chargeTimeMilliseconds: 30_000,
	series: [
		{
			id: 'bt',
			name: 'BT',
			kind: 'bean_temperature',
			unit: 'F',
			deviceIndex: 0,
			channel: 2,
			points: [
				{ timeMilliseconds: 30_000, value: 392 },
				{ timeMilliseconds: 630_000, value: 402 }
			]
		}
	],
	events: []
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

type Sent = { url: string; method: string; headers: Headers; body: unknown };

let references: SavedReference[];
let sent: Sent[];
/** Answers that replace the usual one for a request, keyed by `METHOD url`. */
let answers: Record<string, () => Response>;
let saved: Blob[];
let clicked: string[];

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	const method = init?.method ?? 'GET';
	const body =
		typeof init?.body === 'string' ? JSON.parse(init.body) : (init?.body as unknown) || undefined;
	sent.push({ url, method, headers: new Headers(init?.headers), body });

	const answer = answers[`${method} ${url}`];
	if (answer) return answer();
	if (url === '/api/reference-profiles' && method === 'GET') return json({ data: references });
	if (url === '/api/reference-profiles' && method === 'POST') {
		const title = String((body as FormData).get('title'));
		references = [
			...references,
			reference({ id: ADDED, title, createdAt: '2026-10-05T12:00:00Z' })
		];
		return json({ data: { id: ADDED, title } }, 201);
	}
	if (url === '/api/beans') {
		return json({
			data: [
				{ id: 102, name: 'Colombia lot', coffee_catalog: { name: 'Colombia Sierra Nevada' } },
				{ id: 101, name: 'Ethiopia Yirgacheffe Wush Wush', coffee_catalog: null }
			]
		});
	}
	const one = url.match(/^\/api\/reference-profiles\/([0-9a-f-]+)$/);
	if (one && method === 'PATCH') {
		return json({ data: { id: one[1], title: (body as { title: string }).title } });
	}
	if (one && method === 'DELETE') return new Response(null, { status: 204 });
	if (/\/artisan-file$/.test(url)) {
		return new Response(FILE_BYTES, {
			headers: { 'Content-Disposition': 'attachment; filename="Guji natural 09-28.alog"' }
		});
	}
	if (/\/export$/.test(url)) {
		return new Response('{"plan":true}', {
			headers: { 'Content-Disposition': 'attachment; filename="Guji-plan.alog"' }
		});
	}
	if (/\/roast$/.test(url) && method === 'POST') {
		return json({ data: { roastId: 4532, coffeeName: 'Ethiopia Yirgacheffe Wush Wush' } }, 201);
	}
	if (/\/chart$/.test(url)) return json({ data: { chart } });
	throw new Error(`Unexpected request: ${method} ${url}`);
});

function requests(method: string, url?: string | RegExp) {
	return sent.filter(
		(request) =>
			request.method === method &&
			(url === undefined || (typeof url === 'string' ? request.url === url : url.test(request.url)))
	);
}

async function renderLibrary(props: Record<string, unknown> = {}) {
	const view = render(SavedLibrary, { ownerId: 'member-1', ...props });
	await waitFor(() => expect(requests('GET', '/api/reference-profiles')).toHaveLength(1));
	await waitFor(() => expect(document.querySelector('.animate-pulse')).toBeNull());
	return view;
}

function list() {
	return screen.getByRole('list', { name: 'Saved references and plans, newest first' });
}

function rowOf(title: string): HTMLElement {
	const row = within(list())
		.getAllByRole('listitem')
		.find((item) => within(item).queryByText(title));
	if (!row) throw new Error(`No row for ${title}`);
	return row;
}

function rowTitles(): string[] {
	return within(list())
		.getAllByRole('listitem')
		.map((item) => item.querySelector('.font-semibold')?.textContent?.trim() ?? '');
}

async function openMenu(title: string) {
	await fireEvent.click(screen.getByRole('button', { name: `More for ${title}` }));
	return screen.getByRole('menu', { name: `More for ${title}` });
}

async function chooseFromMenu(title: string, item: string) {
	const menu = await openMenu(title);
	await fireEvent.click(within(menu).getByRole('menuitem', { name: item }));
}

beforeEach(() => {
	vi.clearAllMocks();
	references = [kept, keeper, plan, snapshot];
	sent = [];
	answers = {};
	saved = [];
	clicked = [];
	sessionStorage.clear();
	vi.stubGlobal('fetch', fetchMock);
	// The test DOM has no object URLs; the page only needs one to hand a file to the browser.
	URL.createObjectURL = vi.fn((blob: Blob) => (saved.push(blob), 'blob:artisan-file'));
	URL.revokeObjectURL = vi.fn();
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
		this: HTMLAnchorElement
	) {
		if (this.download) clicked.push(this.download);
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('the saved library', () => {
	it('lists every reference and plan newest first, with its source and date', async () => {
		await renderLibrary();

		expect(
			screen.getByRole('heading', { level: 1, name: 'Saved references and plans' })
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'References you kept to repeat, and plans you made from them. They are never counted as roasts.'
			)
		).toBeInTheDocument();
		expect(rowTitles()).toEqual([
			'Guji plan: +5°F through drying',
			'Guji natural, September keeper',
			'Colombia Sierra Nevada, Sept 24',
			'Older Guji curve'
		]);
		expect(within(rowOf(plan.title)).getByText('Plan · Saved Oct 2, 2026')).toBeInTheDocument();
		expect(
			within(rowOf(keeper.title)).getByText('Artisan file · Saved Sep 28, 2026')
		).toBeInTheDocument();
		expect(
			within(rowOf(kept.title)).getByText('Saved from a roast · Saved Sep 25, 2026')
		).toBeInTheDocument();
	});

	it('puts the download first on a plan and the curve first on a reference', async () => {
		await renderLibrary();

		// A plan opens on its own page, where its curve is drawn over what it started from.
		expect(screen.getByRole('link', { name: plan.title })).toHaveAttribute(
			'href',
			`/roast/plan?plan=${PLAN}`
		);
		expect(
			within(rowOf(plan.title)).getByRole('button', {
				name: `Download for Artisan: ${plan.title}`
			})
		).toHaveTextContent('Download for Artisan');
		expect(
			within(rowOf(keeper.title)).getByRole('link', { name: `View curve: ${keeper.title}` })
		).toHaveAttribute('href', `/roast/saved?ref=${KEEPER}`);
		expect(within(rowOf(keeper.title)).queryByRole('button', { name: /Download/ })).toBeNull();
	});

	it('offers every action on an Artisan file from its row menu, with removal last', async () => {
		await renderLibrary();
		const menu = await openMenu(keeper.title);

		const items = within(menu).getAllByRole('menuitem');
		expect(items.map((item) => item.textContent?.trim())).toEqual([
			'View curve',
			'Compare',
			'Plan from this',
			'Download for Artisan',
			'Record as a roast I ran',
			'Rename',
			'Remove'
		]);
		expect(within(menu).getByRole('menuitem', { name: 'View curve' })).toHaveAttribute(
			'href',
			`/roast/saved?ref=${KEEPER}`
		);
		// Compare opens the comparison with this reference already chosen.
		expect(within(menu).getByRole('menuitem', { name: 'Compare' })).toHaveAttribute(
			'href',
			`/roast/compare?a=ref:${KEEPER}`
		);
		expect(within(menu).getByRole('menuitem', { name: 'Plan from this' })).toHaveAttribute(
			'href',
			`/roast/plan?from=ref:${KEEPER}`
		);
	});

	it('records only an uploaded file as a roast, and plans only from what Artisan can read', async () => {
		await renderLibrary();
		const itemsOf = async (title: string) => {
			const menu = await openMenu(title);
			const labels = within(menu)
				.getAllByRole('menuitem')
				.map((item) => item.textContent?.trim());
			await fireEvent.keyDown(menu, { key: 'Escape' });
			return labels;
		};

		expect(await itemsOf(plan.title)).toEqual([
			'View curve',
			'Compare',
			'Plan from this',
			'Download for Artisan',
			'Rename',
			'Remove'
		]);
		// Kept from a roast with that roast's file: it can be planned from, not recorded again.
		expect(await itemsOf(kept.title)).toEqual([
			'View curve',
			'Compare',
			'Plan from this',
			'Download for Artisan',
			'Rename',
			'Remove'
		]);
		expect(await itemsOf(snapshot.title)).toEqual([
			'View curve',
			'Compare',
			'Download for Artisan',
			'Rename',
			'Remove'
		]);
	});

	it('closes the row menu on Escape and returns to its button', async () => {
		await renderLibrary();
		const menu = await openMenu(keeper.title);

		await fireEvent.keyDown(menu, { key: 'Escape' });

		expect(screen.queryByRole('menu')).toBeNull();
		expect(screen.getByRole('button', { name: `More for ${keeper.title}` })).toHaveFocus();
	});

	it('compares two ticked rows, the newer as side A', async () => {
		await renderLibrary();
		expect(screen.getByText('Tick two to compare them.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();

		await fireEvent.click(screen.getByRole('checkbox', { name: `Compare ${kept.title}` }));
		expect(screen.getByText('1 selected')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();

		await fireEvent.click(screen.getByRole('checkbox', { name: `Compare ${keeper.title}` }));
		expect(screen.getByText('2 selected')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Compare' })).toHaveAttribute(
			'href',
			`/roast/compare?a=ref:${KEEPER}&b=ref:${KEPT}`
		);

		// A third tick replaces the earliest, so there are never more than two sides.
		await fireEvent.click(screen.getByRole('checkbox', { name: `Compare ${plan.title}` }));
		expect(screen.getByRole('checkbox', { name: `Compare ${kept.title}` })).not.toBeChecked();
		expect(screen.getByRole('link', { name: 'Compare' })).toHaveAttribute(
			'href',
			`/roast/compare?a=ref:${PLAN}&b=ref:${KEEPER}`
		);
	});

	it('says what to save when nothing is saved yet', async () => {
		references = [];
		await renderLibrary();

		expect(screen.getByText('Nothing saved yet.')).toBeInTheDocument();
		expect(
			screen.getByText(
				/Save a roast you want to repeat, add an Artisan file, or make a plan from a roast\./
			)
		).toBeInTheDocument();
		expect(screen.queryByRole('list')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull();
		expect(screen.getByRole('link', { name: 'Open Roasts' })).toHaveAttribute('href', '/roast');
		expect(screen.getAllByRole('button', { name: 'Add an Artisan file' })).toHaveLength(2);
	});

	it('offers to try again when the list cannot be loaded', async () => {
		answers['GET /api/reference-profiles'] = () => json({ error: 'unavailable' }, 503);
		await renderLibrary();

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Saved references and plans could not be loaded.'
		);
		expect(screen.queryByText('Nothing saved yet.')).toBeNull();

		delete answers['GET /api/reference-profiles'];
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

		await waitFor(() => expect(rowTitles()).toHaveLength(4));
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('uses none of the retired names', async () => {
		const { container } = await renderLibrary();
		await openMenu(keeper.title);

		expect(container.textContent).not.toMatch(
			/profile studio|roast studio|saved profiles|snapshot|immutable|executed roast|historical roast|planned reference|unsigned|charge-aligned|bounded|parent/i
		);
		expect(container.textContent).not.toMatch(/\bprofiles?\b/i);
	});
});

describe('adding an Artisan file', () => {
	it('keeps the file as a reference under its own name, and lists it', async () => {
		await renderLibrary();
		await fireEvent.click(screen.getByRole('button', { name: 'Add an Artisan file' }));

		const form = screen.getByRole('form', { name: 'Add an Artisan file' });
		expect(
			within(form).getByText(
				'Keeps the file as a reference to compare or plan from. To record it as a roast you ran, import it from Roasts.'
			)
		).toBeInTheDocument();
		const save = within(form).getByRole('button', { name: 'Save reference' });
		expect(save).toBeDisabled();

		const file = new File([FILE_BYTES], 'Kenya_Nyeri 10-04.alog');
		await fireEvent.change(within(form).getByLabelText('Artisan file (.alog)'), {
			target: { files: [file] }
		});
		// The file's own name tells one upload from the next.
		expect(within(form).getByLabelText('Name')).toHaveValue('Kenya Nyeri 10-04');
		await fireEvent.click(save);

		await waitFor(() => expect(requests('POST', '/api/reference-profiles')).toHaveLength(1));
		const [upload] = requests('POST', '/api/reference-profiles');
		expect((upload.body as FormData).get('file')).toBe(file);
		expect((upload.body as FormData).get('title')).toBe('Kenya Nyeri 10-04');
		expect(upload.headers.get('Idempotency-Key')).toBeTruthy();

		expect(
			await screen.findByText(
				'Kenya Nyeri 10-04 is saved as a reference. It is not counted as a roast.'
			)
		).toBeInTheDocument();
		expect(screen.queryByRole('form', { name: 'Add an Artisan file' })).toBeNull();
		await waitFor(() => expect(rowTitles()[0]).toBe('Kenya Nyeri 10-04'));
	});

	it('says why a file was refused and keeps the form open', async () => {
		answers['POST /api/reference-profiles'] = () =>
			json({ error: 'This is not an Artisan file' }, 400);
		await renderLibrary();
		await fireEvent.click(screen.getByRole('button', { name: 'Add an Artisan file' }));
		const form = screen.getByRole('form', { name: 'Add an Artisan file' });
		await fireEvent.change(within(form).getByLabelText('Artisan file (.alog)'), {
			target: { files: [new File(['not artisan'], 'notes.json')] }
		});

		await fireEvent.click(within(form).getByRole('button', { name: 'Save reference' }));

		expect(await within(form).findByRole('alert')).toHaveTextContent(
			'This is not an Artisan file'
		);
		expect(rowTitles()).toHaveLength(4);
	});
});

describe('renaming', () => {
	it('saves the new name only when the member confirms it', async () => {
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Rename');

		// The name is edited in its own row, in place of the title.
		const name = within(list()).getByLabelText('Name');
		expect(name).toHaveValue(keeper.title);
		expect(name).toHaveFocus();
		// Nothing is sent until "Save name".
		expect(requests('PATCH')).toHaveLength(0);

		await fireEvent.input(name, { target: { value: '  Guji keeper, 402°F drop  ' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

		await waitFor(() => expect(requests('PATCH')).toHaveLength(1));
		const [rename] = requests('PATCH');
		expect(rename.url).toBe(`/api/reference-profiles/${KEEPER}`);
		expect(rename.body).toEqual({ title: 'Guji keeper, 402°F drop' });
		expect(await screen.findByText('Renamed to Guji keeper, 402°F drop.')).toBeInTheDocument();
		expect(rowTitles()).toContain('Guji keeper, 402°F drop');
		expect(screen.queryByRole('button', { name: 'Save name' })).toBeNull();
	});

	it('leaves the name alone on Cancel and on Escape', async () => {
		await renderLibrary();

		await chooseFromMenu(keeper.title, 'Rename');
		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Changed' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByLabelText('Name')).toBeNull();

		await chooseFromMenu(keeper.title, 'Rename');
		await fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });
		expect(screen.queryByLabelText('Name')).toBeNull();

		expect(requests('PATCH')).toHaveLength(0);
		expect(rowTitles()).toContain(keeper.title);
	});

	it('asks for a name before sending an empty one', async () => {
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Rename');

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: '   ' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('Enter a name.');
		expect(requests('PATCH')).toHaveLength(0);
	});

	it('keeps the form open with the reason when the name cannot be saved', async () => {
		answers[`PATCH /api/reference-profiles/${KEEPER}`] = () =>
			json({ error: 'A name can be up to 200 characters' }, 400);
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Rename');

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'New name' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'A name can be up to 200 characters'
		);
		expect(screen.getByLabelText('Name')).toHaveValue('New name');
		expect(screen.getByRole('button', { name: 'Save name' })).toBeEnabled();
	});
});

describe('removing', () => {
	it('asks first, and removes nothing when the member keeps it', async () => {
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Remove');

		const question = screen.getByRole('alertdialog', { name: `Remove ${keeper.title}?` });
		expect(question).toHaveTextContent(
			'It will no longer be here to compare, plan from, or download. This cannot be undone. Your roasts are not changed.'
		);
		// Focus opens on the choice that changes nothing.
		expect(within(question).getByRole('button', { name: 'Keep it' })).toHaveFocus();

		await fireEvent.click(within(question).getByRole('button', { name: 'Keep it' }));

		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(requests('DELETE')).toHaveLength(0);
		expect(rowTitles()).toContain(keeper.title);
	});

	it('treats Escape as keeping it', async () => {
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Remove');

		await fireEvent.keyDown(window, { key: 'Escape' });

		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(requests('DELETE')).toHaveLength(0);
	});

	it('removes it once confirmed, and says the roasts are unchanged', async () => {
		await renderLibrary();
		await fireEvent.click(screen.getByRole('checkbox', { name: `Compare ${keeper.title}` }));
		await chooseFromMenu(keeper.title, 'Remove');

		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' })
		);

		await waitFor(() => expect(requests('DELETE')).toHaveLength(1));
		expect(requests('DELETE')[0].url).toBe(`/api/reference-profiles/${KEEPER}`);
		expect(
			await screen.findByText(`${keeper.title} is removed. Your roasts are not changed.`)
		).toBeInTheDocument();
		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(rowTitles()).not.toContain(keeper.title);
		// It is no longer one of the two ticked for comparison.
		expect(screen.getByText('Tick two to compare them.')).toBeInTheDocument();
	});

	it('keeps the row and says why when it cannot be removed', async () => {
		answers[`DELETE /api/reference-profiles/${KEEPER}`] = () =>
			json({ error: 'A plan was made from this reference' }, 409);
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Remove');

		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' })
		);

		const question = screen.getByRole('alertdialog');
		expect(await within(question).findByRole('alert')).toHaveTextContent(
			'A plan was made from this reference'
		);
		expect(rowTitles()).toContain(keeper.title);
	});

	it('closes the open curve when the reference it belongs to is removed', async () => {
		const onCloseCurve = vi.fn();
		await renderLibrary({ openId: KEEPER, onCloseCurve });
		await chooseFromMenu(keeper.title, 'Remove');

		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' })
		);

		await waitFor(() => expect(onCloseCurve).toHaveBeenCalledOnce());
	});
});

describe('downloading for Artisan', () => {
	it('downloads the original file of an uploaded reference, unchanged', async () => {
		await renderLibrary();

		await chooseFromMenu(keeper.title, 'Download for Artisan');

		await waitFor(() =>
			expect(requests('GET', `/api/reference-profiles/${KEEPER}/artisan-file`)).toHaveLength(1)
		);
		const status = await within(rowOf(keeper.title)).findByRole('status');
		expect(status).toHaveTextContent(
			'Downloading Guji natural 09-28.alog. It is the Artisan file you added, unchanged. In Artisan, open Roast, then Background, and load this file.'
		);
		expect(clicked).toEqual(['Guji natural 09-28.alog']);
		expect(Array.from(new Uint8Array(await saved[0].arrayBuffer()))).toEqual(
			Array.from(FILE_BYTES)
		);
	});

	it('downloads the roast’s file for a reference kept from a roast', async () => {
		await renderLibrary();

		await chooseFromMenu(kept.title, 'Download for Artisan');

		await waitFor(() =>
			expect(requests('GET', `/api/reference-profiles/${KEPT}/artisan-file`)).toHaveLength(1)
		);
		expect(await within(rowOf(kept.title)).findByRole('status')).toHaveTextContent(
			'It is the Artisan file of the roast this reference was kept from, unchanged.'
		);
	});

	it('downloads a plan through the plan’s own export', async () => {
		await renderLibrary();

		await fireEvent.click(
			screen.getByRole('button', { name: `Download for Artisan: ${plan.title}` })
		);

		await waitFor(() =>
			expect(
				requests('GET', `/api/reference-profiles/${PLAN}/revisions/${PLAN}-revision/export`)
			).toHaveLength(1)
		);
		expect(requests('GET', /artisan-file$/)).toHaveLength(0);
		expect(await within(rowOf(plan.title)).findByRole('status')).toHaveTextContent(
			'Downloading Guji-plan.alog. It is this plan as an Artisan file.'
		);
		expect(clicked).toEqual(['Guji-plan.alog']);
	});

	it('gives Parchment’s reason as the next step when no file is on record', async () => {
		answers[`GET /api/reference-profiles/${SNAPSHOT}/artisan-file`] = () =>
			json(
				{
					error: 'This reference has no Artisan file',
					code: 'reference_artisan_file_unavailable',
					reason: 'chart_snapshot'
				},
				400
			);
		await renderLibrary();

		await chooseFromMenu(snapshot.title, 'Download for Artisan');

		const note = await within(rowOf(snapshot.title)).findByRole('status');
		expect(note).toHaveTextContent(
			'This reference holds a roast’s curve without its Artisan file, so there is no file to download. If that roast was imported from Artisan, its file is under More on the roast.'
		);
		// A next step, not a failure, and the roast it came from is one link away.
		expect(note).not.toHaveClass('bg-danger-subtle');
		expect(within(note).getByRole('link', { name: 'Open the roast' })).toHaveAttribute(
			'href',
			'/roast?roast=4480'
		);
		expect(clicked).toEqual([]);
		expect(saved).toEqual([]);
	});

	it('says to try again when the download fails for no stated reason', async () => {
		answers[`GET /api/reference-profiles/${KEEPER}/artisan-file`] = () =>
			json({ error: 'Unable to download this Artisan file' }, 502);
		await renderLibrary();

		await chooseFromMenu(keeper.title, 'Download for Artisan');

		expect(await within(rowOf(keeper.title)).findByRole('alert')).toHaveTextContent(
			'This file could not be downloaded. Try again in a moment.'
		);
		expect(clicked).toEqual([]);
	});
});

describe('recording an Artisan file as a roast', () => {
	it('records it against the chosen coffee and keeps the reference', async () => {
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Record as a roast I ran');

		const dialog = screen.getByRole('dialog', { name: 'Record as a roast I ran' });
		expect(dialog).toHaveTextContent(
			`Adds ${keeper.title} to your roasts, with the curve from its Artisan file. It then counts as one of that coffee’s roasts. This saved reference is kept.`
		);
		const coffee = await within(dialog).findByLabelText('Coffee that was roasted');
		// The portfolio's coffees, by name.
		expect(
			within(coffee as HTMLElement)
				.getAllByRole('option')
				.map((option) => option.textContent)
		).toEqual(['Choose a coffee', 'Colombia Sierra Nevada', 'Ethiopia Yirgacheffe Wush Wush']);
		const record = within(dialog).getByRole('button', { name: 'Record roast' });
		expect(record).toBeDisabled();

		await fireEvent.change(coffee, { target: { value: '101' } });
		await fireEvent.click(record);

		await waitFor(() => expect(requests('POST', /\/roast$/)).toHaveLength(1));
		const [request] = requests('POST', /\/roast$/);
		expect(request.url).toBe(`/api/reference-profiles/${KEEPER}/roast`);
		expect(request.body).toEqual({ coffeeId: 101, revisionId: `${KEEPER}-revision` });
		expect(request.headers.get('Idempotency-Key')).toBeTruthy();

		const status = await within(rowOf(keeper.title)).findByRole('status');
		expect(status).toHaveTextContent(
			'Recorded as roast #4532 of Ethiopia Yirgacheffe Wush Wush. This saved reference is kept.'
		);
		expect(within(status).getByRole('link', { name: 'Open the roast' })).toHaveAttribute(
			'href',
			'/roast?roast=4532'
		);
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(rowTitles()).toContain(keeper.title);
	});

	it('records nothing when the member cancels', async () => {
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Record as a roast I ran');
		const dialog = screen.getByRole('dialog', { name: 'Record as a roast I ran' });
		await within(dialog).findByLabelText('Coffee that was roasted');

		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

		expect(screen.queryByRole('dialog')).toBeNull();
		expect(requests('POST')).toHaveLength(0);
	});

	it('keeps the question open with the reason when the roast cannot be recorded', async () => {
		answers[`POST /api/reference-profiles/${KEEPER}/roast`] = () =>
			json({ error: 'This coffee has no weight left to roast' }, 409);
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Record as a roast I ran');
		const dialog = screen.getByRole('dialog', { name: 'Record as a roast I ran' });
		await fireEvent.change(await within(dialog).findByLabelText('Coffee that was roasted'), {
			target: { value: '102' }
		});

		await fireEvent.click(within(dialog).getByRole('button', { name: 'Record roast' }));

		expect(await within(dialog).findByRole('alert')).toHaveTextContent(
			'This coffee has no weight left to roast'
		);
		expect(within(dialog).getByRole('button', { name: 'Record roast' })).toBeEnabled();
	});

	it('points to portfolio when there is no coffee to record it against', async () => {
		answers['GET /api/beans'] = () => json({ data: [] });
		await renderLibrary();
		await chooseFromMenu(keeper.title, 'Record as a roast I ran');

		const dialog = screen.getByRole('dialog', { name: 'Record as a roast I ran' });
		expect(
			await within(dialog).findByText(
				/A roast is recorded against a coffee in your portfolio, and yours has none yet\./
			)
		).toBeInTheDocument();
		expect(within(dialog).getByRole('link', { name: 'Add a coffee' })).toHaveAttribute(
			'href',
			'/beans'
		);
		expect(within(dialog).getByRole('button', { name: 'Record roast' })).toBeDisabled();
	});
});

describe('viewing a curve', () => {
	it('draws the open reference’s curve under its row, and offers to hide it', async () => {
		await renderLibrary({ openId: KEEPER });

		await waitFor(() =>
			expect(
				requests('GET', `/api/reference-profiles/${KEEPER}/revisions/${KEEPER}-revision/chart`)
			).toHaveLength(1)
		);
		const row = rowOf(keeper.title);
		await waitFor(() => expect(within(row).queryByText('Loading the curve…')).toBeNull());
		expect(within(row).getByRole('link', { name: `Hide curve: ${keeper.title}` })).toHaveAttribute(
			'href',
			'/roast/saved'
		);
		// Only the open row loads a curve.
		expect(requests('GET', /\/chart$/)).toHaveLength(1);
	});

	it('offers to try again when the curve cannot be loaded', async () => {
		const chartUrl = `/api/reference-profiles/${KEEPER}/revisions/${KEEPER}-revision/chart`;
		answers[`GET ${chartUrl}`] = () => json({ error: 'unavailable' }, 503);
		await renderLibrary({ openId: KEEPER });

		const failure = await within(rowOf(keeper.title)).findByRole('alert');
		expect(failure).toHaveTextContent('This curve could not be loaded.');

		delete answers[`GET ${chartUrl}`];
		await fireEvent.click(within(failure).getByRole('button', { name: 'Try again' }));

		await waitFor(() => expect(requests('GET', chartUrl)).toHaveLength(2));
		await waitFor(() => expect(within(rowOf(keeper.title)).queryByRole('alert')).toBeNull());
	});

	it('says so when the link names a reference that is no longer saved', async () => {
		await renderLibrary({ openId: 'ffffffff-0000-4000-8000-000000000009' });

		expect(
			screen.getByText('That saved reference could not be found. It may have been removed.')
		).toBeInTheDocument();
		expect(requests('GET', /\/chart$/)).toHaveLength(0);
	});
});
