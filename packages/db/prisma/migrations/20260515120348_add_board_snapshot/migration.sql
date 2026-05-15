-- CreateTable
CREATE TABLE "BoardSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "shapes" TEXT NOT NULL,
    "label" TEXT,
    "shapeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BoardSnapshot_boardId_createdAt_idx" ON "BoardSnapshot"("boardId", "createdAt");
