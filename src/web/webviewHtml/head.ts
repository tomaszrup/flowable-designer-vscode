import { WEBVIEW_STYLES } from './styles';

interface WebviewHeadOptions {
	bpmnCssUri: string;
	cspSource: string;
	diagramCssUri: string;
	minimapCssUri: string;
	nonce: string;
}

export function getWebviewHeadHtml(options: WebviewHeadOptions): string {
	const { bpmnCssUri, cspSource, diagramCssUri, minimapCssUri, nonce } = options;

	return `<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'nonce-${nonce}'; font-src ${cspSource}; script-src 'nonce-${nonce}';" />
	<link rel="stylesheet" href="${diagramCssUri}" />
	<link rel="stylesheet" href="${bpmnCssUri}" />
	<link rel="stylesheet" href="${minimapCssUri}" />
	<title>Flowable BPMN Designer</title>
	<style nonce="${nonce}">
${WEBVIEW_STYLES}
	</style>
</head>`;
}