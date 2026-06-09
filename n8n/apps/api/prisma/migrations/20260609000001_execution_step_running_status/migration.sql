-- Add RUNNING value to StepStatus enum
ALTER TYPE "StepStatus" ADD VALUE IF NOT EXISTS 'RUNNING';

-- Make durationMs nullable (was non-nullable, needs to be null while node is RUNNING)
ALTER TABLE "ExecutionStep" ALTER COLUMN "durationMs" DROP NOT NULL;

-- Add startedAt column to track when a node began executing
ALTER TABLE "ExecutionStep" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

-- Add unique constraint on (executionId, nodeId) to support upsert operations
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_executionId_nodeId_key"
  UNIQUE ("executionId", "nodeId");
