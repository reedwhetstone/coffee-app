import type { RequestHandler } from './$types';

import { handleReconcileStripeSession } from '$lib/server/billing/reconcile-session';

export const POST: RequestHandler = async (event) => handleReconcileStripeSession(event);
