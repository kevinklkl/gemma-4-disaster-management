import streamlit as st
import requests
import json
from datetime import datetime
import time

# --- STATE MANAGEMENT ---
def init_state():
    if "current_page" not in st.session_state:
        st.session_state.current_page = "role_picker"

    if "reports" not in st.session_state:
        # Populate with fictional sample data from design brief
        st.session_state.reports = [
            {
                "id": "rep_001",
                "created_at": "2026-05-09T14:30:00+08:00",
                "channel": "sms",
                "raw_text": "Naa mi sa Sitio Riverside, walay tubig 5 ka pamilya, naa baby",
                "source_contact": "0917-XXX-2341",
                "extracted": {
                    "location": "Sitio Riverside",
                    "household_count": 5,
                    "needs": ["water"],
                    "vulnerable_flags": ["infant"],
                    "urgency": "critical",
                    "summary_en": "5 households in Sitio Riverside need drinking water; infant present"
                },
                "status": "new",
                "history": [{"ts": "2026-05-09T14:30:00+08:00", "event": "received_via_sms"}]
            },
            {
                "id": "rep_002",
                "created_at": "2026-05-09T14:14:00+08:00",
                "channel": "sms",
                "raw_text": "Insulin po ng tatay ko ubos na, diabetic. 65 yrs old",
                "source_contact": "0918-XXX-5555",
                "extracted": {
                    "location": "Purok Sampaguita",
                    "household_count": 1,
                    "needs": ["medical"],
                    "vulnerable_flags": ["elderly", "medical"],
                    "urgency": "critical",
                    "summary_en": "Elderly (65yo) diabetic needs insulin in Purok Sampaguita"
                },
                "status": "new",
                "history": [{"ts": "2026-05-09T14:14:00+08:00", "event": "received_via_sms"}]
            },
            {
                "id": "rep_003",
                "created_at": "2026-05-09T14:26:00+08:00",
                "channel": "voice",
                "raw_text": "12 households roof na blew off, need tarpaulin",
                "source_label": "Sitio Bukid Leader",
                "extracted": {
                    "location": "Sitio Bukid",
                    "household_count": 12,
                    "needs": ["shelter materials"],
                    "vulnerable_flags": [],
                    "urgency": "high",
                    "summary_en": "12 households in Sitio Bukid lost roofs, need tarpaulins"
                },
                "status": "in_progress",
                "history": [
                    {"ts": "2026-05-09T14:26:00+08:00", "event": "received_via_voice"},
                    {"ts": "2026-05-09T14:28:00+08:00", "event": "status_changed_to_in_progress"}
                ]
            },
            {
                "id": "rep_004",
                "created_at": "2026-05-09T14:10:00+08:00",
                "channel": "sms",
                "raw_text": "Brgy hall need food packs purok mahogany about 30 family",
                "source_contact": "0920-XXX-1234",
                "extracted": {
                    "location": "Purok Mahogany",
                    "household_count": 30,
                    "needs": ["food"],
                    "vulnerable_flags": [],
                    "urgency": "medium",
                    "summary_en": "30 families in Purok Mahogany need food packs"
                },
                "status": "in_progress",
                "history": [{"ts": "2026-05-09T14:10:00+08:00", "event": "received_via_sms"}]
            }
        ]

    if "sms_last_checked" not in st.session_state:
        st.session_state.sms_last_checked = 0

    if "last_sms_received" not in st.session_state:
        st.session_state.last_sms_received = "Never"

    if "sms_today_count" not in st.session_state:
        st.session_state.sms_today_count = 0

