export type SyncTrigger = 'manual' | 'startup';

export interface PlaudSyncRuntimeOptions {
	isStartupEnabled: () => boolean;
	runSync: (trigger: SyncTrigger) => Promise<void>;
	onLocked: (message: string) => void;
}

const LOCKED_MESSAGE = 'Plaud sync already running. Please wait for current run to finish.';

export interface PlaudSyncRuntime {
	runManualSync(): Promise<boolean>;
	runStartupSync(): Promise<boolean>;
}

export function createPlaudSyncRuntime(options: PlaudSyncRuntimeOptions): PlaudSyncRuntime {
	let inFlight: Promise<void> | null = null;

	const runWithLock = async (trigger: SyncTrigger): Promise<boolean> => {
		if (inFlight) {
			options.onLocked(LOCKED_MESSAGE);
			return false;
		}

		const runPromise = options.runSync(trigger);
		inFlight = runPromise;

		try {
			await runPromise;
			return true;
		} finally {
			if (inFlight === runPromise) {
				inFlight = null;
			}
		}
	};

	return {
		runManualSync: () => runWithLock('manual'),
		runStartupSync: () => {
			if (!options.isStartupEnabled()) {
				return Promise.resolve(false);
			}

			return runWithLock('startup');
		}
	};
}
