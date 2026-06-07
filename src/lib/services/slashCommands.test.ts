import { describe, expect, it } from 'vitest';
import { getSlashCompletions, matchSlashCommand } from './slashCommands';

describe('slashCommands access filtering', () => {
	it('keeps Mallard Studio commands available for members', () => {
		expect(getSlashCompletions('/', true).map((cmd) => cmd.name)).toContain('/roast');
		expect(getSlashCompletions('/', true).map((cmd) => cmd.name)).toContain('/profit');
		expect(matchSlashCommand('/roast', true)?.name).toBe('/roast');
	});

	it('hides Mallard Studio commands from Parchment Intelligence-only users', () => {
		const commandNames = getSlashCompletions('/', false).map((cmd) => cmd.name);

		expect(commandNames).toContain('/beans');
		expect(commandNames).toContain('/find');
		expect(commandNames).not.toContain('/roast');
		expect(commandNames).not.toContain('/profit');
		expect(matchSlashCommand('/roast', false)).toBeNull();
	});
});
