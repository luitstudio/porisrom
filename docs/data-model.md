# Porishrom — Data Model

Companion to [PRD.md](./PRD.md). Describes entities and relationships owned by `@porishrom/database` (Postgres via Prisma). This is a design document — the actual `packages/database/prisma/schema.prisma` gets built out incrementally per the roadmap, not all at once.

Prisma-syntax blocks below are illustrative of field shape/types, not final — types, indexes, and cascade rules will be refined during implementation.

---

## Entity overview

```
User ──1:1── FreelancerProfile ──1:N── PortfolioItem
  │                  │  N:M
  │                  ├── Category
  │                  └── Skill
  │
  └─1:1── CompanyProfile ── N:M ── Category (categories hired for)

Connection (requesterId, receiverId → User)
  └─1:1── Conversation ──1:N── Message
                          └─1:N── WorkAssignment ──1:N── WorkAssignmentEvent (audit/timeline)
                                          ├─1:N── Deliverable
                                          ├─1:1── PaymentVerification
                                          └─1:N── Review (max 2: one per direction)

Notification (userId nullable → broadcast)
AdminActionLog (adminId, targetUserId nullable)
UserBlock (blockerId, blockedId)
```

---

## User

Already exists in the current schema (`packages/database/prisma/schema.prisma`), needs extending.

```prisma
enum Role {
  freelancer
  client
  admin
}

enum AccountStatus {
  active
  blocked
  deleted // soft-delete: anonymized, login disabled
}

model User {
  id                  String        @id @default(cuid())
  name                String
  email               String        @unique
  passwordHash        String
  role                Role?
  status              AccountStatus @default(active)
  isOnboarded         Boolean       @default(false)
  profileCompleteness Int           @default(0)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  freelancerProfile   FreelancerProfile?
  companyProfile      CompanyProfile?
}
```

## FreelancerProfile / CompanyProfile

Separate tables (not a shared "Profile" polymorphic table) — cleaner types per role, matches the "single account per company, same shape as freelancer" decision.

```prisma
enum VerificationStatus {
  pending
  approved
  rejected
}

model FreelancerProfile {
  id                 String              @id @default(cuid())
  userId             String              @unique
  user               User                @relation(fields: [userId], references: [id])
  bio                String?
  location            String?
  state              String?
  district           String?
  languages          String[]
  experienceLevel    String?
  verificationStatus VerificationStatus  @default(pending)
  isBadgeVerified    Boolean             @default(false)
  ratingAvg          Float               @default(0)
  ratingCount        Int                 @default(0)

  categories         FreelancerCategory[]
  skills             FreelancerSkill[]
  portfolioItems     PortfolioItem[]
}

model CompanyProfile {
  id                 String              @id @default(cuid())
  userId             String              @unique
  user               User                @relation(fields: [userId], references: [id])
  companyName        String
  logoUrl            String?
  about              String?
  location           String?
  verificationStatus VerificationStatus  @default(pending)
  isBadgeVerified    Boolean             @default(false)
  ratingAvg          Float               @default(0)
  ratingCount        Int                 @default(0)

  categories         CompanyCategory[]
}
```

## Category / Skill (tagging, drives search filters)

```prisma
model Category {
  id   String @id @default(cuid())
  name String @unique
  slug String @unique
}

model Skill {
  id         String    @id @default(cuid())
  name       String    @unique
  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id])
}

model FreelancerCategory {
  freelancerProfileId String
  categoryId          String
  freelancerProfile   FreelancerProfile @relation(fields: [freelancerProfileId], references: [id])
  category            Category          @relation(fields: [categoryId], references: [id])
  @@id([freelancerProfileId, categoryId])
}

model FreelancerSkill {
  freelancerProfileId String
  skillId             String
  freelancerProfile   FreelancerProfile @relation(fields: [freelancerProfileId], references: [id])
  skill               Skill             @relation(fields: [skillId], references: [id])
  @@id([freelancerProfileId, skillId])
}

model CompanyCategory {
  companyProfileId String
  categoryId       String
  companyProfile   CompanyProfile @relation(fields: [companyProfileId], references: [id])
  category         Category       @relation(fields: [categoryId], references: [id])
  @@id([companyProfileId, categoryId])
}
```

## PortfolioItem

```prisma
enum PortfolioItemType {
  image
  video
  link
  document
}

model PortfolioItem {
  id                  String            @id @default(cuid())
  freelancerProfileId String
  freelancerProfile   FreelancerProfile @relation(fields: [freelancerProfileId], references: [id])
  title               String
  description         String?
  type                PortfolioItemType
  url                 String
  createdAt           DateTime          @default(now())
}
```

## Connection

