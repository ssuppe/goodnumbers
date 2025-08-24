# Goodnumbers — Phase 4 Task 1

Implement and thoroughly verify cascading deletes for all user-related data to ensure complete data privacy upon account deletion.

## Invariants (do not change)

1.  **User Data Sanctity**: When a `User` entity is deleted, all personally associated data—including `Account`, `Session`, `Journal`, and `GlycemicEventCluster` records—must be irrevocably deleted from the database.
2.  **Orphaned Data Prohibition**: No `Journal` or `GlycemicEventCluster` record may exist without a valid foreign key to a parent record.
3.  **Atomic Operation**: The deletion of a user and all their cascaded data must occur as a single, atomic operation, relying on the database's inherent transactional guarantees for `DELETE` statements.

## Assumptions & Scope

- **Assumption**: The database engine (SQLite) correctly enforces the `onDelete: Cascade` foreign key action as specified by the Prisma schema.
- **Assumption**: Verifying the cascade for `Account`, `Session`, `Journal`, and `GlycemicEventCluster` provides sufficient confidence that all user-linked data is being properly removed.
- **Scope**: This task is strictly limited to modifying the Prisma schema, generating the migration, and implementing a comprehensive integration test to verify the complete cascade.
- **Scope Limitation**: This task implements a synchronous "hard delete." The performance implications at scale and the lack of a "soft delete" recovery mechanism are acknowledged but are considered out of scope for this specific task. These concerns will be documented as required future work.

## Objectives

1.  **Modify Schema**: Update `prisma/schema.prisma` to include the necessary `onDelete: Cascade` directives on the `Journal` and `GlycemicEventCluster` models.
2.  **Migrate Database**: Successfully generate and apply a new database migration reflecting the schema changes.
3.  **Verify Full Cascade Deletion**: Implement and pass a comprehensive integration test that proves the cascading deletion mechanism works for _all_ related models (`Account`, `Session`, `Journal`, `GlycemicEventCluster`).
4.  **Update Documentation**: Update the `TECHNICAL_SPECIFICATION.md` document to reflect the new schema and, critically, to document the known limitations (synchronous deletion) and suggest future improvements (asynchronous background job).

## Risks & Mitigations

- **Risk**: Accidental data loss if the `onDelete: Cascade` directive is misapplied.
  - **Mitigation**: The implementation plan requires a comprehensive integration test covering all related models. This test will be run on isolated, temporary test data, ensuring no production data is at risk and confirming the cascade's precise behavior.
- **Risk**: Performance degradation under load. A synchronous delete on a user with a large amount of data could lock tables and cause API timeouts.
  - **Mitigation**: While implementing an asynchronous solution is out of scope for this MVP task, the risk will be mitigated by documenting it explicitly in `TECHNICAL_SPECIFICATION.md` and creating a follow-up ticket to re-architect user deletion as a background job post-MVP.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea**: Ensure user data is completely deleted upon account removal to comply with privacy best practices.
- **Mechanism**: Leverage the database's built-in foreign key `ON DELETE CASCADE` action. This is the most efficient and reliable way to enforce this data integrity rule, configured declaratively in the `prisma/schema.prisma` file.
- **Trade-offs**:
  - **Pros**: Highly reliable, performant for small-to-medium data sets, and ensures data integrity at the lowest level (the database). The application logic does not need to be aware of the cascade, simplifying code.
  - **Cons**: Deletions are immediate and permanent ("hard delete") with no recovery mechanism. The operation is synchronous, which poses a performance risk for users with very large datasets.
- **Go/No-Go**: **Go**. This is the standard, industry-best-practice solution for the immediate requirement. The identified "cons" are acceptable for the MVP phase but must be documented for future remediation.

## Implementation Notes

