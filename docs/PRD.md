# Porishrom — Product Requirements Document

## 1. What this is

Porishrom is a professional networking and freelance marketplace connecting **Freelancers** with **Companies/Clients**. It is not a job board — it's a full workflow platform: discovery, connection, negotiation, structured work assignment, delivery, payment verification, and reputation.

Three roles: **Freelancer**, **Company/Client**, **Admin**.

This document reflects the original product vision plus decisions made to close gaps found while designing the data model and API (each flagged inline as **Decision:**). Anything still open is flagged as **Open question:**.

---

## 2. Roles & capabilities

### 2.1 Freelancer
- Complete profile setup (bio, categories, skills, experience, location, languages).
- Maintain a portfolio (previous work: images, links, documents, videos).
- Display skills, experience, categories, ratings, and reviews publicly.
- Receive an admin-issued verification badge (separate from basic profile approval — see §2.3).
- Personal dashboard (active work, earnings, connections, messages, reviews).
- Search/browse companies with filters (category, location, rating, verified-only).
- View company profiles.
- View other freelancer profiles (public, for leaderboard/competitive visibility) — **cannot message other freelancers**.
- Send connection requests to companies.
- Accept/decline incoming connection requests from companies.
- Once a connection is accepted, chat with that company.
- Receive, accept, reject, or request modification of work assignments.
- Submit completed work (demo/preview/watermarked files/links).
- Claim payment received (UTR-based, see §5).
- Rate the company after work completion.
- Appear on the freelancer leaderboard.

### 2.2 Company / Client
- Complete profile setup (company name, logo, about, categories of interest, location).
- Personal dashboard (posted work, active projects, spend, connections, messages).
- Search/browse freelancers with filters (category, skill, location, rating, verified-only, experience).
- View freelancer profiles and portfolios.
- Send connection requests to freelancers.
- Accept/decline incoming connection requests from freelancers.
- Once a connection is accepted, chat with that freelancer.
- Create structured work assignments inside a conversation.
- Monitor assigned work and track completed projects.
- Review submitted deliverables: accept or request revision (**Decision**, §6 Step 7.5).
- Claim payment sent (UTR-based, see §5).
- Rate the freelancer after work completion.
- Appear on a company leaderboard (symmetric with freelancer leaderboard, since ratings affect "company ranking" per the original vision).

### 2.3 Admin
- Approve or reject freelancer profiles (gate: can the account be active/visible at all).
- Approve or reject company/client profiles.
- Issue **and revoke** verification badges (**Decision**: badge is a distinct trust signal from basic profile approval — a profile can be Approved but not yet Badge-Verified; badges may need to be revocable if fraud is discovered later).
- View every user, conversation, work assignment, and payment record.
- Block or delete users.
- Send platform-wide broadcast notifications.
- Send direct messages to any user.
- Access analytics and moderation tools.
- **Decision**: every mutating admin action (approve/reject/badge/block/delete) is written to an append-only `AdminActionLog` for accountability — not in the original spec, added because admin has unilateral control over other people's accounts and money-adjacent workflows.

---

## 3. Account model

- **Decision**: one account = one fixed role (Freelancer or Client), chosen at signup. No dual-role accounts, no role switching in MVP.
- **Decision**: a Company/Client account is a single login (individual or company), not a multi-seat organization. Team/member invites are a future feature, not MVP — avoids a much heavier `Company <-> User` membership model upfront.
- **Decision**: Freelancers cannot message other Freelancers. Companies cannot message other Companies either (not in original spec, but symmetric — the platform is strictly Freelancer↔Company). Both roles *can* browse same-role profiles publicly (for leaderboard/competitive context).

---

## 4. Connections & messaging

**Decision** (resolves an ambiguity in the original spec, which listed "send connection request" and "send the first message" as if separate, but only described one accept/decline gate): connection requests and messaging are **two distinct, sequential steps**:

1. Either a Freelancer or a Company can send a **Connection Request** to the other (no message content attached — like a plain "connect").
2. The receiver **Accepts** or **Declines**. Nothing else is visible/possible until this happens — no preview message, no partial chat.
3. On Accept, a **Conversation** is created and both sides can now exchange free-form messages.
4. On Decline, the connection is closed. **Decision**: the same sender may re-request after a cooldown (14 days) to prevent spam — not in the original spec, added to prevent repeated unwanted requests.

Open question: should the receiver see *why* someone wants to connect (e.g. a short note field on the request) even though full messaging is gated? Recommend yes — a short optional note (≤200 chars) attached to the request — but defaulting to **no note field in MVP** since it wasn't asked for; easy to add later.

---

## 5. Work assignment negotiation

Inside an accepted conversation, either side can discuss scope/timeline/budget freely via messages. When ready, the **Company** creates a structured **Work Assignment**:

