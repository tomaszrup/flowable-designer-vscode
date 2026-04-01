# Flowable Designer VS Code

A VS Code custom editor for `.bpmn`, `.bpmn2`, and `.bpmn20.xml` files, built for compatibility with the legacy Eclipse Flowable Designer plugin. Open, edit, and save BPMN process definitions while preserving Flowable/Activiti extension attributes.

For the original Eclipse-based Flowable Designer project, see https://github.com/flowable/flowable-designer.

## Legal Notice

This project and its VS Code extension are independent community work. They are not affiliated with, endorsed by, or officially released by the Apache Software Foundation.

## Features

### Visual BPMN Editor

- Webview-backed diagram canvas powered by [bpmn-js](https://github.com/bpmn-io/bpmn-js)
- Theme-aware rendering that follows your VS Code color settings
- Create new diagrams from a Flowable-compatible BPMN template

### Supported BPMN Elements

- **Tasks** — User Task, Service Task, Script Task, Send Task, Receive Task, Manual Task, Business Rule Task, Call Activity
- **Events** — Start, Intermediate Catch/Throw, Boundary, End (timer, error, signal, message)
- **Gateways** — Exclusive, Inclusive, Parallel, Event-Based, Complex
- **Sub-Processes** — Embedded, Event, Transaction
- **Collaboration** — Pool (Participant), Lane
- **Connectors** — Sequence Flow (with condition expressions), Text Annotation

### Flowable / Activiti Property Editing

A context-sensitive properties panel exposes `activiti:*` attributes for each element type:

| Element | Properties |
|---|---|
| Process | `candidateStarterUsers`, `candidateStarterGroups`, target namespace, signal & message definitions, event listeners, localizations |
| User Task | `assignee`, `candidateUsers`, `candidateGroups`, `dueDate`, `priority`, `category`, `formKey`, task listeners, form properties |
| Service Task | `class`, `expression`, `delegateExpression`, `resultVariableName`, field extensions |
| Mail Task | `to`, `from`, `subject`, `cc`, `bcc`, `charset`, HTML/text content |
| Start Event | `initiator`, `formKey` |
| Call Activity | Input/output parameter mappings |
| Any Flow Node | `async`, `exclusive`, `skipExpression`, execution listeners, documentation |

Additional sidebar capabilities:

- **Multi-Instance** — sequential/parallel, loop cardinality, collection, element variable, completion condition
- **Form Properties** — types: `string`, `long`, `boolean`, `date`, `enum`; with required, readable, writable flags
- **Localizations** — per-element name and description in multiple locales

### Process Navigator

An activity-bar tree view shows the element hierarchy of the open diagram. It auto-refreshes on save and supports collapsible groups for processes, tasks, gateways, events, and sub-processes.

### Validation

Runs automatically on save (configurable) and reports issues in the VS Code Problems panel:

- XML structure and entity-expansion-attack prevention
- Missing start/end events, unreachable nodes
- Broken sequence-flow references
- Missing implementations on Service Tasks and Script Tasks
- Unassigned User Tasks

### SVG Image Export

- Export the current diagram as SVG via command or automatically on save
- Optional metadata overlay showing process key, namespace, filename, and export date with customizable colors

### XML Round-Trip Preservation

- All `xmlns` declarations and `activiti:*` attributes are preserved
- BPMN DI layout data round-trips without drift
- Unrecognized extension elements survive save cycles intact

## Commands

| Command | Description |
|---|---|
| **Flowable BPMN Designer: New BPMN Diagram** | Create a new empty BPMN diagram |
| **Flowable BPMN Designer: Export Diagram Image** | Export the open diagram as SVG |
| **Flowable BPMN Designer: Validate BPMN** | Validate the open BPMN file |

## Settings

| Setting | Default | Description |
|---|---|---|
| `flowableBpmnDesigner.imageExport.enabled` | `false` | Auto-export SVG on save |
| `flowableBpmnDesigner.imageExport.overlay.enabled` | `false` | Add metadata overlay to exported images |
| `flowableBpmnDesigner.imageExport.overlay.showProcessKey` | `true` | Include process key in overlay |
| `flowableBpmnDesigner.imageExport.overlay.showNamespace` | `true` | Include namespace in overlay |
| `flowableBpmnDesigner.imageExport.overlay.showFilename` | `true` | Include filename in overlay |
| `flowableBpmnDesigner.imageExport.overlay.showDate` | `true` | Include export date in overlay |
| `flowableBpmnDesigner.imageExport.overlay.color` | `#999999` | Overlay text color |
| `flowableBpmnDesigner.imageExport.overlay.backgroundColor` | `#ffffff` | Overlay background color |
| `flowableBpmnDesigner.validation.validateOnSave` | `true` | Validate on save |
| `flowableBpmnDesigner.editor.defaultLanguage` | `en` | Default localization language |
| `flowableBpmnDesigner.editor.availableLanguages` | `["en","de","fr","es","nl","pl"]` | Available localization languages |

## Development

```bash
npm install              # install dependencies
npm run compile-web      # build the extension and webview
npm test                 # run the web extension test suite
npm run run-in-browser   # launch in the browser-based VS Code host
npm run package:vsix     # produce a .vsix package
```

## License

See [LICENSE](LICENSE) for details.