- **Attach Points**: Modify the `user` relation on the `Journal` model and the `journal` relation on the `GlycemicEventCluster` model in `goodnumbers/prisma/schema.prisma`.
- **API Contracts**: This change affects the data layer only and has no immediate impact on existing API contracts. It is a foundational change for the future `DELETE /api/user/me` endpoint.
- **Tooling**: Use the Prisma CLI (`npx prisma migrate dev`) to generate and apply the migration.

## Acceptance Gates

1.  The `prisma/schema.prisma` file must contain `onDelete: Cascade` on the specified relations.
2.  The command `npx prisma migrate dev --name feat-cascading-deletes` must execute successfully.
3.  The new integration test (`tests/integration/privacy.test.ts`) must pass, confirming that deleting a user also deletes their associated `Account`, `Session`, `Journal`, and `GlycemicEventCluster`.
4.  The Prisma schema _and the Future Work section_ in `docs/TECHNICAL_SPECIFICATION.md` must be updated to reflect the changes and acknowledge the synchronous deletion limitation.

## “Make-sure-you” Checklist

- [ ] You have added `onDelete: Cascade` to the `user` field in the `Journal` model.
- [ ] You have added `onDelete: Cascade` to the `journal` field in the `GlycemicEventCluster` model.
- [ ] You have not added `onDelete: Cascade` to any other relations.
- [ ] You have successfully run the `prisma migrate dev` command.
- [ ] You have written a new, comprehensive integration test that creates a user with an `Account`, `Session`, `Journal`, and `GlycemicEventCluster` and proves _all_ are deleted when the user is.
- [ ] You have updated the schema definition in `docs/TECHNICAL_SPECIFICATION.md`.
- [ ] You have added a "Future Work & Improvements" section to `docs/TECHNICAL_SPECIFICATION.md` detailing the risks of synchronous deletion at scale.

## Project hygiene prep

1.  **Create GitHub Issue**: First, create an issue to track this work.
    ```bash
    gh issue create --title "feat(db): P4_T1 add cascading deletes for user privacy" --body "Implement cascading deletes as per Phase 4, Task 1 of the implementation plan. This ensures user privacy by automatically removing all related data upon account deletion. This includes verifying the full cascade across Account, Session, and Journal models."
    ```
