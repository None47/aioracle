# ORACLE AI — Final Integrated Build

This is the actual AI-powered ORACLE build.

## Architecture

ORACLE canonical state (`window.oracleStatePacket()`) → server → AI reasoning → deterministic validator → ACCEPT / MODIFY / REJECT / NEED_INFO → ORACLE UI.

The AI never directly mutates ORACLE state. The API key stays server-side.

## Run

Requires Node.js 18+ (Node 22+ enables SQLite storage).

1. Copy `.env.example` to `.env`.
2. Set `ORACLE_AI_KEY` and `ORACLE_AI_MODEL`.
3. If your provider is OpenAI-compatible, keep `ORACLE_AI_BASE=https://api.openai.com/v1` or change it.
4. Run:

   node server.js --test-mission
   node server.js

5. Open http://127.0.0.1:8787

## AI

Open ORACLE's Intelligence section and ask what you should do. The server reasons over the live canonical packet captured from ORACLE and validates the proposed action before displaying it.

## Verified

- `node --check server.js` passes.
- Mission validator: 9/9 tests pass.
- `/api/health` returns 200.
- `/` serves the integrated ORACLE HTML.
