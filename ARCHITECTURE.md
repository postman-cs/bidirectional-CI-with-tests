# Architecture & Workflow Documentation

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DEVELOPER WORKFLOW                                    │
│                                                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │   Edit      │────▶│   Commit    │────▶│    Push     │────▶│     PR      │           │
│  │  OpenAPI    │     │   Changes   │     │   to Git    │     │   Created   │           │
│  │    Spec     │     │             │     │             │     │             │           │
│  └─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘           │
│                                                                     │                   │
│  ┌──────────────────────────────────────────────────────────────────┘                   │
│  │                                                                                      │
│  ▼                                                                                      │
│  ┌─────────────────────────────────────────────────────────┐                            │
│  │              GITHUB ACTIONS TRIGGERED                    │                            │
│  │  (on: push[main], pull_request, workflow_dispatch)      │                            │
│  └─────────────────────────┬───────────────────────────────┘                            │
│                            │                                                            │
└────────────────────────────┼────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              CI/CD PIPELINE (GitHub Actions)                             │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                         JOB 1: GENERATE & UPLOAD                                 │    │
│  │                                                                                  │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐   │    │
│  │  │  Checkout   │───▶│  Install    │───▶│  Generate   │───▶│    Validate     │   │    │
│  │  │    Code     │    │    Deps     │    │ Collection  │    │   Collection    │   │    │
│  │  └─────────────┘    └─────────────┘    └──────┬──────┘    └────────┬────────┘   │    │
│  │                                               │                    │            │    │
│  │                                               ▼                    │            │    │
│  │                              ┌──────────────────────────────┐      │            │    │
│  │                              │  src/index.js                │      │            │    │
│  │                              │  ├── Parse OpenAPI spec      │      │            │    │
│  │                              │  ├── Extract endpoints       │      │            │    │
│  │                              │  ├── Generate test scripts   │      │            │    │
│  │                              │  └── Build collection JSON   │      │            │    │
│  │                              └──────────────┬───────────────┘      │            │    │
│  │                                             │                      │            │    │
│  │                                             ▼                      ▼            │    │
│  │                              ┌──────────────────────────────────────────┐      │    │
│  │                              │         OUTPUT: collection.json           │      │    │
│  │                              │  - 7 endpoints with contract tests        │      │    │
│  │                              │  - ~32 test assertions                    │      │    │
│  │                              │  - Pre-request scripts                    │      │    │
│  │                              └──────────────────┬───────────────────────┘      │    │
│  │                                                 │                              │    │
│  │                                                 ▼                              │    │
│  │                              ┌──────────────────────────────────────────┐      │    │
│  │                              │      src/api-uploader.js                 │      │    │
│  │                              │  ├── Check if collection exists          │      │    │
│  │                              │  ├── Clean for API format                │      │    │
│  │                              │  ├── POST (new) or PUT (update)          │      │    │
│  │                              │  └── Upload environment                  │      │    │
│  │                              └──────────────────┬───────────────────────┘      │    │
│  │                                                 │                              │    │
│  │                                                 ▼                              │    │
│  │                              ┌──────────────────────────────────────────┐      │    │
│  │                              │     POSTMAN API (api.getpostman.com)     │      │    │
│  │                              │  POST /collections?workspace={id}        │      │    │
│  │                              │  Headers: X-Api-Key: ***                 │      │    │
│  │                              │  Body: {collection: {...}}               │      │    │
│  │                              └──────────────────┬───────────────────────┘      │    │
│  │                                                 │                              │    │
│  └─────────────────────────────────────────────────┼──────────────────────────────┘    │
│                                                    │                                     │
│                                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                         JOB 2: RUN CONTRACT TESTS                                │    │
│  │                         (depends on job 1)                                       │    │
│  │                                                                                  │    │
│  │  ┌─────────────┐    ┌─────────────────────────────────────────┐    ┌──────────┐ │    │
│  │  │  Install    │───▶│  postman collection run {collection}    │───▶│  Report  │ │    │
│  │  │ Postman CLI │    │  --environment {environment}            │    │  Results │ │    │
│  │  └─────────────┘    │                                         │    └──────────┘ │    │
│  │                     │  Executes:                               │                 │    │
│  │                     │  - Status code validation                  │                 │    │
│  │                     │  - Response time checks                    │                 │    │
│  │                     │  - JSON schema validation                  │                 │    │
│  │                     │  - Required field checks                   │                 │    │
│  │                     │  - Content-Type validation                 │                 │    │
│  │                     └─────────────────────────────────────────┘                 │    │
│  │                                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
│                                                    │                                     │
│                                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                         JOB 3: DIFF REPORT (PR only)                             │    │
│  │                                                                                  │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────────┐  │    │
│  │  │  Generate   │    │  Generate   │    │  Compare & Comment on PR            │  │    │
│  │  │  from Base  │    │  from Head  │    │  - Endpoints added/removed          │  │    │
│  │  │   Branch    │    │   Branch    │    │  - Schema changes detected          │  │    │
│  │  └─────────────┘    └─────────────┘    └─────────────────────────────────────┘  │    │
│  │                                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              POSTMAN CLOUD (Workspace)                                   │
│                                                                                         │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐       │
│  │      COLLECTION: Task Management    │  │    ENVIRONMENT: Task Management     │       │
│  │             API                     │  │           Environment               │       │
│  │                                     │  │                                     │       │
│  │  📁 Tasks                           │  │  • baseUrl: https://api.example.com │       │
│  │    ├── GET  /tasks                  │  │  • auth_token: ***                  │       │
│  │    ├── POST /tasks                  │  │  • RESPONSE_TIME_THRESHOLD: 2000    │       │
│  │    ├── GET  /tasks/:taskId          │  │  • taskId: test-taskId-001          │       │
│  │    ├── PUT  /tasks/:taskId          │  │                                     │       │
│  │    ├── DEL  /tasks/:taskId          │  │  UID: 17929829-130a22e4-f222...     │       │
│  │    └── POST /tasks/:taskId/complete │  │                                     │       │
│  │                                     │  │                                     │       │
│  │  📁 System                          │  │                                     │       │
│  │    └── GET  /health                 │  │                                     │       │
│  │                                     │  │                                     │       │
│  │  UID: 17929829-be7ebff7-004e...     │  │                                     │       │
│  │                                     │  │                                     │       │
│  │  Each request has:                  │  │                                     │       │
│  │  • Pre-request script               │  │                                     │       │
│  │  • Test script (contract tests)     │  │                                     │       │
│  │  • Example responses                │  │                                     │       │
│  │                                     │  │                                     │       │
│  └─────────────────────────────────────┘  └─────────────────────────────────────┘       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Workflow Explanation

