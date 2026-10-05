CREATE TABLE "LegacyBookWishlistItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegacyBookWishlistItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegacyBookWishlistItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LegacyBookWishlistItem_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LegacyBookWishlistItem_userId_bookId_key"
  ON "LegacyBookWishlistItem"("userId", "bookId");
CREATE INDEX "LegacyBookWishlistItem_bookId_idx"
  ON "LegacyBookWishlistItem"("bookId");
