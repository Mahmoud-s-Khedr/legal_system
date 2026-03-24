# Hearings and Calendar

Court hearings (called "sessions" in ELMS) are scheduled within case records. ELMS tracks the date, assigned lawyer, outcome, and any follow-up sessions, and sends automatic reminders so nothing is missed.

---

## Scheduling a Hearing

Hearings are always scheduled from within a case record, and linked to a specific court stage.

1. In the sidebar, click **Cases** and open the relevant case.
2. Click the **Sessions** tab.
3. Click **New Session**.
4. Fill in the session details:
   - **Court Stage**: Select which court stage this session belongs to (for example, Ibtidaei — First Circuit).
   - **Date and Time**: Enter the scheduled date and time of the hearing.
   - **Assigned Lawyer**: Select the team member who will attend. The list shows all lawyers assigned to this case.
   - **Notes** (optional): Add any preparation notes or background for this session.
5. Click **Save**.

The session now appears in the **Sessions** tab of the case, and in the dashboard calendar view.

> [!NOTE]
> You must first add a court stage to the case before scheduling a session. If the **Court Stage** dropdown is empty, go to the **Courts** tab and add a court stage first. See [Managing Cases — Court Assignment](./06-managing-cases.md#court-assignment--managing-court-stages).

---

## Recording a Session Outcome

After a court hearing, update the session record with the outcome. This keeps the case history accurate and triggers the scheduling of any follow-up session.

1. Open the case record and click the **Sessions** tab.
2. Click on the session you attended.
3. Click **Edit** (or **Record Outcome**).
4. Select the **Outcome** from the dropdown:

| Outcome | Meaning |
|---|---|
| **POSTPONED** | The hearing was postponed to a future date |
| **DECIDED** | A final decision was issued |
| **PARTIAL_RULING** | A partial or interlocutory ruling was issued |
| **ADJOURNED** | The session was adjourned without a substantive step |
| **EVIDENCE** | The court ordered an evidence submission step |
| **EXPERT** | The court referred the matter to an expert |
| **MEDIATION** | The court referred the parties to mediation |
| **PLEADING** | The session was for oral pleadings |
| **CANCELLED** | The session did not take place |

5. Add any **Outcome Notes** describing what happened in court.
6. Click **Save**.

---

## Scheduling the Next Session After a Postponement

When the outcome is **POSTPONED**, ELMS prompts you to enter the next hearing date immediately so that the follow-up session is created and reminders are set.

1. After selecting **POSTPONED** as the outcome, a **Next Session Date** field appears.
2. Enter the date and time of the next hearing.
3. Click **Save**.

ELMS automatically creates a new session entry for the next date and schedules reminders for it.

---

## Automatic Reminders

ELMS sends reminders for upcoming hearings automatically. No manual setup is needed — reminders are sent based on the session date you entered.

**Reminder schedule:**

| When Sent | Description |
|---|---|
| **7 days before** | One week's advance notice |
| **1 day before** | Day-before reminder |
| **On the day** | Morning reminder on the day of the hearing |

Reminders are delivered through whichever notification channels are enabled in the current frontend UI, such as the in-app bell and desktop OS notifications on the desktop app. To configure your visible channels, see [Notifications](./11-notifications.md).

---

## Viewing Upcoming Hearings

You can see upcoming hearings in two places:

- **Dashboard**: The **Upcoming Sessions** widget on your dashboard shows the next several hearings assigned to you or your firm, sorted by date.
- **Calendar view**: Click **Calendar** in the sidebar to see a full monthly or weekly calendar of all upcoming sessions. In Arabic (RTL) mode, the calendar layout flows right-to-left.

---

## Related Pages

- [Managing Cases](./06-managing-cases.md) — setting up court stages before scheduling sessions
- [Tasks and Deadlines](./08-tasks-and-deadlines.md) — creating preparation tasks linked to a case
- [Notifications](./11-notifications.md) — configuring how and where hearing reminders are delivered
