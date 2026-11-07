-- AlterTable: Add status column to patients with default 'Active'
ALTER TABLE "patients" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Active';

