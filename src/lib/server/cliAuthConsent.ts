import type { RequestEvent } from '@sveltejs/kit';

export const DEFAULT_CLI_AUTH_FAILURE =
	'This CLI sign-in request is invalid or no longer available. Start a new login from the CLI.';
export const CLI_REQUEST_COOKIE = 'purveyors_cli_auth_request';
export const CLI_AUTH_RETURN_PATH = '/auth/cli';

type CliAuthEvent = Pick<RequestEvent, 'url' | 'cookies'>;

export function rememberCliRequest(event: CliAuthEvent, requestToken: string) {
	event.cookies.set(CLI_REQUEST_COOKIE, requestToken, {
		httpOnly: true,
		maxAge: 10 * 60,
		path: CLI_AUTH_RETURN_PATH,
		sameSite: 'lax',
		secure: event.url.protocol === 'https:'
	});
}

export function readCliRequest(event: Pick<RequestEvent, 'cookies'>) {
	return event.cookies.get(CLI_REQUEST_COOKIE)?.trim();
}

export function clearCliRequest(event: Pick<RequestEvent, 'cookies'>) {
	event.cookies.delete(CLI_REQUEST_COOKIE, { path: CLI_AUTH_RETURN_PATH });
}

export function cliAuthRedirectLocation() {
	return `/auth?next=${encodeURIComponent(CLI_AUTH_RETURN_PATH)}`;
}
