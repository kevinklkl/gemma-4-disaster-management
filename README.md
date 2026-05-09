# Bayanihan-AI

Offline disaster supply-demand matching using Gemma 4 via Ollama.

## Problem

During disasters, relief teams receive chaotic messages from donors and field workers. These messages contain critical information about available supplies and urgent survivor needs, but they are unstructured and difficult to process quickly.

## Solution

Bayanihan-AI uses Gemma 4 running locally through Ollama to extract structured supply and demand data from messy disaster messages. A deterministic Python matching engine then recommends which donations should be sent to which affected barangays.

## Core Features

- Local Gemma 4 inference through Ollama
- Supply/donation JSON extraction
- Demand/needs extraction
- Urgency classification
- Supply-demand matching
- Streamlit dashboard
- Offline-first disaster response workflow

## Setup

```bash
pip install -r requirements.txt
ollama pull gemma4
streamlit run app/streamlit_app.py
```

## Tech Stack
- Gemma 4
- Ollama
- Python
- Streamlit
- Pydantic
- Pandas

## Hackathon Track

Global Resilience + Ollama Special Technology Prize.
