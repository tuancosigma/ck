module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts"],
  moduleNameMapper: {
    // Map workspace packages to their source so Jest resolves without build step
    "@n8n-clone/shared-types": "<rootDir>/../../packages/shared-types/src/index.ts",
    "@n8n-clone/workflow-core": "<rootDir>/../../packages/workflow-core/src/index.ts",
  },
};
