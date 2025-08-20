-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "nightscoutUrl" TEXT,
    "nightscoutToken" TEXT,
    "preferredUnits" TEXT NOT NULL DEFAULT 'MGDL',
    "rssToken" TEXT NOT NULL,
    "agreementsSigned" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("email", "emailVerified", "id", "image", "name", "nightscoutToken", "nightscoutUrl", "preferredUnits", "rssToken") SELECT "email", "emailVerified", "id", "image", "name", "nightscoutToken", "nightscoutUrl", "preferredUnits", "rssToken" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_rssToken_key" ON "User"("rssToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
