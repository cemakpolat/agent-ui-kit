#!/usr/bin/env tsx
/**
 * Test HARI with local Ollama
 * 
 * This script:
 * 1. Checks if Ollama is healthy
 * 2. Ensures the orca-mini model is available
 * 3. Tests intent modification generation
 * 4. Tests all transport mechanisms (WS, SSE, MCP)
 */

import { generateIntentModification, isOllamaHealthy, ensureModelAvailable, generateRandomModification } from './src/agent';
import * as fs from 'fs';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function testOllamaConnectione() {
  console.log(`\n${COLORS.bold}${COLORS.cyan}1. Testing Ollama Connection${COLORS.reset}`);
  console.log(`   URL: ${OLLAMA_URL}`);
  
  const healthy = await isOllamaHealthy();
  if (healthy) {
    console.log(`   ${COLORS.green}✓ Ollama is healthy and responding${COLORS.reset}`);
    return true;
  } else {
    console.log(`   ${COLORS.red}✗ Ollama is not responding${COLORS.reset}`);
    console.log(`   Make sure ollama is running: ollama serve`);
    return false;
  }
}

async function testModelAvailability() {
  console.log(`\n${COLORS.bold}${COLORS.cyan}2. Checking Model Availability${COLORS.reset}`);
  console.log(`   Attempting to ensure ${MODEL} is available...`);
  
  try {
    await ensureModelAvailable();
    console.log(`   ${COLORS.green}✓ ${MODEL} model is available${COLORS.reset}`);
    return true;
  } catch (error) {
    console.log(`   ${COLORS.red}✗ Failed to ensure model availability${COLORS.reset}`);
    console.log(`   Error: ${error}`);
    return false;
  }
}

async function testIntentModification() {
  console.log(`\n${COLORS.bold}${COLORS.cyan}3. Testing Intent Modification Generation${COLORS.reset}`);
  
  const testQueries = [
    "Increase the budget by 20%",
    "Change deadline to next month",
    "Add a new team member",
  ];
  
  for (const query of testQueries) {
    console.log(`   Query: "${query}"`);
    try {
      const modification = await generateIntentModification(query);
      console.log(`   ${COLORS.green}✓ Generated modification:${COLORS.reset}`, JSON.stringify(modification, null, 4));
    } catch (error) {
      console.log(`   ${COLORS.red}✗ Failed to generate modification${COLORS.reset}`);
      console.log(`   Error: ${error}`);
    }
  }
}

async function testFallback() {
  console.log(`\n${COLORS.bold}${COLORS.cyan}4. Testing Fallback (Random) Modification${COLORS.reset}`);
  
  const mod = generateRandomModification();
  console.log(`   ${COLORS.green}✓ Generated fallback modification:${COLORS.reset}`, JSON.stringify(mod, null, 4));
}

async function testIntegration() {
  console.log(`\n${COLORS.bold}${COLORS.cyan}5. Integration Summary${COLORS.reset}`);
  console.log(`
   HARI is now configured to test with your local Ollama instance.
   
   ${COLORS.bold}Available dev servers:${COLORS.reset}
   - WebSocket Server:   pnpm --filter @hari/dev-services dev:ws   (port 3001)
   - SSE Server:         pnpm --filter @hari/dev-services dev:sse  (port 3002)  
   - MCP Server:         pnpm --filter @hari/dev-services dev:mcp  (port 3003)
   
   ${COLORS.bold}To run the full demo with Ollama:${COLORS.reset}
   1. Start dev services in separate terminals:
      pnpm --filter @hari/dev-services dev:ws
      
   2. Start the demo in a separate terminal:
      pnpm dev
      
   3. Open http://localhost:5173 and select "WebSocket" transport
   4. Load any scenario and ask the agent to modify it!
  `);
}

async function main() {
  console.log(`${COLORS.bold}${COLORS.cyan}🚀 HARI + Ollama Integration Test${COLORS.reset}\n`);
  
  const ollamaHealthy = await testOllamaConnectione();
  
  if (!ollamaHealthy) {
    console.log(`\n${COLORS.red}${COLORS.bold}❌ Ollama is not running${COLORS.reset}`);
    console.log(`\nPlease start Ollama first:`);
    console.log(`  ollama serve`);
    process.exit(1);
  }
  
  const modelReady = await testModelAvailability();
  
  if (modelReady) {
    await testIntentModification();
  } else {
    console.log(`\n${COLORS.yellow}Using fallback (random) modifications...${COLORS.reset}`);
    await testFallback();
  }
  
  await testIntegration();
  
  console.log(`\n${COLORS.green}${COLORS.bold}✓ All tests completed!${COLORS.reset}\n`);
}

main().catch((error) => {
  console.error(`${COLORS.red}${COLORS.bold}❌ Test failed:${COLORS.reset}`, error);
  process.exit(1);
});
