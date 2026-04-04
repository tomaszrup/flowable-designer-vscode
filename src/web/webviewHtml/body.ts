export const WEBVIEW_BODY_HTML = `<body>
	<div class="shell">
		<header class="toolbar" role="toolbar" aria-label="Editor toolbar">
			<div class="toolbar-left">
				<strong>Flowable BPMN Designer</strong>
				<button id="btn-undo" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>Undo</button>
				<button id="btn-redo" title="Redo (Ctrl+Y)" aria-label="Redo" disabled>Redo</button>
				<button id="btn-view-source" aria-label="View BPMN XML source">View Source</button>
			</div>
			<div class="toolbar-right">
				<span class="unsaved-dot" id="unsaved-dot" title="Unsaved changes" role="status" aria-label="Unsaved changes indicator"></span>
				<span id="status" role="status" aria-live="polite">Preparing diagram editor...</span>
			</div>
		</header>
		<div class="layout">
			<section class="canvas" role="application" aria-label="BPMN diagram canvas">
				<div id="canvas"></div>
			</section>
			<div class="resize-handle" id="resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0"></div>
			<aside class="sidebar" role="complementary" aria-label="Element properties">
				<div class="sidebar-header">
					<h2>Properties</h2>
				</div>
				<div class="sidebar-search">
					<input type="text" id="property-search" placeholder="Filter properties..." aria-label="Filter property groups" />
				</div>
				<div class="sidebar-body">
					<div class="card">
						<p id="issues" role="log" aria-live="polite">Waiting for BPMN XML...</p>
					</div>
					<div class="properties-panel">
						<div id="properties"></div>
					</div>
				</div>
			</aside>
		</div>
		<div class="toast-container" id="toast-container" role="alert" aria-live="assertive"></div>
	</div>`;