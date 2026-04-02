# UI Builder AI Automation

AI-powered form generation engine that converts natural language prompts into fully functional, UI Builder-compatible form schemas. Connects to any MongoDB database, analyzes collection schemas in real time, and produces complete form configurations — ready to render in the UI Builder without manual setup.

## Features

- **Prompt-to-Form Generation** — Describe your form in plain English; the engine analyzes your database and generates a complete form configuration automatically
- **Dynamic Database & Collection Selection** — Browse all databases and collections from your MongoDB instance directly in the UI; no hardcoded sources
- **Real-Time Schema Analysis** — Inspects up to 250 documents per collection to infer field types, null ratios, cardinality, string lengths, and nested structures
- **Smart Component Mapping** — Data-driven selection of UI components: arrays → dropdowns/typeaheads, booleans → switches, dates → date pickers, long text → textareas, low-cardinality strings → enum dropdowns
- **Connector Generation** — Creates data-bound connectors with MongoDB aggregation pipelines for dropdown and typeahead fields, sourced from actual collection values
- **AI Component Upgrades** — Replace legacy components with modern AI-enhanced equivalents (smart input with auto-detection, autocomplete with predictions, natural language date picker, rich text editor, etc.)
- **Customizable Forms** — Delete unwanted fields, upgrade individual or all components, reorder and reposition on a free-position canvas
- **Publish to UI Builder** — One-click publish writes the form JSON directly into the `forms` collection in the exact format the UI Builder renderer expects (GrapeJS-compatible `formObjects`, `ruleData`, `styles`, `dataqueries`)
- **Live Connector Options** — Preview pulls real dropdown/typeahead options from MongoDB at runtime, not placeholders
- **Web UI & CLI** — Browser-based interface for interactive use; CLI for scripted/automated generation

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Server:** Express 4
- **Database:** MongoDB 6+ (via `mongodb` driver)
- **Frontend:** Vanilla HTML/CSS/JS (no build step)

## Project Structure

```
├── server.js                        # Express server + all API routes
├── main.js                          # Root launcher (proxy to src/main.js)
├── src/
│   ├── main.js                      # CLI entry point
│   ├── config/
│   │   └── defaults.js              # Environment config & defaults
│   ├── services/
│   │   ├── mongoService.js          # MongoDB connection (URI encoding)
│   │   ├── schemaAnalyzer.js        # Collection schema inference engine
│   │   ├── promptParser.js          # Natural language prompt parsing
│   │   ├── connectorGenerator.js    # Data-bound connector builder
│   │   ├── formGenerator.js         # Form JSON + component builder
│   │   ├── grapesFormGenerator.js   # GrapeJS-compatible form output
│   │   ├── formPublisher.js         # Publish to UI Builder forms collection
│   │   └── persistenceService.js    # Save forms & run logs to MongoDB
│   └── utils/
│       ├── typeMapper.js            # Field → component type mapping
│       └── id.js                    # UUID & slug generation
├── public/
│   ├── index.html                   # Web UI
│   ├── preview.html                 # Form renderer preview
│   ├── css/style.css                # Styles (canvas, components, AI)
│   └── js/app.js                    # Frontend logic
├── .env                             # Environment variables
└── package.json
```

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

Edit `.env` with your MongoDB connection:

```env
MONGODB_URI=mongodb://user:password@host:27017/
MONGODB_DB_NAME=dfe
MONGODB_COLLECTION=connectors
FORM_OUTPUT_COLLECTION=ui_builder_forms
RUN_OUTPUT_COLLECTION=ui_builder_form_runs
```

### 3. Start the server

```bash
npm run server
```

Open [http://localhost:3000](http://localhost:3000).

### 4. CLI (optional)

```bash
npm start
# or with a custom prompt:
node src/main.js --prompt "Create a form with title, url, verb, and module"
```

## Usage

1. **Select database & collection** — Use the dropdowns at the top to pick your MongoDB source
2. **Enter a prompt** — e.g. "Create a connector management form" or just "Create a form" (auto-detects all fields)
3. **Generate** — Click Generate; the engine analyzes the collection and builds the form
4. **Customize** — Delete unwanted fields (✕), upgrade to AI components (✨), drag to reposition
5. **Publish** — Click 🚀 Publish to write the form JSON into the `forms` collection for the UI Builder

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/databases` | List all databases on the MongoDB instance |
| `GET` | `/api/databases/:db/collections` | List collections in a database |
| `POST` | `/api/forms/generate` | Generate a form from prompt + selected DB/collection |
| `GET` | `/api/forms` | List all generated forms |
| `GET` | `/api/forms/:id` | Get form detail |
| `GET` | `/api/forms/:id/grapes` | Get GrapeJS-compatible form JSON |
| `GET` | `/api/forms/:id/connector-options/:connectorId` | Fetch live connector options from MongoDB |
| `POST` | `/api/forms/:id/publish` | Publish form to UI Builder `forms` collection |
| `DELETE` | `/api/forms/:id/components/:cmpId` | Delete a single component |
| `PUT` | `/api/forms/:id/customize` | Save customizations (deletions, upgrades, reorder) |
| `PUT` | `/api/forms/:id/positions` | Save field canvas positions |
| `DELETE` | `/api/forms/:id` | Delete a form |

## Published Form Format

When published, the form is written to the `forms` collection with:

- **`formObjects`** — Stringified GrapeJS project JSON (`pages[].frames[].component.components[]`)
- **`ruleData`** — Stringified rules array with visibility conditions and validation
- **`name`**, **`companyId`**, **`pageType`**, **`status`**, **`createdBy`**, **`createdAt`**
- **Data queries** — Written to the `dataqueries` collection for connector-backed fields

## Component Types

| Component | Used For |
|-----------|----------|
| `input` | Text, number, email, URL fields |
| `textarea` | Long text, descriptions, JSON bodies |
| `dropdownConnector` | Data-bound dropdowns (connector-backed) |
| `custom-dropdown` | Static enum dropdowns |
| `typeaheadComponent` | Searchable array/reference fields |
| `myDateTimeComponent` | Date and datetime fields |
| `switch-button` | Boolean toggles |
| `custom-checkbox` | Multi-select checkboxes |
| `custom-radio` | Single-select radio groups |
| `titleComponent` | Section headers |

### AI Component Upgrades

| Legacy Component | AI Replacement | Enhancement |
|---|---|---|
| `input` | AI Smart Input | Auto-detects email/URL/phone, inline validation |
| `custom-dropdown` | AI Smart Select | Fuzzy search, filter-as-you-type |
| `typeaheadComponent` | AI Autocomplete | Predictive suggestions, context-aware |
| `myDateTimeComponent` | AI Date Picker | Natural language dates ("next friday") |
| `switch-button` | AI Toggle | Animated toggle with transitions |
| `textarea` | AI Rich Text | Formatting toolbar, character count |

## License

**Source-Available — View Only**

This software is provided for viewing and evaluation purposes only. You may read and review the source code, but you may **not** use, copy, modify, merge, publish, distribute, sublicense, or sell copies of this software without prior written permission from the author(s).

See [LICENSE](LICENSE) for full terms.
