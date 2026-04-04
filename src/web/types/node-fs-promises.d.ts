declare module 'node:fs/promises' {
	export function copyFile(source: string | URL, destination: string | URL): Promise<void>;
	export function mkdir(path: string | URL, options?: { recursive?: boolean }): Promise<string | undefined>;
	export function readdir(path: string | URL, options: { withFileTypes: true }): Promise<Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>>;
	export function rm(path: string | URL, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
}