### Phase 1: Developer Makes Changes

#### Step 1: Edit OpenAPI Spec
```yaml
# specs/sample-api.yaml
paths:
  /tasks/{taskId}:
    get:
      summary: Get a specific task
      responses:
        '200':
          description: Task found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'
```

**What happens**: Developer modifies the API specification—adding endpoints, changing schemas, renaming paths, etc.

---

### Phase 2: Git Operations

#### Step 2: Commit Changes
```bash
git add specs/sample-api.yaml
git commit -m "Add new endpoint for task archiving"
git push origin feature/archive-endpoint
```

**What happens**: 
- Changes are committed to git history
- Push triggers webhook to GitHub

---

### Phase 3: GitHub Actions Triggered

#### Step 3: Workflow Initialization
```yaml
# .github/workflows/contract-tests.yml
on:
  push:
    branches: [main]
    paths:
      - 'specs/**'      # ← Triggered because spec changed
      - 'src/**'
```

**What happens**:
- GitHub detects push to `main` branch
- Path filter matches (`specs/**` changed)
- Workflow `contract-tests.yml` starts
- Runner (Ubuntu) is provisioned

---

### Phase 4: Job 1 - Generate & Upload

#### Step 4: Checkout & Setup
```yaml
steps:
  - uses: actions/checkout@v4    # Clone repo
  - uses: actions/setup-node@v4  # Setup Node.js 20
  - run: npm ci                  # Install dependencies
```

**Dependencies installed**:
- `@apidevtools/swagger-parser` - OpenAPI parsing
- `postman-collection` - Collection building
- `yaml` - YAML parsing

---

#### Step 5: Generate Collection
```bash
node src/index.js \
  --spec specs/sample-api.yaml \
  --output output/collection.json \
  --environment output/environment.json
```

**Internal flow**:

```
src/index.js
    │
    ├──▶ src/parser.js
    │       ├── Parse OpenAPI spec (YAML/JSON)
    │       ├── Dereference $refs
    │       └── Extract endpoints array
    │
    ├──▶ src/generator.js (for each endpoint)
    │       ├── Generate status code tests
    │       ├── Generate response time tests
    │       ├── Generate schema validation tests
    │       └── Generate required field tests
    │
    ├──▶ src/builder.js
    │       ├── Group by tags (folders)
    │       ├── Build request objects
    │       ├── Attach test scripts
    │       └── Create collection JSON
    │
    └──▶ Write files
            ├── output/collection.json
            └── output/environment.json
```

