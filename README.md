# UI Builder AI Automation POC

AI-powered form configuration generator that creates UI Builder-compatible form schemas from natural language prompts. Connects to MongoDB, analyzes collection schemas, and produces complete form configurations with components, connectors, validation rules, and field dependencies.

## Features

- **Natural Language Form Generation** — Describe your form in plain English and get a complete UI Builder configuration
- **MongoDB Schema Analysis** — Automatically inspects your collections to infer field types, validation rules, and sample values
- **Smart Connector Generation** — Creates MongoDB aggregation pipeline connectors for dropdown/typeahead fields (cast, director, genre, etc.)
- **Component Type Mapping** — Maps fields to appropriate UI components: input, textarea, dropdown, date picker, star rating, switch, typeahead
- **Free-Position Canvas** — Drag and drop form fields anywhere on the canvas; save positions to MongoDB
- **Web UI** — Browser-based interface to generate, view, reorder, and manage forms
- **CLI** — Command-line interface for scripted/automated form generation

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Server:** Express 4
- **Database:** MongoDB 6 (via `mongodb` driver)
- **Frontend:** Vanilla HTML/CSS/JS (no build step)

## Project Structure

```
├── server.js                  # Express web server + API routes
├── main.js                    # Root launcher (proxy to src/main.js)
├── src/
│   ├── main.js                # CLI entry point
│   ├── config/
│   │   └── defaults.js        # Environment config & defaults
│   ├── services/
│   │   ├── mongoService.js    # MongoDB connection (handles URI encoding)
│   │   ├── schemaAnalyzer.js  # Collection field type inference
│   │   ├── promptParser.js    # Natural language prompt parsing
│   │   ├── connectorGenerator.js  # Aggregation pipeline connectors
│   │   ├── formGenerator.js   # Form JSON + component builder
│   │   └── persistenceService.js  # Save forms & run logs to MongoDB
│   └── utils/
│       ├── typeMapper.js      # Field → component type mapping
│       └── id.js              # UUID & slug generation
├── public/
│   ├── index.html             # Web UI
│   ├── css/style.css          # Styles (canvas, drag-drop, tabs)
│   └── js/app.js              # Frontend logic (generate, view, drag)
├── .env.example               # Environment variable template
└── package.json
```

## Quick Start

### 1. Clone & install

```bash
git clone <your-repo-url>
cd ui-builder-ai-automation-poc
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your MongoDB connection details:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/
MONGODB_DB_NAME=appdb
MONGODB_COLLECTION=sample_mflix
FORM_OUTPUT_COLLECTION=ui_builder_forms
RUN_OUTPUT_COLLECTION=ui_builder_form_runs
FORM_PROMPT=Create a big movie form with title, director, cast, year and reviews
```

### 3. Run the CLI (one-shot generation)

```bash
npm start
```

Or with a custom prompt:

```bash
node src/main.js --prompt "Create a customer form with name, email, phone, and address"
```

### 4. Run the Web UI

```bash
npm run server
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Web UI Usage

1. **Generate** — Type a prompt (e.g. "Create a movie form with title, director, cast, year and reviews") and click Generate
2. **View** — Click the eye icon on any form card to open it
3. **Form Preview tab** — See rendered fillable fields on a free-position canvas
4. **Drag & Drop** — Grab the ⠿ handle and move any field anywhere on the canvas
5. **Save Layout** — Click 💾 to persist field positions to MongoDB
6. **Connectors tab** — View auto-generated MongoDB aggregation connectors
7. **Rules tab** — See validation rules and field dependencies
8. **JSON tab** — Raw form configuration JSON

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/forms` | List all generated forms |
| `GET` | `/api/forms/:id` | Get form detail |
| `POST` | `/api/forms/generate` | Generate a new form from prompt |
| `PUT` | `/api/forms/:id/positions` | Save field canvas positions |
| `PUT` | `/api/forms/:id/reorder` | Reorder components |
| `DELETE` | `/api/forms/:id` | Delete a form |

## Generated Form Schema

Each form saved to MongoDB includes:

- **formObjects** — Components array with type, attributes, style, position, connector bindings
- **connectors** — MongoDB aggregation pipelines for data-bound fields
- **rules** — Validation rules (required, numeric, pattern, min/max)
- **dependencies** — Field relationships (e.g. title change refreshes cast options)

## Component Types

| Component | Used For |
|-----------|----------|
| `myInputComponent` | Text, number, email, URL fields |
| `textarea` | Reviews, descriptions, summaries |
| `custom-dropdown` | Cast, director, genre, status (with connector) |
| `typeaheadComponent` | Searchable array fields |
| `myDateTimeComponent` | Date, datetime, release date fields |
| `switch-button` | Boolean toggles |
| `starRatingComponent` | Rating/score fields |
| `titleComponent` | Section headers |

## License

MIT
