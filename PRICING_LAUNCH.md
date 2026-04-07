# WA Bulk AI — Launch: Free vs Pro & Trial

## Free vs Paid (feature matrix)

| Feature | Free | Pro |
|--------|------|-----|
| **Bulk send** | ✅ Daily cap (e.g. 50/day) | Unlimited |
| **Quick send (single)** | ✅ | ✅ |
| **Auto Reply** | Template-only (fixed replies) | Template + AI (Gemini/Claude), per-chat, chat history |
| **Scan replies** | ✅ Limited (e.g. 20/day) | Unlimited |
| **Drip campaigns** | ❌ | ✅ |
| **Schedule campaign** | ✅ 1–2 scheduled at a time | Unlimited |
| **Pipeline / CRM / segments** | Basic list only | Full pipeline, stages, Sheets import |
| **Analytics & Stats** | Basic (sent/failed counts) | Full + PDF report, digest |
| **Webhook** | ❌ | ✅ |
| **Privacy blur** | ✅ Manual toggle | ✅ + auto-on at start |
| **DNC list** | ✅ | ✅ |
| **Tasks, meetings, translate** | ✅ | ✅ |
| **Support** | Community | Priority |

**Recommendation:** Keep Free genuinely useful (contacts, quick send, template auto-reply, basic analytics, 1–2 scheduled) so users hit limits and want to upgrade. Gate the “power” features: AI auto-reply, drip, webhook, full CRM/pipeline, custom PDF reports.

---

## Trial period

- **Pro trial:** 14 days full Pro access (no card required if you want higher signup; with card = fewer churn).
- **Start:** First time user opens side panel or first use of a Pro feature → start 14-day trial and set `trialEnd = now + 14d`.
- **After trial:** Revert to Free limits; show “Upgrade to Pro” when they hit a Pro-only action.
- **One trial per install:** Store `trialUsed: true` so reinstalls don’t get another trial (or allow one trial per Chrome profile if you prefer).

Suggested storage (see below): `plan: 'free' | 'trial' | 'pro'`, `trialEnd: timestamp`, `trialUsed: boolean`.

---

## Implementation outline (extension)

### 1. Storage schema (`chrome.storage.local`)

```js
// License / plan state
license: {
  plan: 'free' | 'trial' | 'pro',   // 'trial' = within trial period
  trialEnd: 1234567890000,           // ms; only if plan was ever trial
  trialUsed: true,                   // so we don’t re-grant trial on reinstall
}
```

### 2. Helper: “can use Pro feature?”

- **Pro** → allow.
- **Trial** → allow if `Date.now() < trialEnd`; else set `plan = 'free'`, then deny.
- **Free** → deny (or start trial if !trialUsed and you want trial on first Pro action).

You can centralize this in background (e.g. `GET_LICENSE` message) and have sidepanel call it before starting campaign, enabling AI auto-reply, opening Drip, etc.

### 3. Where to enforce (entry points)

| Pro feature | Where to check |
|-------------|----------------|
| Unlimited bulk | Before `startCampaign()`: if free, enforce daily cap (e.g. 50); check `license.plan` and sent-today count. |
| AI Auto Reply | Before turning on Auto Reply with AI: require `plan === 'pro' \|\| (plan === 'trial' && now < trialEnd)`. |
| Drip campaigns | Before opening Drip tab / save sequence / enroll: require Pro or trial. |
| Schedule (unlimited) | Free: max 1–2 scheduled; Pro: unlimited (check in SCHEDULE_CAMPAIGN handler). |
| Webhook | Settings: disable or hide webhook URL save if not Pro/trial. |
| Pipeline / segments | Allow view for free; restrict “move stage”, “Sheets import”, “segment blast” to Pro/trial. |
| PDF report | “Generate report” button: require Pro or trial. |

### 4. Trial start

- Option A: Start trial on **first open** of side panel (once per install).
- Option B: Start trial on **first Pro action** (e.g. first time they enable AI auto-reply or add a drip step).

Set `plan = 'trial'`, `trialEnd = Date.now() + 14 * 24 * 60 * 60 * 1000`, `trialUsed = true`. Option B converts more “already engaged” users.

### 5. Paywall UI

- When user hits a Pro gate: toast or small modal “Pro feature — start 14-day trial” with link to your pricing/checkout page.
- In Settings or header: show “Free” / “Pro trial (X days left)” / “Pro” and link to upgrade.

---

## Summary

- **Free:** Daily send cap, template auto-reply, basic list, 1–2 scheduled, basic analytics, privacy, DNC.
- **Pro (paid or trial):** Unlimited bulk, AI auto-reply, drip, webhook, full CRM/pipeline, PDF reports, priority support.
- **Trial:** 14 days Pro, one per install (or per profile); start on first open or first Pro action.
- **Enforcement:** `license` in storage; helper `canUseProFeature()`; gate at each Pro entry point above.

No payment integration is described here (Stripe, Paddle, or Chrome Web Store); add that separately and set `plan: 'pro'` when payment succeeds.
