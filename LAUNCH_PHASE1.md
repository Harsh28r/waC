# Phase 1 Launch — 7 Features to Verify Before Store

Use this checklist to confirm these features work end-to-end. **Launch with these first;** test bulk/drip/auto-reply/analytics later.

---

## 1. Pin chats

| Where | What to do |
|-------|------------|
| **Sidepanel → Contacts** | Top section: **Quick Pin**. Enter name (optional), country, 10-digit number → **Pin**. Up to 6 pins. |
| **Chips** | Pinned numbers appear as chips below. Click a chip → opens that WhatsApp chat in the WA Web tab. |
| **WA Web** | Ensure WhatsApp Web is open in a tab; extension will focus that tab and open the chat by number. |

**Verify:** Pin 1–2 numbers → click chip → correct chat opens.

---

## 2. Blur (privacy)

| Where | What to do |
|-------|------------|
| **Sidepanel header** | Click the **👁️** button (right side). Toggle ON = blur mode. |
| **WA Web** | Chat list and message content get blurred. **Hover** over a row or message to reveal it. |
| **Settings** | **Auto Privacy on Start** — when enabled, blur turns on automatically when you start a campaign (for later use). |

**Verify:** Turn blur ON → go to WA Web → list and messages are blurred; hover reveals.

---

## 3. Quick meeting scheduler

| Where | What to do |
|-------|------------|
| **WA Web (content)** | Open any **chat** (not just the start screen). In the **chat header** (top bar of the open conversation) you’ll see a small **📅 calendar icon** — “Schedule Meeting”. |
| **Modal** | Click it → form: Contact name, Title, Date & time, Platform (Meet/Zoom/Teams/Other), Meeting link (optional), “Remind me X min before”. Click **Send to Chat** → message is sent into the chat and the meeting is saved. |
| **Notification** | At the chosen “X min before” time you get a **Chrome notification** and (if WA tab is open) a reminder message can be sent to the chat. |

**Verify:** Open a chat → click calendar icon → fill form → Send to Chat. Check that (1) message appears in chat, (2) notification appears at reminder time (use 1 min for quick test).

---

## 4. Language translator (in chat)

| Where | What to do |
|-------|------------|
| **WA Web (content)** | In an **incoming message bubble** (left side), a small **globe icon** (Translate) appears. |
| **Click** | Click it → that message is translated to English and shown inline below the bubble. Button shows a check when done. |

**Verify:** Receive or have a non-English message in a chat → click translate on the bubble → English text appears.

---

## 5. Chat with saved number + Quick send

| Where | What to do |
|-------|------------|
| **Sidepanel → Sender** | **Quick WA Sender**: pick country, enter 10-digit number, type message → **⚡ Send Now**. Opens that chat in WA Web and sends the message. |
| **Same tab** | **Template Library**: save a template (name + message). Later, use it from the list or from WA Web’s quick-reply strip. |
| **WA Web (content)** | In the **chat header** there’s a **⚡ bolt icon** — “Quick Reply Templates”. Click → strip of saved templates; click one to paste into the input (then you send). |

**Verify:** Sender tab: enter number + message → Send Now → WA Web opens correct chat and message is sent. Then open a chat in WA Web → click bolt → pick a template → message appears in input.

---

## 6. Quick reply (from sidepanel)

| Where | What to do |
|-------|------------|
| **Sidepanel → Replies** | After someone replies, you can **Scan replies** (or they appear if you use scan). Each reply shows contact and message. **Send Reply** opens that chat and sends your reply. |
| **Templates** | Use templates from Sender tab for consistent quick replies. |

**Verify:** Have at least one reply (or run a small campaign and get a reply). In Replies tab, click **Send Reply** for that entry → chat opens and reply is sent.

---

## 7. Tasks with notify

| Where | What to do |
|-------|------------|
| **Sidepanel → Tasks** | **+ Add task** → Title, optional description, **Date** (Today / Tomorrow / custom), **Time** (optional — for reminder). **Save task**. |
| **Notification** | At the set **time**, you get a **Chrome browser notification** (allow notifications if prompted). Tasks tab shows Today / Tomorrow / Later / Done. |

**Verify:** Add a task with reminder time 1–2 minutes from now → Save → wait → Chrome notification appears. Check **Tasks** tab: task appears under the right filter (Today/Tomorrow).

---

## UI overview (where everything lives)

| Feature        | Sidepanel tab / area     | WA Web (content)                    |
|----------------|---------------------------|-------------------------------------|
| Pin chats      | Contacts → Quick Pin      | —                                   |
| Blur           | Header 👁️                 | Blurred list/chat until hover       |
| Meeting        | —                         | Chat header → 📅 icon               |
| Translator     | —                         | Incoming bubble → 🌐 icon           |
| Quick send     | Sender → Quick WA Sender   | —                                   |
| Quick reply    | Sender → Template Library  | Chat header → ⚡ strip               |
| Tasks + notify | Tasks                     | —                                   |

---

## Suggested tab order for Phase 1

Tabs are reordered so the 7 features are easy to find:

1. **Contacts** — pins at top  
2. **Sender** — quick send + templates  
3. **Tasks** — tasks with notifications  
4. **Settings** — privacy toggle, DNC, etc.  
5. Then: Pipeline, Compose, Drip, Auto Reply, Replies, Stats, Dashboard, Report  

---

## Store listing (Phase 1)

- **Screenshots:** Sidepanel (Contacts with pins, Sender, Tasks), WA Web with meeting bar + translate on a bubble, blur ON.
- **Short description:** Pin important chats, blur for privacy, schedule meetings from the chat bar, translate messages to English, quick send to any number, quick-reply templates, tasks with reminders.
- **Other features** (bulk campaigns, drip, AI auto-reply, analytics, webhook) — mention as “and more” or add in a later update after you’ve tested them.

---

## Quick test run (15 min)

1. Load extension; open WhatsApp Web in a tab; open sidepanel.  
2. **Pin:** Add 1 pin → click chip → chat opens.  
3. **Blur:** Click 👁️ → confirm blur on WA Web; hover to reveal.  
4. **Meeting:** In WA Web chat, click 📅 → create meeting 1 min from now → wait for notification.  
5. **Translate:** In a chat with non-English message, click 🌐 on bubble → see translation.  
6. **Quick send:** Sender tab → number + message → Send Now → confirm in WA Web.  
7. **Quick reply:** In WA Web chat, click ⚡ → choose template → confirm in input.  
8. **Task:** Tasks tab → Add task, time in 2 min → Save → wait for notification.

If all 8 steps pass, Phase 1 is good to launch.

---

## Enabling Phase 2 (show all features)

When you’re ready to release bulk campaigns, Drip, Auto Reply, etc.:

1. Open **sidepanel/sidepanel.js**.
2. Change **line 5** from `const PHASE1_ONLY = true;` to `const PHASE1_ONLY = false;`.
3. Reload the extension. Users will see all tabs (Pipeline, Compose, Drip, Auto Reply, Replies, Stats, Dashboard, Report) and the campaign controls.
