import type { FlowableDocumentState } from '../flowable/types';

export interface BpmnValidationIssue {
	elementId: string;
	message: string;
	severity: 'error' | 'warning';
}

export type HostToWebviewMessage =
	| { type: 'load-document'; xml: string; flowableState: FlowableDocumentState; minimapEnabled: boolean }
	| { type: 'request-svg' }
	| { type: 'request-validation' }
	| { type: 'file-picked'; path: string }
	| { type: 'source-visible'; visible: boolean };

export type WebviewToHostMessage =
	| { type: 'ready' }
	| { type: 'save-document'; xml: string; flowableState: FlowableDocumentState }
	| { type: 'run-validation'; xml: string; flowableState: FlowableDocumentState }
	| { type: 'show-error'; message: string }
	| { type: 'open-source' }
	| { type: 'svg-export'; svg: string }
	| { type: 'validation-result'; issues: BpmnValidationIssue[] }
	| { type: 'pick-file' }
	| { type: 'open-file'; path: string };
