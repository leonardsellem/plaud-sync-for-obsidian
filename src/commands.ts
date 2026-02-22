export interface PlaudCommandHost {
	addCommand(command: {id: string; name: string; callback: () => void}): void;
	runPlaudSyncNow(): Promise<void>;
	validatePlaudToken(): Promise<void>;
}

export function registerPlaudCommands(plugin: PlaudCommandHost): void {
	plugin.addCommand({
		id: 'sync-now',
		name: 'Plaud: sync now',
		callback: () => {
			void plugin.runPlaudSyncNow();
		}
	});

	plugin.addCommand({
		id: 'validate-token',
		name: 'Plaud: validate token',
		callback: () => {
			void plugin.validatePlaudToken();
		}
	});
}
