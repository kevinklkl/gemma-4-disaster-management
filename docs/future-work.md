# Future Work: Dashboard, Inbox, and Backend Improvements

This document captures what was changed in the dashboard overhaul, what design decisions were deferred, and how the next phases of work connect to what's already in place.

---

## What Changed (Dashboard Overhaul)

### Before

The dashboard showed **one card per incoming message** — each SMS or walk-in report became its own dispatch card with an auto-generated ID like "ORD-123". Cards were ordered by database insertion time (`ORDER BY id DESC`). Dispatchers saw individual family requests and packed items per-message.

### After

The dashboard now **aggregates by location**. Multiple messages from the same place merge into a single card showing the combined needs for that area. Operators see "Brgy San Jose needs 35kg rice total" rather than three separate family cards.

### Key design decisions in the current implementation

| Decision | What we did | Why | What it means for future work |
|----------|-------------|-----|-------------------------------|
| **Aggregation key** | `formatLocation()` string output | Simple and deterministic — same formatted string = same card | Location normalization (see below) will improve grouping accuracy |
| **Unknown locations** | Each gets its own card, never merged | Merging all unknowns would hide distinct requests | If we add location editing, these could be reassigned to real locations |
| **Packing model** | Aggregate-level UI with FIFO distribution to per-message `packing_state` | Preserves packing across page reloads using existing backend | Backend could own this distribution instead of the frontend |
| **Dispatch remainders** | Ephemeral — lives in React state only, lost on reload | Avoids backend changes for now | Needs persistence (see Phase 2 below) |
| **Sorting** | Client-side: urgency → age → item count | Dataset is small (active non-fulfilled orders) | Could move to backend SQL if scale demands it |
| **Sidebar** | Grand total across all locations (same as before) | Complements per-location cards with a global demand view | No changes needed |

### Files involved

| File | Role |
|------|------|
| `frontend/src/types.ts` | Shared types: `ApiMessage`, `LocationCard`, `AggregatedItem`, `ItemSource` |
| `frontend/src/components/LocationCard.tsx` | Card component: header, progress bar, items, snippet, dispatch button |
| `frontend/src/pages/Dashboard.tsx` | Aggregation logic (`aggregateByLocation`), sorting (`sortCards`), FIFO packing distribution (`distributePacked`), dispatch flow |
| `app/api.py` | **Unchanged.** `GET /api/messages` already returns all needed fields. `PATCH .../packing` and `PATCH .../status` work as before. |

### How FIFO packing distribution works

When a dispatcher sets "Rice" to 15kg packed on a location card that aggregates rice from 3 messages (msg1: 10kg, msg2: 20kg, msg5: 5kg):

1. Sort sources by message ID (oldest first): msg1, msg2, msg5
2. Fill msg1 up to its capacity: 10kg → `PATCH /api/messages/1/packing {itemIndex: 0, packedQty: 10}`
3. Fill msg2 with remaining 5kg → `PATCH /api/messages/2/packing {itemIndex: 0, packedQty: 5}`
4. msg5 gets 0 (nothing left to distribute)

This means packing state survives page reloads — it's reconstructed from individual message `packingState` when the API is refetched.

### How dispatch works currently

1. Dispatcher clicks "Dispatch Partial" or "Ready for Dispatch" on a location card.
2. **All contributing messages** are marked as `fulfilled` via `PATCH /api/messages/{id}/status`.
3. If unpacked items remain, an **ephemeral remainder card** is created in React state with `isSplitRemainder: true` and no backing message IDs.
4. The remainder card is **lost on page reload** — this is the main gap that Phase 2 addresses.

---

## Phase 1: Inbox Improvements

**Goal:** Connect the Inbox page to the dashboard so operators can drill into per-message detail.

### What needs to change

The Inbox (`frontend/src/pages/Inbox.tsx`) currently shows individual messages with their processing status but has no awareness of the dashboard's location-based grouping or packing progress.

#### 1.1 Show location grouping context

Each message in the Inbox should show which location card it belongs to on the dashboard. This is a display-only change — use `formatLocation()` from `types.ts` to compute the location and display it as a tag or grouping header in the Inbox list.

