-- AlterTable
ALTER TABLE "GlycemicEventCluster" ADD COLUMN "insights" JSONB;

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN "treatments" JSONB;
