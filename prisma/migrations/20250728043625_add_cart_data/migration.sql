-- AlterTable
ALTER TABLE "Cart" ADD COLUMN "ipAddress" TEXT;

-- CreateTable
CREATE TABLE "CartTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tag" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    CONSTRAINT "CartTag_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
