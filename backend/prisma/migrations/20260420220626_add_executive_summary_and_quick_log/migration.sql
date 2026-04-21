-- AlterTable
ALTER TABLE "GlycemicEventCluster" ADD COLUMN "quickLogSuggestions" JSONB;

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN "executiveSummary" JSONB;