- Title, description, timeline/due date, budget, attachments.
- Freelancer can **Accept**, **Reject**, or **Request Modification** (of price, timeline, deliverables, or scope).
- Modification requests loop back to the Company, who can revise and resend, or reject the freelancer's counter. This can go back and forth multiple times.
- Once both sides agree, the assignment becomes **Active** and the freelancer begins work.
- **Decision**: every state transition (proposed → modified → accepted → submitted → revision requested → delivered → paid → completed, or → rejected/cancelled at various points) is recorded as an append-only event log tied to the assignment, both for the in-chat "activity timeline" (an idea listed as a future feature in the original doc, but needed structurally from day one to make negotiation legible) and for admin audit.
- **Decision**: a single Conversation may have multiple Work Assignments over time (repeat business between the same Freelancer/Company pair) — not explicitly stated, but a 1:1 conversation-to-assignment limit would be an artificial and likely wrong constraint.

### 5.1 Delivery & review (Decision: new step, §7.5)
The original spec jumps from "freelancer submits work" straight to payment verification. This is a gap: it forces a Company into a binary payment decision with no way to reject bad work first. Added step:

- Freelancer submits deliverables (demo, preview, watermarked file, Drive link, GitHub link, or any supported attachment).
- Company reviews: **Accept Delivery** (unlocks payment verification) or **Request Revision** (sends back to freelancer with feedback, assignment returns to in-progress).

### 5.2 Cancellation (Decision: gap-fill)
Not addressed in the original spec. Either side may propose cancelling an assignment before completion; it requires the other side's confirmation, or admin arbitration if they disagree. A unilaterally-abandoned assignment (no response within a defined window) can be flagged for admin review. Cancelled assignments do not generate reviews.

---

## 6. Payment verification

No payment gateway integration in MVP — payment happens outside the platform. Porishrom only verifies that **both sides claim the same reference number**:

1. Company clicks **Paid**, enters the UTR/transaction ID they sent.
2. Freelancer clicks **Received**, enters the UTR/transaction ID they received.
3. If they match → payment marked **Verified**, assignment moves to **Completed**.
4. If they don't match → stays **Pending**, both notified, both can correct and resubmit.

**Explicitly documented limitation** (this is a soft trust signal, not proof of payment — both parties could theoretically enter a fabricated matching number): admin retains full visibility into every payment verification record and can manually override/flag a case if a dispute is raised outside the matching mechanism itself.

**Decision** (gap-fill): after a defined number of mismatch attempts (e.g. 3) without resolution, the assignment is auto-flagged for admin review rather than looping indefinitely.

---

## 7. Reputation

- After a Work Assignment reaches Completed, both sides rate each other (1–5 + comment).
- Ratings roll up into a profile's average rating and feed the leaderboard ranking (Freelancer leaderboard and Company leaderboard, both derived the same way).
- **Decision**: reviews are tied to a specific completed Work Assignment (not freeform), and cannot be edited after submission — only one review per side per assignment.

---

## 8. Moderation & platform integrity (gap-fill additions)

Not in the original spec, added because they're required for the above to function safely at any real scale:

- **User-level block/report**: a Freelancer or Company can block a specific counterpart (hides them from search, prevents new connection requests) independent of Admin action.
- **Account deletion semantics**: Admin "delete" is a **soft delete** (anonymize profile, deactivate login) rather than a hard delete — preserves the integrity of the other party's reviews/history in completed assignments.
- **Mid-project moderation**: if Admin blocks/deletes a user with active conversations/assignments, those are frozen (read-only) and the counterpart is notified; Admin resolves manually (no automatic cancellation, since money may already be in flight outside the platform).
- **Profile resubmission**: a Rejected freelancer/company can edit their profile and resubmit for another Admin review.
- **Badge revocation**: Admin can revoke a previously issued verification badge (e.g. fraud discovered later) without necessarily re-rejecting the whole profile.

---

## 9. Explicitly out of scope for MVP (from the original "Additional Ideas" list)

Milestone-based projects, escrow integration, real-time messaging (MVP chat is refresh/poll-based), online/offline presence, smart recommendations, deep analytics dashboards, saved freelancers/companies, multi-seat company accounts, in-app payment gateway. These are backlog items — noted in the roadmap as later phases, not blocking the MVP loop.

---

## 10. Assumptions made in this document

- No dual-role or role-switching accounts.
- Company accounts are single-login, not multi-seat orgs.
- Freelancer↔Freelancer and Company↔Company messaging are both disallowed.
- Connection requests carry no message/note content in MVP.
- Declined connection requests have a 14-day re-request cooldown.
- Notifications are in-app/web only in MVP (no email/SMS/push).
- Admin actions are logged for audit; user deletion is soft-delete.

If any of these don't match your intent, flag them — they're all cheap to change now, expensive to change after the schema and API are built on top of them.
