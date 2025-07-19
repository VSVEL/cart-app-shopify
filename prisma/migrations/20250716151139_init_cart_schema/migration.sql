-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerEmail" TEXT,
    "isGuest" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "checkedAt" DATETIME,
    "emailSentAt" DATETIME,
    "convertedAt" DATETIME,
    "recoveryLink" TEXT,
    "cartData" JSONB
);
