import { BASE_STYLES } from './base';
import { ADVANCED_EDITOR_STYLES } from './editor';
import { PROPERTY_INTERACTION_STYLES } from './interactions';
import { PROPERTY_PANEL_STYLES } from './panel';

export const WEBVIEW_STYLES = [
	BASE_STYLES,
	PROPERTY_PANEL_STYLES,
	PROPERTY_INTERACTION_STYLES,
	ADVANCED_EDITOR_STYLES,
].join('\n\n');