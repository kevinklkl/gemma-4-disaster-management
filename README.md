# Bayanihan-AI

Offline disaster supply-demand matching and relief logistics manager assistant using Gemma 4 via Ollama.

## Context

The Philippines is situated in one of the most disaster-prone regions of the world, constantly facing natural calamities. While systems and infrastructures are in place, the sheer frequency and severity of these disasters consistently overwhelm existing capacities, often simultaneously from multiple directions.

## Problem

1. **Warehouse Chaos**: Post-disaster relief warehouse management is chaotic due to the immense volume of goods that must be rapidly processed before distribution.
2. **Unpredictable Inflows**: Unlike a typical supply chain with predictable orders, disaster relief centers receive highly variable donations (in type and quantity) from the public, organizations, and other entities.
3. **Uneven Distribution**: Access issues and insufficient field reporting lead to uneven distribution. Remote areas are frequently neglected because operators struggle to establish reliable information exchange channels.
4. **Delayed Critical Reports**: Critical needs are often reported late—sometimes only after initial deliveries—as this is frequently the first point of contact between victims and operators.

## Stakeholders

1. **Disaster Victims**: Individuals affected by the natural disaster who are in urgent need of emergency relief goods.
2. **Relief Operators**: Local government unit (LGU) staff, active non-governmental organizations (NGOs), and community members responsible for organizing fundraisers, collecting donations, and managing the redistribution of relief goods.
3. **Volunteers**: Active community members mobilized to assist with ground operations, including warehouse management, repackaging, distribution, and delivery.

## Solution

Bayanihan-AI acts as a disaster relief logistics manager assistant, offering a three-pronged approach:

1. **Data Extraction**:
   Use Gemma to process all types of incoming donations. This includes processing text inputs, images of receipts or goods (via visual models if integrated), and audio (transcribing via models like Whisper, since during fast-paced situations users often prefer voice recordings) to extract actionable data.

2. **Data Management**:
   Employ Gemma for agentic data management. The system takes extracted data and automatically updates spreadsheets and databases tracking received goods and planned distributions. It factors in reported needs, automatically highlighting critical shortages for operators.

3. **Automated Communications**:
   Utilize Gemma for agentic communications. Relief centers are bombarded with messages asking where/how to donate and what is needed. Gemma analyzes these inbound messages and drafts appropriate, helpful replies, enabling the communications team to process inquiries and assist donors much faster.

## Technology Recommendations

Based on the project evolution, the current model setup works well as a foundation.
- **Core LLM**: Gemma 4 (via Ollama) is excellent for offline-capable, locally hosted inference for processing text extraction, data management logic, and drafting communications.
- **Audio Processing Addition**: Standard LLMs don't natively process audio offline. We recommend incorporating **OpenAI Whisper** (or a local equivalent like `whisper.cpp`) to handle the transcription of field audio reports. The transcribed text can then be seamlessly fed into Gemma for extraction.

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
- OpenAI Whisper (Recommended for Audio)

## Hackathon Track

Global Resilience + Ollama Special Technology Prize.
