/**
 * Vercel AI Gateway example.
 *
 * The AI SDK routes a bare "provider/model" string through the Gateway, so no
 * provider SDK is needed — it reads AI_GATEWAY_API_KEY from the environment.
 * That key lives in .env.local, which is gitignored and must stay that way.
 *
 * Run: node --env-file=.env.local --experimental-strip-types index.ts
 */
import { generateText } from "ai";

const { text } = await generateText({
  model: "openai/gpt-5.5",
  prompt:
    "Invent a new holiday and describe its traditions. Give it a name, say when it falls and why, and describe three things people do to celebrate it.",
});

console.log(text);