2.  **Create Git Branch**: Create a new feature branch from `develop`. Use the issue number in the branch name. (Assuming the issue created is #41).
    ```bash
    # Example assuming the issue created is #41
    git checkout develop
    git pull
    git checkout -b feat/41-cascading-deletes
    ```
3.  **Adopt Test-Driven Approach**: You will write a failing test first that defines the desired behavior (all of a user's data is deleted when the user is), then implement the schema change to make it pass.

## In-depth test plan

The testing strategy will focus on a single, high-confidence integration test to verify the complete, end-to-end database-level behavior.

1.  **Test Type**: Integration Test.
2.  **Objective**: Verify that deleting a `User` record triggers a cascading delete of **all** its associated records, including Auth.js models (`Account`, `Session`) and application-specific models (`Journal`, `GlycemicEventCluster`).
3.  **Test File**: Create a new test file:
    ```markdown
    <!-- file: goodnumbers/tests/integration/privacy.test.ts -->
    ```
4.  **Test Logic (Red-Green-Refactor)**:
    - **(Red)**: Initially, write the complete test. It is expected to fail with a foreign key constraint violation on the `Journal` table, because while the Auth.js models in the original schema already have `onDelete: Cascade`, the `Journal` model does not. This proves the test is correctly targeting the missing logic.
    - **Test Steps**:
      1.  **Setup**:
          - Import the `prisma` client.
          - Use a `beforeEach` hook to clean the database and then create a comprehensive test user record. This record will be created using a single, nested `prisma.user.create` call to ensure all relations are correctly established.
          - The created user must have one related `Account`, one `Session`, one `Journal`, and one `GlycemicEventCluster`.
          - Store the unique IDs of all created records for later verification.
      2.  **Execution**:
          - Delete the parent `User` record using `prisma.user.delete()`.
      3.  **Assertion**:
          - Individually query for each of the stored IDs (`Account`, `Session`, `Journal`, `GlycemicEventCluster`).
          - Assert that the result of each query is `null`, proving that the records were successfully deleted by the cascade.
    - **(Green)**: Apply the schema changes and run the migration. Re-run the test; it should now pass.

## In-depth engineering plan

### Step 1: Write the Failing (But Comprehensive) Integration Test

Create the new, complete test file. This test will fail initially, confirming the current schema's shortcoming. This is the most important step to verify the fix.

```markdown
<!-- file: goodnumbers/tests/integration/privacy.test.ts -->

import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

describe('Data Privacy and Cascading Deletes', () => {
let user: User;
let accountId: string;
let sessionId: string;
let journalId: string;
let clusterId: string;

// Use a transaction-like nested create to set up all related data for a single user
beforeEach(async () => {
// Clean up from previous tests to ensure a pristine environment
await prisma.glycemicEventCluster.deleteMany({});
await prisma.journal.deleteMany({});
await prisma.account.deleteMany({});
await prisma.session.deleteMany({});
await prisma.user.deleteMany({});

    // Setup: Create a user and all related data in one go
    const createdUser = await prisma.user.create({
      data: {
        email: 'privacy-cascade-test@example.com',
        accounts: {
          create: {
            type: 'oauth',
            provider: 'google',
            providerAccountId: 'test-provider-id-123',
          },
        },
        sessions: {
          create: {
            sessionToken: 'test-session-token-123',
            expires: new Date(Date.now() + 86400 * 1000), // Expires in 1 day
          },
        },
        journals: {
          create: {
            status: 'COMPLETE',
            clusters: {
              create: {
                eventType: 'HIGH',
                eventCount: 3,
                meanTimeMinutes: 120,
                clusterDataJson: {},
              },
            },
          },
        },
      },
      // Include all related data in the return object to get their generated IDs
      include: {
        accounts: true,
        sessions: true,
        journals: {
          include: {
            clusters: true,
          },
        },
      },
    });

    user = createdUser;
    // Store IDs for verification after deletion
    accountId = user.accounts[0].id;
    sessionId = user.sessions[0].id;
    journalId = user.journals[0].id;
    clusterId = user.journals[0].clusters[0].id;

});

afterAll(async () => {
// Final cleanup
await prisma.$disconnect();
});

it('should delete all associated data (Account, Session, Journal, Cluster) when a user is deleted', async () => {
// 1. Pre-condition Check: Ensure all records exist before deletion
expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
expect(await prisma.account.findUnique({ where: { id: accountId } })).not.toBeNull();
expect(await prisma.session.findUnique({ where: { id: sessionId } })).not.toBeNull();
expect(await prisma.journal.findUnique({ where: { id: journalId } })).not.toBeNull();
expect(await prisma.glycemicEventCluster.findUnique({ where: { id: clusterId } })).not.toBeNull();

    // 2. Execution: Delete the user, which should trigger the cascade
    await prisma.user.delete({
      where: { id: user.id },
    });

    // 3. Assertion: Verify that ALL associated records are also deleted
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.account.findUnique({ where: { id: accountId } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    expect(await prisma.journal.findUnique({ where: { id: journalId } })).toBeNull();
    expect(await prisma.glycemicEventCluster.findUnique({ where: { id: clusterId } })).toBeNull();

});
});
```

Run the test and confirm it fails as expected.

```bash
cd goodnumbers && npm test -- tests/integration/privacy.test.ts
```

### Step 2: Modify the Prisma Schema

Update `goodnumbers/prisma/schema.prisma` to add the `onDelete: Cascade` directives.

```markdown
<!-- file: goodnumbers/prisma/schema.prisma -->

// Enum for type safety on user's preferred glucose units
enum GlucoseUnit {
MGDL
MMOL
}

// --- Core Application Models ---

model User {
id String @id @default(cuid())
name String?
email String? @unique
emailVerified DateTime?
image String?
accounts Account[]
sessions Session[]
journals Journal[]

// Application-specific settings
nightscoutUrl String?
nightscoutToken String?
preferredUnits GlucoseUnit @default(MGDL)
rssToken String @unique @default(cuid())
agreementsSigned Boolean @default(false)
}

model Journal {
id String @id @default(cuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
userId String
// MODIFICATION: Added onDelete: Cascade to ensure journals are deleted when a user is.
user User @relation(fields: [userId], references: [id], onDelete: Cascade)

status String @default("PENDING")
progress Int @default(0)
statusMessage String?

weeklyVibe String?
influencingFactors Json?
goalsForNextWeek String?

podcastTitle String?
podcastDescription String?
podcastAudioUrl String?
agpChartData Json?
analysisInsights Json?

clusters GlycemicEventCluster[]
}

model GlycemicEventCluster {
id String @id @default(cuid())
journalId String
// MODIFICATION: Added onDelete: Cascade to ensure clusters are deleted when a journal is.
journal Journal @relation(fields: [journalId], references: [id], onDelete: Cascade)

eventType String
eventCount Int
meanTimeMinutes Int

clusterDataJson Json
userNotes String?
}

// --- Standard Auth.js Models ---

model Account {
id String @id @default(cuid())
userId String
type String
provider String
providerAccountId String
refresh_token String?
access_token String?
expires_at Int?
token_type String?
scope String?
id_token String?
session_state String?

user User @relation(fields: [userId], references: [id], onDelete: Cascade)

@@unique([provider, providerAccountId])
}

model Session {
id String @id @default(cuid())
sessionToken String @unique
userId String
expires DateTime
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
identifier String
token String @unique
expires DateTime

@@unique([identifier, token])
}
```

### Step 3: Create and Apply the Database Migration

Run the Prisma migrate command to apply the schema changes.

```bash
cd goodnumbers && npx prisma migrate dev --name feat-cascading-deletes
```

### Step 4: Re-run the Test to Confirm the Fix

The comprehensive integration test should now pass, verifying the complete fix.

```bash
cd goodnumbers && npm test -- tests/integration/privacy.test.ts
```

### Step 5: Update Technical Specification Document

Finally, update `docs/TECHNICAL_SPECIFICATION.md` with the corrected schema and the new "Future Work & Improvements" section to document the identified risks for post-MVP consideration.

````markdown
<!-- file: docs/TECHNICAL_SPECIFICATION.md -->

# Technical Specification: Goodnumbers Weekly Health Journal

**Version:** 1.3
**Date:** 2025-08-24
**Status:** Final

... (sections 1-3 remain the same) ...

## 4. Data Handling

The data model is defined using Prisma ORM for a SQLite database.

### 4.1. Prisma Schema

```prisma
// file: prisma/schema.prisma

// Enum for type safety on user's preferred glucose units
enum GlucoseUnit {
  MGDL
  MMOL
}

// --- Core Application Models ---

model User {
  id              String    @id @default(cuid())
  name            String?
  email           String?   @unique
  emailVerified   DateTime?
  image           String?
  accounts        Account[]
  sessions        Session[]
  journals        Journal[]

  // Application-specific settings
  nightscoutUrl   String?
  nightscoutToken String?
  preferredUnits  GlucoseUnit @default(MGDL)
  rssToken        String    @unique @default(cuid())
  agreementsSigned Boolean @default(false)
}

model Journal {
  id                   String    @id @default(cuid())
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  userId               String
  // CRITICAL PRIVACY FIX: onDelete: Cascade ensures that if a User record
  // is deleted, all of their associated journals are automatically deleted
  // from the database, preventing orphaned sensitive data.
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Job progress tracking
  status               String    @default("PENDING")
  progress             Int       @default(0)
  statusMessage        String?

  // User-provided subjective inputs
  weeklyVibe           String?
  influencingFactors   Json?
  goalsForNextWeek     String?

  // AI-generated content
  podcastTitle         String?
  podcastDescription   String?
  podcastAudioUrl      String?
  agpChartData         Json?
  analysisInsights     Json?

  // Relation to detailed analysis
  clusters             GlycemicEventCluster[]
}

model GlycemicEventCluster {
  id                  String    @id @default(cuid())
  journalId           String
  // CRITICAL PRIVACY FIX: This ensures that if a Journal is deleted (either
  // directly or via a user deletion cascade), all of its associated
  // event clusters are also automatically deleted.
  journal             Journal   @relation(fields: [journalId], references: [id], onDelete: Cascade)

  // Cluster summary data
  eventType           String
  eventCount          Int
  meanTimeMinutes     Int

  // Detailed data and user notes
  clusterDataJson     Json
  userNotes           String?
}


// --- Standard Auth.js Models ---

model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String?
  access_token       String?
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?
  session_state      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```
````

... (rest of the document remains the same until the end) ...

## 12. Future Work & Improvements (TODO)

This section lists key areas for improvement identified during the critical analysis phase. They are slated for consideration in future iterations, post-MVP.

- **[TODO] Re-architect User Deletion for Asynchronous Execution**:

  - **Problem**: The current `onDelete: Cascade` implementation is synchronous. If a user with a very large history of journals and data requests to delete their account, the resulting database transaction could take a significant amount of time, potentially locking tables and causing API request timeouts.
  - **Proposed Solution**: For post-MVP, this process should be re-architected to be fully asynchronous. The API should trigger a "soft delete" by marking the user for deletion (e.g., `status: "DELETION_QUEUED"`) and immediately return a response. A separate background worker should then pick up this user ID and perform the permanent, cascading delete out-of-band, ensuring the user-facing API remains fast and responsive.

- **[TODO] Implement a Soft-Delete Grace Period**:

  - **Problem**: The current implementation is a permanent "hard delete." There is no recovery mechanism for accidental user deletion or if a user changes their mind.
  - **Proposed Solution**: A future iteration should consider a soft-delete pattern. When a user requests deletion, their account is marked with a `deletedAt` timestamp. The user's data becomes inaccessible but is not immediately purged. A background job would then permanently delete the data after a grace period (e.g., 30 days), allowing for a potential recovery window.

- **[TODO] Re-architect for Asynchronous Journal Generation**: The current synchronous flow (making the user wait on a loading screen) is fragile and provides a poor user experience. It is susceptible to network timeouts and provides no resilience if a step in the backend pipeline fails. This should be re-architected to be fully asynchronous: the API should accept the request and return immediately, allowing the user to leave the page while the backend processes the job. The user should be notified of completion via an in-app indicator or email.
- **[TODO] Plan for Database Scalability**: The choice of SQLite, while simple for initial setup, presents a significant long-term scalability and reliability risk. Its file-based locking is not well-suited for highly concurrent access from multiple processes (web server and background worker), which can lead to `SQLITE_BUSY` errors and API failures under load. A formal plan should be created to migrate to a robust client-server database like PostgreSQL to ensure system stability as the user base grows.
- **[TODO] Conduct a Cost Analysis**: A thorough cost analysis of the AI (Gemini) and TTS API calls should be performed to understand the financial viability of the service, especially concerning the planned freemium model.
- **[TODO] Seek Legal Counsel on PHI/HIPAA**: Given the handling of sensitive health data (PHI), the project should seek advice from legal counsel specializing in digital health to fully understand regulatory risks and obligations (such as HIPAA in the US).
- **[TODO] Improve AI Pipeline Resilience**: The background worker's multi-pass AI and TTS pipeline should be made more resilient. This includes implementing robust error-handling, state management, and a retry mechanism to handle transient failures in external API calls.

```

```
