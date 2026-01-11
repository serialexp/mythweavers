-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCode" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "userId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_token_key" ON "AccessToken"("token");

-- CreateIndex
CREATE INDEX "AccessToken_token_idx" ON "AccessToken"("token");

-- CreateIndex
CREATE INDEX "AccessToken_userId_idx" ON "AccessToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCode_deviceCode_key" ON "DeviceCode"("deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCode_userCode_key" ON "DeviceCode"("userCode");

-- CreateIndex
CREATE INDEX "DeviceCode_deviceCode_idx" ON "DeviceCode"("deviceCode");

-- CreateIndex
CREATE INDEX "DeviceCode_userCode_idx" ON "DeviceCode"("userCode");

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
