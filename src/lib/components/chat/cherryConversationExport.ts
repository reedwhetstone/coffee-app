interface ConversationExportPart {
	type: string;
	text?: string;
}

interface ConversationExportMessage {
	role: string;
	parts: ConversationExportPart[];
}

export function buildCherryConversationExport(
	messages: ConversationExportMessage[],
	exportedAt: Date,
	agentName: CherryAgentName
): string {
	let markdown = `# ${agentName} conversation export\n\n`;
	markdown += `**Exported:** ${exportedAt.toLocaleString()}\n\n---\n\n`;

	for (const message of messages) {
		const role = message.role === 'user' ? 'User' : agentName;
		markdown += `## ${role}\n\n`;

		for (const part of message.parts) {
			if (part.type === 'text') markdown += `${part.text}\n\n`;
		}
		markdown += '---\n\n';
	}

	return markdown;
}

export function cherryConversationExportFilename(exportedAt: Date): string {
	return `cherry-conversation-${exportedAt.toISOString().split('T')[0]}.md`;
}
import type { CherryAgentName } from '$lib/cherry/identity';