#### 1.2 Show per-message packing status

The `packingState` field is already returned by the API. The Inbox should display, for each message:
- Which items have been packed (and how many)
- Overall completion percentage for that specific message
- Whether the message has been fulfilled

This lets operators verify that the aggregate packing on the dashboard correctly reflects individual message states.

#### 1.3 Cross-reference IDs

The dashboard cards show contributing message IDs as muted `#1, #2, #5` text. The Inbox should make these linkable or at minimum searchable, so operators can find the specific messages behind a location card.

#### 1.4 Shared types

The `types.ts` file already exports `ApiMessage` and related types. The Inbox currently defines its own inline types (`ExtractedItem`, `ExtractedData`, etc.) — these should be replaced with imports from `types.ts` to keep the codebase consistent.

### Files to modify

| File | Changes |
|------|---------|
| `frontend/src/pages/Inbox.tsx` | Import shared types, add packing status display, add location grouping context |
| `frontend/src/types.ts` | May need minor additions if Inbox needs types not yet exported |

---

## Phase 2: Persistent Dispatch Tracking (Backend)

**Goal:** Make partial dispatch state survive page reloads.

### The problem

Currently, when a dispatcher does a partial dispatch:
1. All contributing messages are marked `fulfilled` (removed from future API queries)
2. The unpacked remainder exists only in React state
3. On page reload, the remainder disappears — those needs are effectively lost

### Proposed solution: dispatch records

Add a `dispatches` table to SQLite that records what was actually sent:

```sql
CREATE TABLE dispatches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    location        TEXT NOT NULL,
    dispatched_at   TEXT NOT NULL,
    items           TEXT NOT NULL,  -- JSON: [{canonical, name, unit, qty_dispatched}]
    message_ids     TEXT NOT NULL,  -- JSON: [msg_id, ...] contributing messages
    notes           TEXT
);
```

#### Revised dispatch flow

1. Dispatcher clicks "Dispatch Partial" on location card.
2. Frontend sends `POST /api/dispatches` with the packed items and contributing message IDs.
3. Backend creates the dispatch record.
4. For each contributing message:
   - If all its items are fully covered by dispatches → mark as `fulfilled`
   - Otherwise → **update `extracted_data` item quantities** to reflect only the remaining need, and reset `packing_state` to 0 for dispatched items
5. Frontend refetches `/api/messages` — the remaining needs reappear in the aggregated view.

This requires a new endpoint: `PATCH /api/messages/{id}/extracted_data` or a more structured approach to modifying the extracted items.

#### Alternative: dispatched_qty per item

Instead of a separate table, add a `dispatched_qty` field to each item in `extracted_data`:

```json
{
  "items": [
    { "name": "Rice", "canonical": "rice", "qty": 20, "unit": "kg", "dispatched_qty": 10 }
  ]
}
```

The dashboard would then show `needed - dispatched_qty` as the remaining need. Simpler than a separate table but mixes mutable dispatch state with the original extraction output.

### Files to modify

| File | Changes |
|------|---------|
| `app/api.py` | New `dispatches` table, `POST /api/dispatches` endpoint, updated dispatch logic in message status updates |
| `frontend/src/pages/Dashboard.tsx` | Replace ephemeral remainder logic with API-backed dispatch flow |
| `frontend/src/types.ts` | Add dispatch-related types |

---

## Phase 3: Location Normalization

**Goal:** Improve location grouping accuracy so "Brgy San Jose", "Barangay San Jose, Tacloban", and "San Jose Tacloban" merge into one card.

### The problem

Location strings come from Gemma extraction and can vary:
- "Brgy San Jose" vs "Barangay San Jose" (abbreviation)
- "San Jose, Tacloban" vs "San Jose Tacloban" (comma variance)
- "Brgy 7" vs "Barangay 7, San Jose" (different granularity)

Currently, each unique `formatLocation()` string creates a separate card.

### Possible approaches

#### 3.1 Structured location extraction

Update the Gemma extraction prompt to always output structured locations:

