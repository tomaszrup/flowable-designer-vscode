import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const settingsFilePath = '.vscode/settings.json';

function workspacePath(rootPath: string, relativePath: string): string {
	return `${rootPath}/${relativePath}`;
}

export async function readWorkspaceFile(rootPath: string, relativePath: string): Promise<string> {
	return await readFile(workspacePath(rootPath, relativePath), 'utf8');
}

export async function writeWorkspaceSettings(
	rootPath: string,
	settings: Record<string, unknown>,
): Promise<() => Promise<void>> {
	const filePath = workspacePath(rootPath, settingsFilePath);
	let previousContent: string | null = null;
	try {
		previousContent = await readFile(filePath, 'utf8');
	} catch {
		previousContent = null;
	}

	await mkdir(workspacePath(rootPath, '.vscode'), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

	return async () => {
		if (previousContent === null) {
			await rm(filePath, { force: true });
			return;
		}
		await writeFile(filePath, previousContent, 'utf8');
	};
}
