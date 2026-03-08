# WA Bulk AI — Feature Audit

Quick audit of extension code paths. **Verdict: most features are wired and working.** A few minor fixes recommended before store launch.

---

## ✅ Working (message flow verified)

| Feature | Background | Content | Sidepanel |
|--------|------------|---------|-----------|
| **Bulk campaign** | `runCampaign` → sendWhatsAppMessage, buildMessage, DNC, analytics, webhook | TYPE_AND_SEND, SEND_WITH_IMAGE | START_CAMPAIGN, progress listener |
| **Quick send** | quickSend → sendWhatsAppMessage, DNC check | TYPE_AND_SEND | QUICK_SEND with phone/message |
| **Auto Reply** | GET_AI_AUTO_REPLY (Gemini + Claude), chatHistory | START_AUTO_REPLY, checkAndReply, per-chat poll, typeAndSend, AUTO_REPLY_LOG | Config + toggle, AUTO_REPLY_LOG listener |
| **Scan replies** | scanReplies → open each chat, READ_LAST_MESSAGE, generateAIReply, classifyReply, DNC/opt-out, webhook | READ_LAST_MESSAGE | SCAN_REPLIES, reply list |
| **Send reply / Open quoted** | sendReplyToContact (QUOTED_REPLY), openChatQuoted (OPEN_CHAT_QUOTED) | QUOTED_REPLY, OPEN_CHAT_QUOTED | SEND_REPLY, OPEN_CHAT_QUOTED |
| **Drip campaigns** | save/delete/enroll/unenroll, executeDripStep on alarm, sendWhatsAppMessage | — | GET_DRIP, SAVE_DRIP_SEQ, ENROLL_DRIP, etc. |
| **Analytics** | getAnalytics, clearAnalytics, updateAnalytics (campaigns, webhook) | — | GET_ANALYTICS, CLEAR_ANALYTICS |
| **DNC** | get/add/remove/clear DNC | — | GET_DNC, ADD_DNC, REMOVE_DNC, CLEAR_DNC |
| **Schedule campaign** | scheduleCampaign → alarm → runCampaign | — | SCHEDULE_CAMPAIGN |
| **Privacy blur** | — | SET_PRIVACY → setWAPrivacy, scanAndBlur | Toggle, chrome.tabs.sendMessage SET_PRIVACY |
| **Open chat / by name** | openChat (URL), openChatByName (content) | OPEN_CHAT_BY_NAME | Pins, OPEN_CHAT, OPEN_CHAT_BY_NAME |
| **Settings** | — | — | Saved to storage, applied on load (e.g. Auto Reply tab reloads settings) |
| **Webhook, tasks, meetings, translate, transcribe** | Handlers present | TYPE_AND_SEND, etc. | UI triggers |

---

## ⚠️ Minor issues / recommendations

1. **Claude model ID inconsistency**  
   - `getAIAutoReply` uses `claude-3-5-haiku-20241022` (known to work).  
   - `generateAIReply` and `classifyReply` use `claude-haiku-4-5-20251001`.  
   - **Recommendation:** Use one model constant; if the latter fails (invalid ID), switch to `claude-3-5-haiku-20241022` or the current Haiku model from Anthropic docs.

2. **Drip step template**  
   - `executeDripStep` sends `step.template` as-is.  
   - **Recommendation:** Resolve contact name from enrollment and run `fillTemplate(step.template, { name, phone })` so `{name}` in drip messages works.

3. **AUTO_REPLY_LOG**  
   - Content sends to background; sidepanel has `chrome.runtime.onMessage` and receives it (extension pages receive runtime messages). No change needed.

4. **Icons**  
   - Manifest references `icons/icon16.png`, `icon48.png`, `icon128.png`. Ensure these files exist in the package or the store will reject.

---

## 🔧 Optional hardening

- **Content script:** `getIncomingMessageContainers` and `getMessageText` have fallbacks; 3s polling backs up the observer. Good.
- **sendMessageToTab** retries 3–5 times; helps with WA Web load timing.
- **Drip alarm name** uses `seqId` (numeric from Date.now()) and `phone` (digits only), so `drip-{seqId}-{phone}-{step}` splits correctly.

---

## Summary

- **Core flows (bulk, quick send, auto reply, scan replies, drip, analytics, DNC, schedule, privacy, open chat) are implemented and connected.**  
- Fix Claude model ID if you see API errors on “Test API” or scan replies.  
- Add `{name}` replacement in drip steps if you use it.  
- Ensure `icons/` are present before submitting to the Chrome Web Store.
