# Project akbay: Architecture & Feedback

## Feedback on the "Needs-Centric Focus" Operational Plan

Your refined operational plan is **excellent** and significantly stronger than the previous iteration. Dropping the infrastructural tracking (road conditions, bridge collapses) in favor of a strictly "Needs-Centric Focus" is the right move for several reasons:

1. **Scope and Feasibility:** Extracting complex geographical and infrastructural data accurately from chaotic text is incredibly hard and prone to hallucination. Focusing purely on "What do people have?" (Supply) and "What do people need?" (Demand) creates a bounded, highly achievable problem for an LLM like Gemma 4.
2. **Immediate Impact:** In the initial 48 hours of a disaster, logistics are the primary bottleneck. By matching private donations to specific community needs, you solve a real, urgent problem. It stops the delivery of "useless" items and ensures life-saving goods get where they need to go.
3. **Perfect Alignment with the Hackathon Tracks:**
   - **Global Resilience:** You are directly building an edge-based disaster response tool. By ensuring this works offline (using local Gemma models), you address the "low connectivity/destroyed infrastructure" constraint perfectly.
   - **Ollama Special Tech Prize:** The entire premise relies on reliable, offline, local inference of Gemma 4. It's a perfect showcase for Ollama.

### Suggestions for Making It Stand Out

To really impress the judges, consider these technical and narrative additions:

- **JSON Schema Strictness (Pydantic/Instructor):** Emphasize how you prevent Gemma from hallucinating keys. Don't just prompt for JSON; use strict Pydantic models (or tools like `instructor` / `outlines`) to guarantee the JSON schema is valid every time. This demonstrates "agentic reliability."
- **Fuzzy Matching for the Engine:** Your matching engine shouldn't just look for exact string matches. If Demand says "Pediatric Paracetamol" and Supply says "Children's Tylenol" or "Paracetamol 100mg/ml," the engine needs to know they are a match. You can either use a lightweight embedding model (also via Ollama) or prompt Gemma to score the match.
- **The "Edge" Narrative:** In your video and documentation, aggressively highlight the offline nature. Show a computer running the app with Wi-Fi turned off. That visual is incredibly powerful for the "Global Resilience" track.
- **Multilingual/Code-switching Support:** The Philippines is highly multilingual. Highlighting that Gemma can understand Tagalog, Cebuano, or Taglish (as seen in your example: "may 500 canned goods kami dito sa Cebu port...") is a massive selling point for the "Digital Equity & Inclusivity" aspect, even if you are aiming for Global Resilience.

---

## High-Level Technical Architecture

### 1. Data Flow

```mermaid
graph TD
    A[Raw SMS / Radio Transcripts] --> B{Gemma 4 (via Ollama)}

    B -->|Supply Prompt| C[Structured Supply JSON]
    B -->|Demand Prompt| D[Structured Demand JSON]

    C --> E(Matching Engine)
    D --> E

    E -->|Cross-referencing| F[Matched Logistics Plan]
    F --> G[Streamlit Dashboard]
```

### 2. Component Breakdown

**The Edge Device (Local Machine / Server)**
*   **Ollama:** The inference engine. Runs `gemma4` completely offline.
*   **Python Backend:**
    *   **Parsers (`engine/parser.py`):** Wraps the Ollama client. Uses specific prompts (`prompts/supply_prompt.py`, `prompts/demand_prompt.py`) to instruct Gemma to extract entities (Items, Quantities, Locations, Urgency).
    *   **Validator (`engine/validator.py`):** Uses Pydantic to ensure the JSON returned by Gemma is structurally sound and ready for the database.
    *   **Matcher (`engine/matcher.py`):** A deterministic Python engine (potentially augmented by Gemma for semantic similarity) that cross-references the validated Supply JSON against the Demand JSON to create "Matches".
*   **Frontend UI (`app/streamlit_app.py`):** A Streamlit dashboard.
    *   **View 1:** Ingestion (Paste raw text, see it turn into JSON).
    *   **View 2:** Inventory (The current state of Supply).
    *   **View 3:** Needs (The prioritized list of Demand).
    *   **View 4:** Dispatch (The matched recommendations).

### 3. Key Data Structures (Pydantic Models)

**Supply Schema**
```python
class SupplyItem(BaseModel):
    item: str
    quantity: int
    unit: str

class DonationOffer(BaseModel):
    donor_entity: str
    location: str
    items_offered: List[SupplyItem]
    contact: str
```

**Demand Schema**
```python
class NeedItem(BaseModel):
    item: str
    urgency_level: int # 1 (Critical) to 3 (Low)
    justification: str

class FieldReport(BaseModel):
    location: str
    needs: List[NeedItem]
    vulnerable_demographics_noted: str
```
