# AI Research Assistant

> [!NOTE]
> The AI Research frontend screens are not currently exposed in the main UI. This page is retained as product reference for the capability, but the steps below are not available from the current frontend navigation.

The AI Research Assistant helps you answer legal questions quickly by searching your firm's law library and generating answers with citations to the specific documents and articles it used. It does not guess — every answer is grounded in your library's content.

---

## How It Works

When you ask a question, the assistant searches your firm's law library for relevant legislation, rulings, and principles, then composes a response that cites the exact sources it relied on. You can click any citation to open the original document.

> [!NOTE]
> The AI can only answer questions about legislation and rulings that are already in your firm's library. If you need answers about a law that is not yet in the library, ask your administrator to upload it first (Library → Admin → Upload Document). See [Law Library](./12-law-library.md) for details.

---

## Starting a New Research Session

1. Click **Research** in the left sidebar.
2. Click **New Session**.
3. Optionally, select a case from the **Link to Case** dropdown. Linking a session to a case keeps all related research visible in that case's **Research** tab.
4. Type your first question in the text box.
5. Press **Send** or click the send button.

The assistant's response will appear in the conversation panel. Responses stream in real time — you can start reading before the full answer is complete.

---

## Asking Questions

- Type your question in Arabic or English. Both languages are fully supported.
- Press **Enter** or click **Send** to submit.
- You can ask follow-up questions in the same session. The assistant remembers the context of the current conversation.
- Keep questions specific for best results. For example: "What is the limitation period for commercial contract claims under Egyptian law?" will produce a more precise answer than "Tell me about contracts."

---

## Reading Citations

After each answer, a row of citation chips appears beneath the response. Each chip shows the title of the library document the AI drew from.

1. Click a citation chip to open the source document in the Law Library viewer.
2. The document opens at the relevant article or passage.
3. Use this to verify the answer and read the full legal text in context.

> [!WARNING]
> Always verify AI responses against the authoritative source text before using them in court filings or formal legal advice. The assistant is a research aid, not a substitute for professional legal judgment.

---

## Continuing a Past Session

All your research sessions are saved automatically.

1. Click **Research** in the left sidebar.
2. The **Sessions** panel on the left lists your past sessions by date and title.
3. Click any session to reopen it and continue the conversation where you left off.

Sessions linked to a case are also accessible from the case's **Research** tab.

---

## Monitoring Usage

Your firm has a monthly usage limit for AI Research queries (the default is 500 queries per month).

1. Click **Research** in the sidebar.
2. Click **Usage** at the top of the Research area.
3. The usage panel shows how many queries have been used this month and how many remain.

The limit resets at the start of each calendar month. If your firm regularly reaches the limit, contact your firm administrator to request an increase from your ELMS provider.

> [!NOTE]
> If the monthly limit is reached, the Research feature will display a "Usage limit reached" message. You cannot submit new queries until the limit resets or your administrator arranges an increase.

---

## Linking Research to a Case

Keeping research sessions linked to cases makes it easier for your whole team to find supporting legal references.

- **When creating a session**: select the case from the **Link to Case** dropdown before sending your first message.
- **From an existing case**: open the case → **Research** tab → **New Session** — the case is linked automatically.
- Sessions linked to a case appear in the case's **Research** tab for all team members assigned to the case.

---

## Privacy

Your research questions and your firm's library content are never shared with other firms. Anthropic (the provider of the underlying AI) receives only the text of your query and the relevant library excerpts needed to generate the answer — no other firm data is included.

---

## Related Topics

- [Law Library](./12-law-library.md) — managing the source material the AI uses
- [FAQ — AI Research](../troubleshooting/24-faq.md#ai-research)

## Source of truth

- `docs/_inventory/source-of-truth.md`