**Output example** (`output/collection.json`):
```json
{
  "info": { "name": "Task Management API", ... },
  "item": [
    {
      "name": "Tasks",
      "item": [
        {
          "name": "Get a specific task",
          "request": { "method": "GET", "url": "{{baseUrl}}/tasks/:taskId", ... },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  // ... more tests
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

#### Step 6: Validate Collection
```bash
# Check collection has requests
ITEM_COUNT=$(cat output/collection.json | jq '[.. | objects | select(.request?) | .name] | length')
# Must be > 0 or fail
```

**What happens**:
- Validates JSON is parseable
- Ensures at least one request exists
- Fails fast if generation broke

---

#### Step 7: Upload to Postman Cloud
```bash
node src/api-uploader.js upload output/collection.json
```

**Internal flow**:

```
src/api-uploader.js
    │
    ├──▶ List existing collections (GET /collections)
    │
    ├──▶ Check if collection exists by name
    │       ├── YES → Update (PUT /collections/{id})
    │       └── NO  → Create (POST /collections)
    │
    ├──▶ Clean collection for API
    │       ├── Remove internal SDK IDs
    │       ├── Simplify URL format
    │       └── Wrap in {collection: {...}}
    │
    └──▶ Upload with X-Api-Key header
```

**API Request**:
```http
POST https://api.getpostman.com/collections?workspace=06d2843a-af55-4443-a628-83a45a979403
X-Api-Key: [REDACTED - See .env or GitHub Secrets]
Content-Type: application/json

{
  "collection": {
    "info": { "name": "Task Management API", ... },
    "item": [...]
  }
}
```

**Response**:
```json
{
  "collection": {
    "id": "17929829-be7ebff7-004e-4119-a147-6366aff706ce",
    "uid": "17929829-be7ebff7-004e-4119-a147-6366aff706ce",
    "name": "Task Management API"
  }
}
```

---

#### Step 8: Upload Environment
```bash
node src/api-uploader.js upload-env output/environment.json
```

**Creates/updates environment in workspace**:
- `baseUrl`: API base URL
- `auth_token`: Authentication token
- `RESPONSE_TIME_THRESHOLD`: 2000ms
- `taskId`: Test task ID

---

### Phase 5: Job 2 - Run Contract Tests

#### Step 9: Install Postman CLI
```bash
curl -o- "https://dl-cli.pstmn.io/install/linux64.sh" | sh
```

**What happens**: Downloads and installs Postman CLI tool

---

#### Step 10: Execute Collection
```bash
postman collection run "Task Management API" \
  --environment "Task Management API Environment" \
  --reporters cli,junit \
  --reporter-junit-export test-results.xml
```

**What happens**:

```
Postman CLI
    │
    ├──▶ Fetch collection from Postman Cloud
    │       (by name "Task Management API")
    │
    ├──▶ Fetch environment
    │       (by name "Task Management API Environment")
    │
    ├──▶ Execute each request
    │       │
    │       ├── GET /tasks
    │       │   ├── Send request
    │       │   ├── Run pre-request script
    │       │   ├── Receive response
    │       │   └── Run test script:
    │       │       ├── ✅ Status code is 200
    │       │       ├── ✅ Response time < 2000ms
    │       │       ├── ✅ Content-Type is application/json
    │       │       ├── ✅ Response matches schema
    │       │       └── ✅ Response has required fields
    │       │
    │       ├── POST /tasks
    │       │   └── ... (same pattern)
    │       │
    │       └── ... (all 7 endpoints)
    │
    └──▶ Generate report
            ├── CLI output (human readable)
            └── test-results.xml (JUnit format)
```

**Example Output**:
```
→ Task Management API
  ├→ Tasks
  │  ├→ List all tasks [200 OK, 234ms]
  │  │  ✓ Status code is 200
  │  │  ✓ Response time is acceptable
  │  │  ✓ Content-Type is application/json
  │  │  ✓ Response matches schema
  │  │  ✓ Response has required fields
  │  │
  │  ├→ Create a new task [201 Created, 189ms]
  │  │  ✓ Status code is 201
  │  │  ✓ Response time is acceptable
  │  │  ...
```

---

#### Step 11: Report Results
```yaml
- uses: actions/upload-artifact@v4
  with:
    name: test-results-${{ github.run_id }}
    path: test-results.xml
```

**Also**: Comment on PR with results (if PR triggered)

---

### Phase 6: Job 3 - Diff Report (PR Only)

#### Step 12: Compare Spec Changes
```bash
# Generate from base branch
git checkout main
node src/index.js --spec specs/sample-api.yaml --output output/base-collection.json

