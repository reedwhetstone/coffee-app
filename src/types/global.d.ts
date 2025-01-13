declare global {
	var processHandler: {
		sendLog: (message: string) => void;
		addProcess: (process: any) => void;
	};
}

export {};
