-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "station" TEXT NOT NULL,
    "platformLocation" TEXT,
    "division" TEXT NOT NULL,
    "clusterName" TEXT,
    "contractType" TEXT,
    "contractCategory" TEXT,
    "unitName" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "areaDescription" TEXT,
    "inspectorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitStation" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "occurrenceDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Penalty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNo" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT NOT NULL,
    "unitLocation" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "penaltyType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Penalty_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vendor" (
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
    "idCardStatus" TEXT NOT NULL DEFAULT 'NOT_ISSUED',
    "idCardIssuedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vendor_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Vendor" ("aadhaarStatus", "contractorId", "createdAt", "division", "email", "fullName", "id", "medicalValidity", "mobileNumber", "status", "unitStation", "updatedAt", "vendorCode", "vendorType") SELECT "aadhaarStatus", "contractorId", "createdAt", "division", "email", "fullName", "id", "medicalValidity", "mobileNumber", "status", "unitStation", "updatedAt", "vendorCode", "vendorType" FROM "Vendor";
DROP TABLE "Vendor";
ALTER TABLE "new_Vendor" RENAME TO "Vendor";
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_unitCode_key" ON "Unit"("unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "Penalty_refNo_key" ON "Penalty"("refNo");