```prisma
enum ConnectionStatus {
  pending
  accepted
  declined
}

model Connection {
  id           String           @id @default(cuid())
  requesterId  String
  receiverId   String
  requester    User             @relation("ConnectionRequester", fields: [requesterId], references: [id])
  receiver     User             @relation("ConnectionReceiver", fields: [receiverId], references: [id])
  status       ConnectionStatus @default(pending)
  createdAt    DateTime         @default(now())
  respondedAt  DateTime?

  conversation Conversation?

  @@unique([requesterId, receiverId])
}
```

## Conversation / Message

```prisma
model Conversation {
  id           String   @id @default(cuid())
  connectionId String   @unique
  connection   Connection @relation(fields: [connectionId], references: [id])
  createdAt    DateTime @default(now())

  messages        Message[]
  workAssignments WorkAssignment[]
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  senderId       String
  sender         User         @relation(fields: [senderId], references: [id])
  body           String
  createdAt      DateTime     @default(now())
  readAt         DateTime?
}
```

## WorkAssignment / WorkAssignmentEvent

```prisma
enum WorkAssignmentStatus {
  proposed
  modification_requested
  accepted
  in_progress
  submitted
  revision_requested
  delivery_accepted
  payment_pending
  completed
  disputed
  cancelled
  rejected
}

model WorkAssignment {
  id             String                @id @default(cuid())
  conversationId String
  conversation   Conversation          @relation(fields: [conversationId], references: [id])
  createdById    String                // company user id
  title          String
  description    String
  budgetAmount   Decimal
  currency       String                @default("INR")
  dueDate        DateTime?
  status         WorkAssignmentStatus  @default(proposed)
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  events              WorkAssignmentEvent[]
  deliverables        Deliverable[]
  paymentVerification PaymentVerification?
  reviews             Review[]
}

model WorkAssignmentEvent {
  id               String         @id @default(cuid())
  workAssignmentId String
  workAssignment   WorkAssignment @relation(fields: [workAssignmentId], references: [id])
  actorId          String
  action           String         // e.g. "proposed", "modification_requested", "accepted", "submitted", "revision_requested", "delivery_accepted", "cancelled"
  note             String?
  createdAt        DateTime       @default(now())
}
```

## Deliverable

```prisma
enum DeliverableType {
  demo
  preview
  watermarked_file
  drive_link
  github_link
  file
}

model Deliverable {
  id               String          @id @default(cuid())
  workAssignmentId String
  workAssignment   WorkAssignment  @relation(fields: [workAssignmentId], references: [id])
  type             DeliverableType
  url              String
  note             String?
  submittedAt      DateTime        @default(now())
}
```

## PaymentVerification

```prisma
enum PaymentVerificationStatus {
  awaiting_client
  awaiting_freelancer
  mismatch
  verified
}

model PaymentVerification {
  id                 String                     @id @default(cuid())
  workAssignmentId   String                     @unique
  workAssignment     WorkAssignment             @relation(fields: [workAssignmentId], references: [id])
  clientUtr          String?
  clientClaimedAt    DateTime?
  freelancerUtr      String?
  freelancerClaimedAt DateTime?
  mismatchCount      Int                        @default(0)
  status             PaymentVerificationStatus  @default(awaiting_client)
  verifiedAt         DateTime?
}
```

## Review

```prisma
enum ReviewDirection {
  client_to_freelancer
  freelancer_to_client
}

model Review {
  id               String          @id @default(cuid())
  workAssignmentId String
  workAssignment   WorkAssignment  @relation(fields: [workAssignmentId], references: [id])
  authorId         String
  targetId         String
  direction        ReviewDirection
  rating           Int             // 1-5
  comment          String?
  createdAt        DateTime        @default(now())

  @@unique([workAssignmentId, direction])
}
```

## Notification / AdminActionLog / UserBlock

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String?  // null = broadcast to all
  type      String
  message   String
  isRead    Boolean  @default(false)
  createdBy String?  // admin id, for direct/broadcast messages
  createdAt DateTime @default(now())
}

model AdminActionLog {
  id           String   @id @default(cuid())
  adminId      String
  targetUserId String?
  action       String   // "approve_profile", "reject_profile", "issue_badge", "revoke_badge", "block_user", "delete_user"
  metadata     Json?
  createdAt    DateTime @default(now())
}

model UserBlock {
  id        String   @id @default(cuid())
  blockerId String
  blockedId String
  createdAt DateTime @default(now())

  @@unique([blockerId, blockedId])
}
```

---

## Notes on ranking/leaderboard

`ratingAvg`/`ratingCount` on `FreelancerProfile`/`CompanyProfile` are denormalized fields, recomputed whenever a new `Review` is created. Leaderboard queries just sort by `ratingAvg` (with a minimum `ratingCount` threshold to avoid a single 5-star review topping the board) — no separate leaderboard table needed for MVP.
