import * as vscode from 'vscode';

export interface ImageOverlayConfig {
	enabled: boolean;
	showProcessKey: boolean;
	showNamespace: boolean;
	showFilename: boolean;
	showDate: boolean;
	color: string;
	backgroundColor: string;
}

export function getImageExportConfig(): { enabled: boolean; format: string; overlay: ImageOverlayConfig } {
	const config = vscode.workspace.getConfiguration('flowableBpmnDesigner.imageExport');
	return {
		enabled: config.get<boolean>('enabled', false),
		format: config.get<string>('format', 'svg'),
		overlay: {
			enabled: config.get<boolean>('overlay.enabled', false),
			showProcessKey: config.get<boolean>('overlay.showProcessKey', true),
			showNamespace: config.get<boolean>('overlay.showNamespace', true),
			showFilename: config.get<boolean>('overlay.showFilename', true),
			showDate: config.get<boolean>('overlay.showDate', true),
			color: config.get<string>('overlay.color', '#999999'),
			backgroundColor: config.get<string>('overlay.backgroundColor', '#ffffff'),
		},
	};
}

function escapeXml(str: string, quoteDouble: boolean): string {
	let escaped = '';
	for (const char of str) {
		if (char === '&') {
			escaped += '&amp;';
			continue;
		}
		if (char === '<') {
			escaped += '&lt;';
			continue;
		}
		if (char === '>') {
			escaped += '&gt;';
			continue;
		}
		if (quoteDouble && char === '"') {
			escaped += '&quot;';
			continue;
		}
		escaped += char;
	}
	return escaped;
}

function escapeAttr(str: string): string {
	return escapeXml(str, true);
}

function escapeXmlText(str: string): string {
	return escapeXml(str, false);
}

export function addOverlayToSvg(svg: string, overlay: ImageOverlayConfig, processKey: string, targetNamespace: string, filename: string): string {
	if (!overlay.enabled) {
		return svg;
	}

	const lines: string[] = [];
	if (overlay.showProcessKey && processKey) { lines.push(`Key: ${processKey}`); }
	if (overlay.showNamespace && targetNamespace) { lines.push(`NS: ${targetNamespace}`); }
	if (overlay.showFilename && filename) { lines.push(`File: ${filename}`); }
	if (overlay.showDate) { lines.push(`Date: ${new Date().toISOString().split('T')[0]}`); }
	if (lines.length === 0) { return svg; }

	const lineHeight = 16;
	const padding = 8;
	const textWidth = Math.max(...lines.map((line) => line.length * 7)) + padding * 2;
	const textHeight = lines.length * lineHeight + padding * 2;
	const overlayGroup = `<g transform="translate(10, 10)">
<rect width="${textWidth}" height="${textHeight}" fill="${escapeAttr(overlay.backgroundColor)}" stroke="${escapeAttr(overlay.color)}" stroke-width="0.5" rx="3" opacity="0.9"/>
${lines.map((line, index) => `<text x="${padding}" y="${padding + (index + 1) * lineHeight - 3}" font-family="Arial, sans-serif" font-size="11" fill="${escapeAttr(overlay.color)}">${escapeXmlText(line)}</text>`).join('\n')}
</g>`;

	return svg.replace(/<\/svg>\s*$/, `${overlayGroup}\n</svg>`);
}