def fetch_sms_inbox():
    # Only fetch every 5 seconds to avoid spamming
    now = time.time()
    if now - st.session_state.sms_last_checked < 5:
        return

    try:
        response = requests.get("http://localhost:8000/sms/inbox", timeout=2)
        if response.status_code == 200:
            data = response.json()
            messages = data.get("messages", [])
            st.session_state.sms_today_count = len(messages)
            if messages:
                st.session_state.last_sms_received = "Recently" # You could parse timestamps here

                # Check for new messages not in reports
                existing_sms_ids = [r.get("source_sms_id") for r in st.session_state.reports if "source_sms_id" in r]
                for msg in messages:
                    if msg["id"] not in existing_sms_ids:
                        # Append as a raw report, Gemma extraction would happen in a real pipeline
                        st.session_state.reports.insert(0, {
                            "id": f"sms_{msg['id']}",
                            "source_sms_id": msg["id"],
                            "created_at": msg.get("received_at", ""),
                            "channel": "sms",
                            "raw_text": msg.get("message", ""),
                            "source_contact": msg.get("sender", ""),
                            "extracted": {
                                "location": "Unknown",
                                "household_count": 0,
                                "needs": [],
                                "vulnerable_flags": [],
                                "urgency": "new",
                                "summary_en": "Pending extraction"
                            },
                            "status": "new",
                            "history": [{"ts": msg.get("received_at", ""), "event": "received_via_sms"}]
                        })

    except requests.exceptions.RequestException:
        pass # Silently fail if backend is down
    finally:
        st.session_state.sms_last_checked = now


# --- ROUTING ---
def navigate_to(page):
    st.session_state.current_page = page
    st.rerun()

def main():
    st.set_page_config(page_title="Bayanihan-AI", page_icon="🏛", layout="wide")
    init_state()
    fetch_sms_inbox()

    # Simple navigation header if not on role picker
    if st.session_state.current_page != "role_picker":
        cols = st.columns([8, 2])
        with cols[1]:
            if st.button("Change Role / Home"):
                navigate_to("role_picker")
        st.divider()

    # Routing logic
    if st.session_state.current_page == "role_picker":
        render_role_picker()
    elif st.session_state.current_page == "intake":
        render_intake()
    elif st.session_state.current_page == "operator":
        render_operator()
    elif st.session_state.current_page == "donor":
        render_donor()
    elif st.session_state.current_page == "admin":
        render_admin()

