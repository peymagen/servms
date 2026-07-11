-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "validityDate" DATETIME NOT NULL,
    "feeStatus" TEXT NOT NULL DEFAULT 'PAID',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "unitStation" TEXT NOT NULL,
    "vendorType" TEXT NOT NULL,
    "mobileNumber" TEXT,
    "email" TEXT,
    "aadhaarStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "medicalValidity" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vendor_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_licenseNumber_key" ON "Contractor"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");
