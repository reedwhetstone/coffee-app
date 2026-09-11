interface ProcessHandler {
	sendLog: (message: string) => void;
	addProcess: (process: { pid: number; command: string; status: string }) => void;
}

declare global {
	declare const processHandler: ProcessHandler;
	declare const Stripe: (key: string) => {
		initEmbeddedCheckout(options: { clientSecret: string; onComplete: () => void }): Promise<{
			mount(element: HTMLElement): void;
			destroy(): void;
			error?: { message: string };
		}>;
	};
}

export {};
