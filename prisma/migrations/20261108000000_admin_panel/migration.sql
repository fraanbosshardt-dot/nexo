-- Panel interno: equipo, sesiones propias, cupones, Pro reservado, costos, novedades y correos
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Subscription" ADD COLUMN "couponCode" TEXT;

CREATE TABLE "AdminMember" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'VIEWER', "addedBy" TEXT, "lastLoginAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AdminMember_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AdminMember_email_key" ON "AdminMember"("email");

CREATE TABLE "AdminSession" ("id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT, "ip" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_email_idx" ON "AdminSession"("email");

CREATE TABLE "Coupon" ("id" TEXT NOT NULL, "code" TEXT NOT NULL, "percentOff" INTEGER NOT NULL, "maxUses" INTEGER, "uses" INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3), "active" BOOLEAN NOT NULL DEFAULT true, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

CREATE TABLE "ProGrant" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "days" INTEGER, "note" TEXT, "addedBy" TEXT, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProGrant_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ProGrant_email_key" ON "ProGrant"("email");

CREATE TABLE "CompanyCost" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'USD', "period" TEXT NOT NULL DEFAULT 'monthly', "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CompanyCost_pkey" PRIMARY KEY ("id"));

CREATE TABLE "ProductNews" ("id" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductNews_pkey" PRIMARY KEY ("id"));

CREATE TABLE "EmailCampaign" ("id" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "audience" TEXT NOT NULL, "sent" INTEGER NOT NULL DEFAULT 0, "failed" INTEGER NOT NULL DEFAULT 0, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id"));
