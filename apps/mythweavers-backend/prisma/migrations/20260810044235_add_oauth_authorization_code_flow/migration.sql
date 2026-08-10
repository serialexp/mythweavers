-- AlterTable
ALTER TABLE "AccessToken" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "resource" TEXT,
ADD COLUMN     "scope" TEXT;

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "clientName" TEXT NOT NULL DEFAULT 'Unnamed MCP client',
    "redirectUris" TEXT[],
    "grantTypes" TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token']::TEXT[],
    "responseTypes" TEXT[] DEFAULT ARRAY['code']::TEXT[],
    "tokenEndpointAuthMethod" TEXT NOT NULL DEFAULT 'none',
    "scope" TEXT,
    "clientUri" TEXT,
    "logoUri" TEXT,
    "softwareId" TEXT,
    "softwareVersion" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT,
    "scope" TEXT NOT NULL,
    "resource" TEXT,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
    "userId" INTEGER,
    "codeHash" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deniedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "codeExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthorizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthRefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resource" TEXT,
    "usedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthClient_createdAt_idx" ON "OAuthClient"("createdAt");

-- CreateIndex
CREATE INDEX "OAuthClient_lastUsedAt_idx" ON "OAuthClient"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationRequest_requestId_key" ON "OAuthAuthorizationRequest"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationRequest_codeHash_key" ON "OAuthAuthorizationRequest"("codeHash");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationRequest_expiresAt_idx" ON "OAuthAuthorizationRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationRequest_userId_idx" ON "OAuthAuthorizationRequest"("userId");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationRequest_clientId_idx" ON "OAuthAuthorizationRequest"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthRefreshToken_tokenHash_key" ON "OAuthRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_familyId_idx" ON "OAuthRefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_userId_revokedAt_idx" ON "OAuthRefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_expiresAt_idx" ON "OAuthRefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AccessToken_familyId_idx" ON "AccessToken"("familyId");

-- CreateIndex
CREATE INDEX "AccessToken_expiresAt_idx" ON "AccessToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;
