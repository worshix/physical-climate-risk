/*
  Warnings:

  - You are about to drop the column `userId` on the `Field` table. All the data in the column will be lost.
  - Added the required column `borrowerId` to the `Field` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borrowerId" TEXT NOT NULL,
    "loanRef" TEXT NOT NULL,
    "currentRating" INTEGER NOT NULL,
    "loanAmount" REAL NOT NULL,
    "disbursementDate" DATETIME NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'STAGE_1',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "obsPeriod" TEXT NOT NULL,
    "obsDate" DATETIME NOT NULL,
    "rating" INTEGER NOT NULL,
    "defaultFlag" BOOLEAN NOT NULL DEFAULT false,
    "gamma" REAL NOT NULL,
    "loanAmount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingObservation_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ECLForecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentGamma" REAL NOT NULL,
    "regimeWeight" REAL NOT NULL,
    "onePeriodPD" REAL NOT NULL,
    "ecl1Year" REAL NOT NULL,
    "ecl5Year" REAL NOT NULL,
    "eclBaseline" REAL NOT NULL,
    "eclModerateDrought" REAL NOT NULL,
    "eclSevereDrought" REAL NOT NULL,
    "eclWetRecovery" REAL NOT NULL,
    "eclExpected" REAL NOT NULL,
    "lgd" REAL NOT NULL DEFAULT 0.45,
    "discountRate" REAL NOT NULL DEFAULT 0.05,
    CONSTRAINT "ECLForecast_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationMatrix" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matrixType" TEXT NOT NULL,
    "kappa" REAL NOT NULL,
    "gamma0" REAL NOT NULL,
    "matrixData" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DEFAULT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "meanNDVI" REAL NOT NULL,
    "ndviTrend" TEXT NOT NULL,
    "healthStatus" TEXT NOT NULL,
    "avgTemperature" REAL NOT NULL,
    "totalRainfall" REAL NOT NULL,
    "waterStressRisk" BOOLEAN NOT NULL,
    "diseaseRisk" BOOLEAN NOT NULL,
    "gamma" REAL NOT NULL DEFAULT 0,
    "regimeWeight" REAL NOT NULL DEFAULT 0,
    "agriculturalScore" REAL NOT NULL DEFAULT 0,
    "rawData" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analysis_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Analysis" ("avgTemperature", "createdAt", "diseaseRisk", "fieldId", "healthStatus", "id", "meanNDVI", "ndviTrend", "rawData", "recommendations", "totalRainfall", "waterStressRisk") SELECT "avgTemperature", "createdAt", "diseaseRisk", "fieldId", "healthStatus", "id", "meanNDVI", "ndviTrend", "rawData", "recommendations", "totalRainfall", "waterStressRisk" FROM "Analysis";
DROP TABLE "Analysis";
ALTER TABLE "new_Analysis" RENAME TO "Analysis";
CREATE TABLE "new_Field" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "polygon" TEXT NOT NULL,
    "area" REAL,
    "location" TEXT,
    "district" TEXT,
    "borrowerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Field_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Field" ("area", "createdAt", "cropType", "id", "location", "name", "polygon") SELECT "area", "createdAt", "cropType", "id", "location", "name", "polygon" FROM "Field";
DROP TABLE "Field";
ALTER TABLE "new_Field" RENAME TO "Field";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'BORROWER',
    "phone" TEXT,
    "nationalId" TEXT,
    "district" TEXT,
    "primaryActivity" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "password") SELECT "createdAt", "email", "id", "name", "password" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanRef_key" ON "Loan"("loanRef");
