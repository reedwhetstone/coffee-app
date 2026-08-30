import { render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Pricing from './Pricing.svelte';
import { SELF_SERVE_PLANS } from '$lib/billing/selfServePlans';

const mocks = vi.hoisted(() => ({
	trackBillingOfferEvent: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/billing/offerAnalytics', () => mocks);

class FakeIntersectionObserver {
	readonly observe = vi.fn();
	readonly disconnect = vi.fn();

	constructor(readonly callback: IntersectionObserverCallback) {}

	trigger(isIntersecting: boolean) {
		this.callback(
			[{ isIntersecting } as IntersectionObserverEntry],
			this as unknown as IntersectionObserver
		);
	}
}

let observers: FakeIntersectionObserver[] = [];

describe('homepage pricing impressions', () => {
	beforeEach(() => {
		observers = [];
		mocks.trackBillingOfferEvent.mockClear();
		vi.stubGlobal(
			'IntersectionObserver',
			class extends FakeIntersectionObserver {
				constructor(callback: IntersectionObserverCallback) {
					super(callback);
					observers.push(this);
				}
			}
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('waits for the pricing section to enter the viewport and tracks once', async () => {
		render(Pricing, {
			auth: { isSignedIn: false, user: null, role: 'viewer', ppiAccess: false }
		});

		await waitFor(() => expect(observers).toHaveLength(1));
		expect(mocks.trackBillingOfferEvent).not.toHaveBeenCalled();
		expect(observers[0].observe).toHaveBeenCalledWith(document.getElementById('pricing'));

		observers[0].trigger(false);
		expect(mocks.trackBillingOfferEvent).not.toHaveBeenCalled();

		observers[0].trigger(true);
		expect(mocks.trackBillingOfferEvent).toHaveBeenCalledTimes(SELF_SERVE_PLANS.length);
		expect(observers[0].disconnect).toHaveBeenCalledTimes(1);

		observers[0].trigger(true);
		expect(mocks.trackBillingOfferEvent).toHaveBeenCalledTimes(SELF_SERVE_PLANS.length);
	});
});
