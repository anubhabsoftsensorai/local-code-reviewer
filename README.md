# GIT — Local Code Reviewer

> A privacy-first Chrome extension that runs static code analysis entirely in your browser. No cloud, no telemetry, no data ever leaves your machine.

---

## What it does

GIT injects a **Review** button into GitHub code views. Click it and the extension opens a side panel with a full analysis of the selected code — health score, metrics, and a list of violations with suggested fixes.

All analysis is performed locally using an AST engine built on Babel. Nothing is sent anywhere.

---

## Features

| Category | Checks |
|---|---|
| **Complexity** | Cyclomatic complexity, function length, deep nesting, too many parameters, file length |
| **Security** | `eval()`, `document.write()`, `innerHTML`/`outerHTML`, `dangerouslySetInnerHTML`, `setTimeout` with string, hardcoded credentials |
| **Maintainability** | Async functions missing try-catch, empty catch blocks, unhandled promise rejections, magic numbers |
| **Style** | `var` usage, loose equality (`==`), unused variables, `any` TypeScript type, TODO/FIXME comments |
| **Performance** | `console.*` left in production code |
| **Python** | `eval`/`exec`, `os.system`, `subprocess(shell=True)`, `pickle.load`, bare `except`, `global`, `print` debug calls |

---

## How to use it

### 1. Install the extension

> You need to load it manually — it's not on the Chrome Web Store.

1. Clone or download this repository
2. Run the build:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** using the toggle in the top-right corner
5. Click **Load unpacked**
6. Select the `dist/` folder inside the project

The extension icon will appear in your Chrome toolbar.

---

### 2. Open the side panel

Click the **GIT** icon in your Chrome toolbar. This opens the side panel — keep it docked while you browse GitHub.

Alternatively: right-click the icon → **Open side panel**.

---

### 3. Review code on GitHub

Navigate to any file or pull request on GitHub. You'll see two ways to trigger a review:

**Option A — Review a specific code block**

Hover over any code block on the page. A small **🔍 Review** button appears in the top-right corner of the block. Click it to analyze just that snippet.

**Option B — Review the whole file**

When viewing a file (e.g. `github.com/user/repo/blob/main/src/foo.ts`), a **🔍 Review File** button appears in the file action bar next to the Raw / Edit buttons. Click it to analyze the entire file at once.

---

### 4. Read the results

The side panel updates with:

- **Health Score** — 0–100 score with a ring indicator. Color indicates quality: green (>80), amber (50–80), red (<50).
- **Complexity** and **Security** metric cards.
- **Violations list** — filterable by All / Errors / Warnings.

Each violation card shows:
- The rule type and line number
- A plain-English description of the problem
- The relevant line of code
- **Details** — rule explanation
- **Patch Fix** — suggested fix

---

## Supported languages

| Language | Engine |
|---|---|
| JavaScript (`.js`, `.jsx`, `.mjs`) | Babel AST |
| TypeScript (`.ts`, `.tsx`) | Babel AST + TS plugin |
| Python (`.py`) | Regex-based line analysis |
| JSON (`.json`) | `JSON.parse` validation |

Language is detected automatically from the file extension and GitHub page URL. If detection fails it defaults to JavaScript.

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Commands

```bash
# Install dependencies
npm install

# Build for production (outputs to dist/)
npm run build

# Dev mode with hot reload (use with Chrome's "Load unpacked" → dist/)
npm run dev
```

After any code change in dev mode, go to `chrome://extensions/` and click the refresh icon on the extension card, then reload the GitHub tab.

---

## Project structure

```
src/
├── engine/
│   └── parser.ts        # Core analysis engine (Babel AST + Python regex)
├── ui/
│   ├── App.tsx          # Side panel React UI
│   └── index.css        # Styles
├── content/
│   └── index.ts         # Injects Review buttons into GitHub pages
└── background/          # Extension service worker / lifecycle
dist/                    # Built extension — load this folder in Chrome
```

---

## Scoring

The health score starts at 100 and deducts:

| Severity | Deduction |
|---|---|
| Error | −20 pts |
| Warning | −8 pts |
| Info | −2 pts |
| Security risk (multiplier) | −15 pts each |

Minimum score is 0.

---

## Privacy

- Zero network requests — the engine runs entirely in the browser
- No analytics, no tracking, no external services
- The only permissions used are `activeTab` (read page code), `sidePanel` (show the UI), and `storage` (pass code from page to panel)
