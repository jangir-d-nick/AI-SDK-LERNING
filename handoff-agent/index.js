import "dotenv/config";
import { google } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";

const plans = [
  { plan_id: "1", price_inr: 399, speed: "30 Mbps" },
  { plan_id: "2", price_inr: 499, speed: "35 Mbps" },
  { plan_id: "3", price_inr: 999, speed: "60 Mbps" },
  { plan_id: "4", price_inr: 2999, speed: "180 Mbps" },
];

const fetchAvailablePlans = tool({
  description: "Fetch the available broadband internet plans",
  parameters: z.object({}),
  execute: async () => plans,
});

const processRefund = tool({
  description: "Process a refund for a customer",
  parameters: z.object({
    customerId: z.string().describe("ID of the customer"),
    reason: z.string().describe("Reason for refund"),
  }),
  execute: async ({ customerId, reason }) => {
    await fs.appendFile(
      "./refunds.txt",
      `Refund issued | Customer: ${customerId} | Reason: ${reason}\n`,
      "utf-8"
    );
    return { refundIssued: true, message: "Refund processed successfully" };
  },
});

const salesTools = { fetchAvailablePlans, processRefund };
const refundTools = { processRefund };

const SALES_SYSTEM = `
You are an expert sales agent for a broadband internet company.
Talk naturally, help users choose plans or answer questions about pricing/speed.
If the user wants a refund → tell them you'll transfer them to the refund team.
`;

const REFUND_SYSTEM = `
You are an expert in issuing refunds to customers.
Ask for customer ID and reason if not provided.
Only use the processRefund tool when you have both customerId and reason.
Be polite and professional.
`;

async function handleMessage(userMessage) {
  let currentAgent = "reception"; // "reception", "sales", "refund"
  let history = [{ role: "user", content: userMessage }];

  for (let step = 0; step < 12; step++) {  // prevent infinite loop
    let systemPrompt;
    let tools;

    if (currentAgent === "reception") {
      systemPrompt = `
You are a smart receptionist for a broadband company.

Decide quickly:
- If user asks about plans, pricing, speed, new connection → reply with: → handoff:sales
- If user wants refund, cancellation, billing issue → reply with: → handoff:refund
- Otherwise just answer normally.

Always end your response with one of these three lines:
→ handoff:sales
→ handoff:refund
→ answer:Yes, I can help with that!
      `;
      tools = {};
    } else if (currentAgent === "sales") {
      systemPrompt = SALES_SYSTEM;
      tools = salesTools;
    } else {
      systemPrompt = REFUND_SYSTEM;
      tools = refundTools;
    }

    const { text, toolResults, toolCalls } = await generateText({
      model: google("gemini-2.5-flash"), // ← use real model name
      system: systemPrompt,
      messages: history,
      tools,
      maxTokens: 600,
      temperature: 0.7,
    });

    history.push({ role: "assistant", content: text });

    // Handle handoff → DO NOT use role: "system" after first message!
    if (text.includes("handoff:sales")) {
      currentAgent = "sales";
      history.push({
        role: "user",
        content: "✨ [Transferred to Sales Team — helping you find the perfect broadband plan]",
      });
      continue;
    }
    if (text.includes("handoff:refund")) {
      currentAgent = "refund";
      history.push({
        role: "user",
        content: "🔄 [Transferred to Refund Department — we’ll process your refund right away]",
      });
      continue;
    }

    // Normal tool calling loop
    if (toolCalls?.length > 0) {
      for (const toolCall of toolCalls) {
        // execute tool → Vercel AI SDK style
        const result = await toolCall.execute(toolCall.args);
        history.push({
          role: "tool",
          toolCallId: toolCall.id,
          content: JSON.stringify(result),
        });
      }
      continue; // let model see tool results
    }

    // Final answer
    return text;
  }

  return "Sorry, I got stuck. Can you please rephrase your question?";
}

// Usage
async function main() {
  const result = await handleMessage("Hey there, Can you tell me what plan is best for me?");
  console.log("Final answer:", result);
}

main().catch(console.error);