# --- SURFACES ---
def render_role_picker():
    st.markdown("""
    <div style="text-align: center; padding-bottom: 2rem;">
        <h1>Barangay San Roque Relief System</h1>
        <p style="font-size: 1.2rem; color: #666;">Local intake & coordination</p>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<h3 style='text-align: center;'>Who are you?</h3>", unsafe_allow_html=True)

    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("<div style='text-align: center;'>", unsafe_allow_html=True)
        if st.button("📝 Volunteer / Intake clerk →", use_container_width=True):
            navigate_to("intake")
        st.markdown("</div>", unsafe_allow_html=True)

    with col2:
        st.markdown("<div style='text-align: center;'>", unsafe_allow_html=True)
        if st.button("🎯 Operator / Coordinator →", use_container_width=True):
            navigate_to("operator")
        st.markdown("</div>", unsafe_allow_html=True)

    with col3:
        st.markdown("<div style='text-align: center;'>", unsafe_allow_html=True)
        if st.button("👁 External viewer →", use_container_width=True):
            navigate_to("donor")
        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div style='text-align: center; margin-top: 1rem;'>", unsafe_allow_html=True)
    if st.button("⚙️ System Admin (Pipeline Lead)", use_container_width=True):
        navigate_to("admin")
    st.markdown("</div>", unsafe_allow_html=True)

    st.divider()

    col1, col2 = st.columns(2)
    with col1:
        st.write("System status: 🟢 All systems normal")
    with col2:
        st.write(f"Last SMS received: {st.session_state.last_sms_received}")

def render_intake():
    st.markdown("## ← Brgy San Roque Intake")

    if "intake_mode" not in st.session_state:
        st.session_state.intake_mode = "selector"

    if "intake_status" in st.session_state and st.session_state.intake_status == "submitted":
        st.success("✓ Submitted\n\nGemma is processing. It'll appear in the Operator dashboard in a few seconds.")
        if st.button("Submit another"):
            st.session_state.intake_status = "pending"
            st.session_state.intake_mode = "selector"
            st.rerun()
        return

    if st.session_state.intake_mode == "selector":
        st.markdown("### How did this come in?")

        if st.button("⌨️ Type message\n\nWalk-in / Viber / Messenger relay", use_container_width=True):
            st.session_state.intake_mode = "text"
            st.rerun()

        if st.button("🎤 Voice note\n\nRecord or upload", use_container_width=True):
            st.session_state.intake_mode = "voice"
            st.rerun()

        if st.button("📷 Photo of note\n\nHandwritten list", use_container_width=True):
            st.session_state.intake_mode = "photo"
            st.rerun()

        st.divider()
        st.info(f"📨 SMS auto-intake\n\n✓ Active — {st.session_state.sms_today_count} today")

    elif st.session_state.intake_mode == "text":
        if st.button("← Back"):
            st.session_state.intake_mode = "selector"
            st.rerun()

        st.markdown("### Type message")
        message = st.text_area("Message *", help="Paste from Viber/Messenger or type what victim said. Bisaya / Tagalog / English OK", height=150)
        source = st.text_input("Source (optional)", help="e.g. Maria, kagawad, Viber")
        contact = st.text_input("Contact number (optional)", help="09XX-XXX-XXXX")

        if st.button("SUBMIT", use_container_width=True, type="primary"):
            if message:
                # Add to reports (mock submission)
                st.session_state.reports.insert(0, {
                    "id": f"rep_manual_{int(time.time())}",
                    "created_at": datetime.utcnow().isoformat() + "+08:00",
                    "channel": "manual_text",
                    "raw_text": message,
                    "source_label": source,
                    "source_contact": contact,
                    "extracted": {
                        "location": "Unknown",
                        "household_count": 0,
                        "needs": [],
                        "vulnerable_flags": [],
                        "urgency": "medium",
                        "summary_en": "Pending extraction (manual entry)"
                    },
                    "status": "new",
                    "history": [{"ts": datetime.utcnow().isoformat() + "+08:00", "event": "received_via_manual_text"}]
                })
                st.session_state.intake_status = "submitted"
                st.rerun()
            else:
                st.error("Message is required.")

    elif st.session_state.intake_mode == "voice":
        if st.button("← Back"):
            st.session_state.intake_mode = "selector"
            st.rerun()

        st.markdown("### Voice note")
        st.audio_input("Record voice note")
        st.file_uploader("or upload file:", type=["mp3", "wav", "m4a", "ogg"])
        source = st.text_input("Source (optional)")

        if st.button("SEND", use_container_width=True, type="primary"):
            st.session_state.intake_status = "submitted"
            st.rerun()

    elif st.session_state.intake_mode == "photo":
        if st.button("← Back"):
            st.session_state.intake_mode = "selector"
            st.rerun()

        st.markdown("### Photo of note")
        st.camera_input("Take photo")
        st.file_uploader("or choose from gallery", type=["jpg", "png", "jpeg"])
        notes = st.text_area("Notes (optional)")

        if st.button("SUBMIT", use_container_width=True, type="primary"):
            st.session_state.intake_status = "submitted"
            st.rerun()

def get_urgency_color(urgency):
    colors = {
        "critical": "🔴",
        "high": "🟠",
        "medium": "🟡",
        "low": "🟢",
        "info": "🔵"
    }
    return colors.get(str(urgency).lower(), "⚪")

def render_operator():
    st.markdown("## 🏛 Brgy. San Roque — Relief Operations")

    tab1, tab2, tab3, tab4 = st.tabs(["Live Feed", "Triage List", "Sitio Coverage", "Aggregated Needs"])

    with tab1:
        render_operator_overview()
    with tab2:
        render_operator_triage()
    with tab3:
        render_operator_coverage()
    with tab4:
        render_operator_aggregated()

def render_operator_overview():
    # Top metrics
    col1, col2, col3 = st.columns(3)
    reports = st.session_state.reports

    with col1:
        st.metric("Today", f"{len(reports)}", "+12 last hr")
    with col2:
        st.metric("Active sitios", "4 / 5", "⚠ Sitio Lapu silent")
    with col3:
        critical_count = sum(1 for r in reports if r.get("extracted", {}).get("urgency") == "critical")
        st.metric("Critical", f"{critical_count} 🔴", "needs response now")

    st.divider()

    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown("### Live feed")
        for report in reports[:5]: # Show top 5 recent
            urgency = report.get("extracted", {}).get("urgency", "new")
            color = get_urgency_color(urgency)

            with st.container():
                st.markdown(f"""
                <div style="padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px;">
                    <div>{color} <b>{report.get('extracted', {}).get('location', 'Unknown')}</b> • {report.get('channel')}</div>
                    <div style="color: #666; font-style: italic;">"{report.get('raw_text', '')[:100]}..."</div>
                    <div style="font-size: 0.9em; color: #888;">
                        Needs: {', '.join(report.get('extracted', {}).get('needs', []))} •
                        {report.get('extracted', {}).get('household_count', 0)} households
                    </div>
                </div>
                """, unsafe_allow_html=True)

    with col2:
        st.markdown("### Top needs")
        needs_count = {}
        for r in reports:
            for need in r.get("extracted", {}).get("needs", []):
                needs_count[need] = needs_count.get(need, 0) + 1

        for need, count in sorted(needs_count.items(), key=lambda x: x[1], reverse=True):
            st.markdown(f"**{need.title()}**")
            st.progress(min(count / 10.0, 1.0))
            st.caption(f"{count} reports")

        st.button("EXPORT for DONORS →", use_container_width=True)

def render_operator_triage():
    st.markdown("### Triage List")

    # Filter controls
    col1, col2, col3 = st.columns(3)
    with col1:
        st.selectbox("Status", ["All", "New", "In Progress", "Fulfilled"])
    with col2:
        st.selectbox("Sitio", ["All", "Sitio Riverside", "Purok Sampaguita", "Sitio Bukid", "Purok Mahogany"])
    with col3:
        st.selectbox("Urgency", ["All", "Critical", "High", "Medium", "Low"])

    st.divider()

    # Custom table rendering for better formatting
    html_table = """
    <table style="width:100%; border-collapse: collapse; text-align: left;">
        <tr style="border-bottom: 1px solid #ddd;">
            <th style="padding: 8px;">Urg</th>
            <th style="padding: 8px;">Sitio</th>
            <th style="padding: 8px;">Primary Need</th>
            <th style="padding: 8px;">HHs</th>
            <th style="padding: 8px;">Status</th>
        </tr>
    """

    for report in st.session_state.reports:
        extracted = report.get("extracted", {})
        urgency = extracted.get("urgency", "new")
        color = get_urgency_color(urgency)
        needs = extracted.get("needs", ["Unknown"])
        primary_need = needs[0] if needs else "Unknown"
        status_icon = "⚪" if report.get("status") == "new" else ("🟣" if report.get("status") == "in_progress" else "✅")

        html_table += f"""
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px;">{color}</td>
            <td style="padding: 8px;">{extracted.get('location', 'Unknown')}</td>
            <td style="padding: 8px;">{primary_need.title()}</td>
            <td style="padding: 8px;">{extracted.get('household_count', 0)}</td>
            <td style="padding: 8px;">{status_icon} {report.get('status', 'new').replace('_', ' ').title()}</td>
        </tr>
        """

    html_table += "</table>"
    st.markdown(html_table, unsafe_allow_html=True)

def render_operator_coverage():
    st.markdown("### Sitio Coverage")
    st.write("🟢 = reporting actively 🟡 = quiet 1hr+ 🔴 = silent / unreached")

    coverage_data = [
        {"sitio": "Sitio Riverside", "reports": 47, "status": "🟢", "desc": "Active reporting"},
        {"sitio": "P. Sampaguita", "reports": 32, "status": "🟢", "desc": "Active reporting"},
        {"sitio": "Sitio Bukid", "reports": 21, "status": "🟢", "desc": "Active reporting"},
        {"sitio": "Purok Mahogany", "reports": 14, "status": "🟡", "desc": "Quiet"},
        {"sitio": "Sitio Lapu", "reports": 0, "status": "🔴", "desc": "SILENT — send a runner"}
    ]

    for item in coverage_data:
        st.markdown(f"{item['status']} **{item['sitio']}** — {item['reports']} reports ({item['desc']})")

    st.error("⚠ Sitio Lapu has not reported. Last known contact: pre-disaster. This is one of the most isolated sitios. Recommend dispatch.")

def render_operator_aggregated():
    st.markdown("### Aggregated Needs")
    st.write("Total households reporting: 127 • Estimated people: 540")

    st.markdown("#### ┌─ Survival ─────────────────────")
    st.markdown("💧 Drinking water — 47 households 🔴")
    st.markdown("🍱 Family food packs — 62 households 🟠")
    st.markdown("🏠 Tarpaulins / shelter — 18 households 🟠")

    st.markdown("#### ┌─ Vulnerable populations ───────")
    st.markdown("👶 Households with infants: 11 (formula, diapers)")
    st.markdown("👴 Households with elderly: 23 (medication concerns)")
    st.markdown("💊 Specific medication needs: 8 (insulin, hypertension)")

    st.markdown("#### ┌─ Material needs ───────────────")
    st.markdown("🧼 Hygiene kits: 7 households")
    st.markdown("👕 Clothing: 6 households")
    st.markdown("🔦 Light / power: 12 households")

    if st.button("EXPORT for DONORS →"):
        st.info("Modal will open here for Export format selection")

def render_donor():
    st.markdown("## 🏛 Brgy. San Roque, Cebu City")
    st.markdown("### 🌪 Typhoon relief operations")
    st.caption(f"Last updated: {st.session_state.last_sms_received}")

    st.divider()

    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("<div style='text-align: center;'><h2>127</h2>households<br>affected</div>", unsafe_allow_html=True)
    with col2:
        st.markdown("<div style='text-align: center;'><h2>~540</h2>people<br>affected</div>", unsafe_allow_html=True)
    with col3:
        st.markdown("<div style='text-align: center;'><h2>4/5</h2>sitios<br>reporting</div>", unsafe_allow_html=True)

    st.divider()

    col_left, col_right = st.columns(2)

    with col_left:
        st.markdown("### 🔴 Critical needs")
        st.markdown("──────────────────────────")
        st.markdown("💧 Drinking water: **47 households**")
        st.markdown("🍱 Family food packs: **62 households**")
        st.markdown("🏠 Tarpaulins / shelter: **18 households**")

        st.markdown("<br>", unsafe_allow_html=True)

        st.markdown("### 📦 Other material needs")
        st.markdown("──────────────────────────")
        st.markdown("🧼 Hygiene kits: **7 hh**")
        st.markdown("👕 Clothing: **6 hh**")
        st.markdown("🔦 Light / power: **12 hh**")

    with col_right:
        st.markdown("### 👥 Vulnerable populations")
        st.markdown("──────────────────────────")
        st.markdown("👶 **11** households with infants")
        st.markdown("👴 **23** households with elderly")
        st.markdown("💊 **8** households need specific medication")

        st.markdown("<br><br>", unsafe_allow_html=True)
        st.markdown("──────────────────────────")
        st.markdown("### 📞 Coordinate with:")
        st.markdown("**Brgy. Captain** — +63 917 XXX XXXX")
        st.markdown("Brgy. Hall, San Roque, Cebu City")

        if st.button("📋 Copy summary for sharing"):
            st.success("Copied to clipboard!")

    st.divider()
    st.caption("Powered by local Gemma 4. Data stays in barangay.")

def render_admin():
    st.markdown("## System Status")

    st.markdown("### Subsystem Health")
    st.write("🟢 **Gemma 4 E4B** — Loaded — avg 3.2s/extract")
    st.write("🟢 **SMS Forwarder phone** — Connected — last 2m ago")
    st.write(f"🟢 **SQLite database** — OK — {len(st.session_state.reports)} records")
    st.write("🟢 **Web server** — Running on :8000")

    st.divider()

    st.markdown("### Queue Stats")
    st.write("**Queue depth:** 0 messages waiting")
    st.write(f"**Processed today:** {len(st.session_state.reports)}")
    st.write("**Failed extractions:** 2 (manual review needed)")

    st.divider()

    col1, col2 = st.columns(2)
    with col1:
        st.button("View extraction log", use_container_width=True)
    with col2:
        st.button("View recent SMS log", use_container_width=True)

if __name__ == "__main__":
    main()
