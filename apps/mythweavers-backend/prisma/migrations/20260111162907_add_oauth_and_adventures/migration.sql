-- CreateTable
CREATE TABLE "Adventure" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Adventure',
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adventure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Adventure_userId_idx" ON "Adventure"("userId");

-- AddForeignKey
ALTER TABLE "Adventure" ADD CONSTRAINT "Adventure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