# Generate from PR branch
git checkout feature-branch
node src/index.js --spec specs/sample-api.yaml --output output/pr-collection.json

# Compare
jq '[.. | objects | select(.request?) | .name]' output/base-collection.json
jq '[.. | objects | select(.request?) | .name]' output/pr-collection.json
```

**What happens**:
- Shows endpoints added/removed
- Comments on PR with diff report

**Example PR Comment**:
```markdown
## 📊 Spec Change Report

Comparing OpenAPI spec changes:

```
PR Branch: 8 endpoints
Base Branch: 7 endpoints

Summary:
- ✅ Added 1 new endpoint(s)
```

**What this means:**
- Adding endpoints → New tests will be auto-generated
- Removing endpoints → Tests are cleanly removed (no orphans)
- Modifying schemas → Contract tests update to match
```

---

## Complete Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Developer          GitHub              GitHub Actions        Postman Cloud  │
│  ─────────          ──────              ──────────────        ─────────────  │
│                                                                              │
│  Edit spec    ──▶   Push          ──▶   Trigger workflow  ──▶   (wait)      │
│     │               to main             (detect spec/**)                     │
│     │                                                                        │
│     │                                     Checkout code                      │
│     │                                       │                                │
│     │                                     npm ci                             │
│     │                                       │                                │
│     │                                     Generate collection                │
│     │                                       │                                │
│     │                                     ┌──────────────────┐               │
│     │                                     │  Parse OpenAPI   │               │
│     │                                     │  Extract 7       │               │
│     │                                     │  endpoints       │               │
│     │                                     └────────┬─────────┘               │
│     │                                              │                         │
│     │                                     ┌────────▼─────────┐               │
│     │                                     │ Generate tests   │               │
│     │                                     │ ~32 assertions   │               │
│     │                                     └────────┬─────────┘               │
│     │                                              │                         │
│     │                                     ┌────────▼─────────┐               │
│     │                                     │ Build collection │               │
│     │                                     │ v2.1 format      │               │
│     │                                     └────────┬─────────┘               │
│     │                                              │                         │
│     │                                     Upload to Postman ◀──────────────▶ │
│     │                                       │                    Update     │
│     │                                       │                    Collection │
│     │                                       ▼                                │
│     │                                     Run tests ◀──────────────────────▶ │
│     │                                       │                    Execute    │
│     │                                       ▼                    Tests      │
│     │                                     Report results                     │
│     │                                       │                                │
│     │                                       ▼                                │
│     │                                     PR comment (if applicable)         │
│     │                                                                        │
│     │◀────────────────────────────────────── Done!                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### 1. Why Spec-Derived Tests?

**Problem**: Traditional approach
```
1. Generate collection from spec
2. Developer manually writes tests on collection
3. Spec changes → Regenerate collection
4. Manual tests are LOST (or cause merge conflicts)
```

**Solution**: Spec-derived tests
```
1. Generate collection WITH tests from spec
2. Tests are deterministic function of spec
3. Spec changes → Regenerate collection WITH updated tests
4. No lost tests, no merge conflicts
```

### 2. Why Postman CLI over Newman?

| Aspect | Newman | Postman CLI |
|--------|--------|-------------|
| Status | ❌ Deprecated | ✅ Actively maintained |
| Cloud Integration | Limited | Native |
| Enterprise Support | Ending | Full support |
| CI/CD | Works | Optimized |

### 3. Why Two-Stage Upload?

**Stage 1**: Generate & Upload (Job 1)
- Separates generation from execution
- Allows manual inspection if needed
- Collection available in Postman app immediately

**Stage 2**: Run Tests (Job 2)
- Depends on successful upload
- Uses Postman Cloud as source of truth
- Enables running from anywhere

### 4. Why Gitignore Agent Files?

`CLAUDE.md`, `WARP.md`, `GEMINI.md`, `AGENTS.md`:
- Contain sensitive credentials (API keys)
- Contain internal project context
- Should not be exposed in public repos
- Symlinked for local AI assistant access

---

## Failure Scenarios & Recovery

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Invalid OpenAPI spec | Parser error | Fail fast with clear message |
| Postman API rate limit | HTTP 429 | Retry with backoff |
| Collection upload fails | API error | Job fails, check logs |
| Tests fail | Assertions fail | Report in PR, fix spec or API |
| Missing secrets | Env var undefined | Job fails, check secrets |

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Parse spec | ~500ms | Depends on spec complexity |
| Generate tests | ~200ms | Per endpoint |
| Build collection | ~100ms | |
| Upload to Postman | ~2-5s | Network dependent |
| Run tests | ~10-30s | Depends on API response times |
| **Total CI time** | **~30-60s** | |