```json
{ "location": { "barangay": "San Jose", "city": "Tacloban", "province": "Leyte" } }
```

The `ApiLocation` type already supports this shape. `formatLocation()` already handles it. The issue is that Gemma sometimes returns a plain string instead.

**Changes:** Update `prompts/extraction_prompt.py` to enforce structured output. Update `engine/extraction/validator.py` to normalize location objects.

#### 3.2 Fuzzy matching on the frontend

Normalize location strings before using them as grouping keys:
- Lowercase, strip punctuation
- Expand "brgy" → "barangay"
- Use edit distance or token overlap to merge similar locations

**Trade-off:** Risks false merges (e.g., "Brgy 1" and "Brgy 11").

#### 3.3 Location lookup table

Maintain a reference table of known barangays/cities. Map extracted locations to canonical entries. Most reliable but requires maintaining the table.

### Recommendation

Start with **3.1** (structured extraction) since the type system already supports it. Add **3.3** (lookup table) for the specific disaster response area if the coverage map is known. Avoid 3.2 unless the other approaches prove insufficient.

### Files to modify

| File | Changes |
|------|---------|
| `prompts/extraction_prompt.py` | Enforce structured location output in prompt |
| `engine/extraction/validator.py` | Normalize location objects, expand abbreviations |
| `frontend/src/pages/Dashboard.tsx` | Update `formatLocation()` if normalization happens frontend-side |

---

## Phase 4: Dashboard Enhancements (Lower Priority)

These are smaller improvements that build on the current foundation.

### 4.1 Location editing on dashboard cards

Allow operators to manually correct or assign a location to an "Unknown" card. This would update the `extracted_data.location` in the backend and cause the card to merge with an existing location group on next refresh.

**Requires:** `PATCH /api/messages/{id}/extracted_data` endpoint.

### 4.2 Urgency override

Let operators manually escalate or de-escalate urgency for a location card. Currently urgency is derived from the highest-urgency contributing message — an override would need to be stored separately (not in `extracted_data`, which is the AI's output).

### 4.3 Historical dispatch view

Show a log of past dispatches (from Phase 2's `dispatches` table) so operators can see what was already sent to each location and when.

### 4.4 Server-side sorting

If the number of active orders grows large (100+), move sorting to the SQL query:

```sql
ORDER BY 
  CASE json_extract(extracted_data, '$.urgency')
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 ELSE 4 
  END,
  received_at ASC
```

### 4.5 Print Fulfillment Picklist

The button exists in the sidebar but is non-functional. Implement it to generate a printable summary of aggregated needs grouped by location, suitable for warehouse pickers.

---

## Data Model Reference

### Current database schema (`messages` table)

```
id                  INTEGER PRIMARY KEY AUTOINCREMENT
sender              TEXT
message             TEXT            -- raw message content
received_at         TEXT            -- ISO 8601
source              TEXT            -- "sms_forwarder", "manual", "synthetic"
raw_payload         TEXT            -- JSON of original request
status              TEXT            -- "needs_processing" | "processing" | "processed" | "fulfilled" | "failed"
extracted_data      TEXT            -- JSON: {location, urgency, persons, items[]}
message_type        TEXT            -- "sms" | "walkin" | "manual"
packing_state       TEXT            -- JSON: {itemIndex: packedQty, ...}
processing_started_at TEXT
processing_duration_ms INTEGER
```

### Current API endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/messages` | All non-fulfilled messages (dashboard + inbox data source) |
| POST | `/api/messages` | Create manual message |
| PATCH | `/api/messages/{id}/status` | Update message status |
| PATCH | `/api/messages/{id}/packing` | Update item packing qty (broadcasts via WebSocket) |
| POST | `/api/seed-inbox` | Load synthetic test data |
| WebSocket | `/ws` | Real-time events: `processing_started`, `processing_done`, `packing_update` |

### Planned new endpoints (Phase 2+)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/dispatches` | Record a dispatch (items sent to a location) |
| GET | `/api/dispatches` | List past dispatches (for history view) |
| PATCH | `/api/messages/{id}/extracted_data` | Modify extracted data (location correction, qty adjustment after partial dispatch) |
