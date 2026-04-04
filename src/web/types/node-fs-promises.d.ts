declare module 'node:fs/promises' {
	export function copyFile(source: string | URL, destination: string | URL): Promise<void>;
	export function mkdir(path: string | URL, options?: { recursive?: boolean }): Promise<string | undefined>;
	export function readdir(path: string | URL, options: { withFileTypes: true }): Promise<Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>>;
	export function readFile(path: string | URL, options?: { encoding?: BufferEncoding } | BufferEncoding): Promise<string>;
	export function rm(path: string | URL, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
	export function writeFile(path: string | URL, data: string, options?: { encoding?: BufferEncoding } | BufferEncoding): Promise<void>;
}
