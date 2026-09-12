const scenario = new URLSearchParams(location.search).get('state') ?? 'settled';
export const workspace = {
	id: 'compact-fixture',
	title: 'Coffee',
	type: 'general',
	context_summary: 'Compare washed coffees with transparent pricing.',
	last_accessed_at: '2026-09-11T17:00:00Z',
	created_at: '2026-09-11T17:00:00Z',
	reset_epoch: 0,
	canvas_version: 0,
	canvas_state:
		scenario === 'empty'
			? {}
			: {
					blocks: [
						{
							title: 'Washed coffee comparison',
							messageId: 'answer-1',
							block: {
								type: 'data-table',
								version: 1,
								data: {
									columns: [
										{ key: 'coffee', label: 'Coffee' },
										{ key: 'price', label: 'Price / lb' }
									],
									rows: [
										{ coffee: 'Colombia La Esperanza', price: '$8.50' },
										{ coffee: 'Ethiopia Sidama', price: '$9.25' }
									]
								}
							}
						}
					]
				}
};
const initialMessages =
	scenario === 'empty'
		? []
		: [
				{
					id: 'question-1',
					client_message_id: 'question-1',
					workspace_id: workspace.id,
					role: 'user',
					content: 'Compare washed Colombia and Ethiopia for our next seasonal coffee.',
					created_at: workspace.created_at
				},
				{
					id: 'answer-1',
					client_message_id: 'answer-1',
					workspace_id: workspace.id,
					role: 'assistant',
					content:
						'## Two coffees worth comparing\n\n**Colombia La Esperanza** offers balanced sweetness and a round body. **Ethiopia Sidama** offers a brighter citrus profile.\n\n| Coffee | Price / lb | Process |\n| --- | --- | --- |\n| Colombia La Esperanza | $8.50 | Washed |\n| Ethiopia Sidama | $9.25 | Washed |\n\n### Recommendation\n\nChoose Colombia for a familiar daily cup, or Ethiopia for a more expressive seasonal release. Confirm availability and landed cost before ordering.\n\n' +
						'### Landed cost matters\n\nAt a 15% roast loss, green coffee at $8.50/lb becomes $10.00 per roasted pound before freight, packaging, and labor. Ethiopia at $9.25/lb becomes about $10.88. Compare the resulting retail margins using your actual freight quote.\n\n### Sample before committing\n\nOrder both samples, then evaluate sweetness, clarity, and development tolerance on the same roast schedule. Ask the supplier to confirm available bags, harvest timing, and warehouse location.\n\n### A practical next step\n\nReserve no stock yet. Cup the samples blind, compare landed costs, and choose a release size that fits your next six weeks of demand. The evidence panel keeps the side-by-side prices available while you draft a follow-up.',
					created_at: workspace.created_at
				}
			];
// A long retained conversation for reading-position and in-flight draft checks.
export const messages =
	scenario === 'reading'
		? [
				...initialMessages,
				...Array.from({ length: 198 }, (_, index) => ({
					id: `history-${index}`,
					client_message_id: `history-${index}`,
					workspace_id: workspace.id,
					role: index % 2 ? 'assistant' : 'user',
					content:
						index % 2
							? `Historical answer ${index}: compare roast development and landed costs before choosing a coffee.`
							: `Historical question ${index}: what should we compare?`,
					created_at: workspace.created_at
				}))
			]
		: initialMessages;
export const auth = {
	isSignedIn: true,
	user: { id: 'fixture-user', email: 'fixture@example.invalid' },
	role: 'member' as const,
	ppiAccess: true
};
export const data = {
	auth,
	initialWorkspaceData: { workspace, messages, workspaces: [workspace] }
};

export function installNetwork() {
	const nativeFetch = window.fetch.bind(window);
	const requests: unknown[] = [];
	Object.assign(window, { fixtureRequests: requests });
	window.fetch = async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		if (!url.startsWith('/api/')) return nativeFetch(input, init);
		requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
		if (url === '/api/chat') {
			if (scenario === 'error')
				return Response.json(
					{ error: 'Fixture connection failure. Please retry.' },
					{ status: 503 }
				);
			const encoder = new TextEncoder();
			return new Response(
				new ReadableStream({
					start(controller) {
						if (scenario === 'reading')
							Object.assign(window, {
								fixtureStream: {
									emit: (delta: string) =>
										controller.enqueue(
											encoder.encode(
												`data: ${JSON.stringify({ type: 'text-delta', id: 'text', delta })}\n\n`
											)
										),
									finish: () => {
										controller.enqueue(
											encoder.encode(
												'data: {"type":"text-end","id":"text"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n'
											)
										);
										controller.close();
									},
									fail: () => controller.error(new TypeError('Fixture disconnect'))
								}
							});
						for (const chunk of [
							{ type: 'start', messageId: `working-answer-${requests.length}` },
							{ type: 'start-step' },
							{ type: 'text-start', id: 'text' },
							{
								type: 'text-delta',
								id: 'text',
								delta: 'I am comparing current coffee availability and pricing…'
							}
						])
							controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
						init?.signal?.addEventListener('abort', () =>
							controller.error(new DOMException('Aborted', 'AbortError'))
						);
					}
				}),
				{ headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } }
			);
		}
		if (url === '/api/memory')
			return Response.json({
				content: 'Prefer washed coffees and transparent sourcing.',
				version: 1
			});
		if (url === '/api/workspaces') return Response.json({ workspaces: [workspace] });
		if (url === `/api/workspaces/${workspace.id}`) return Response.json({ workspace, messages });
		if (url.endsWith('/messages'))
			return Response.json({ reset_epoch: 0, next_message_sequence: 3 });
		if (url.endsWith('/canvas'))
			return Response.json({
				canvas_state: workspace.canvas_state,
				canvas_version: 1,
				reset_epoch: 0
			});
		return Response.json({});
	};
}
