import "dotenv/config"
import { google } from "@ai-sdk/google"
import { tool, ToolLoopAgent } from "ai"
import { z } from "zod"
import fs from "node:fs/promises"

const plans = [
  { plan_id: "1", price_inr: 399, speed: "30 Mbps" },
  { plan_id: "2", price_inr: 499, speed: "35 Mbps" },
  { plan_id: "3", price_inr: 999, speed: "60 Mbps" },
  { plan_id: "4", price_inr: 2999, speed: "180 Mbps" },
]

const fetchAvailablePlans = tool({
  name: "fetch_available_plans",
  description: "Fetch the available broadband internet plans",
  parameters: z.object({}).optional(), // Fixed: Added proper schema
  execute: async () => plans,
})

const processRefund = tool({
  name: "process_refund",
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
    )
    return { refundIssued: true }
  },
})

const refundAgent = new ToolLoopAgent({
  name: "Refund Agent",
  model: google("gemini-2.5-flash"),
  instructions: "You are an expert in issuing refunds to customers.",
  tools: { processRefund },
})

const agentAI = new ToolLoopAgent({
  name: "Sales Agent",
  model: google("gemini-2.5-flash"),
  instructions:
    "You are an expert sales agent for a broadband internet company. Talk naturally and help users choose plans or handle refund requests.",
  tools: {
    fetchAvailablePlans,processRefund
  },
})

async function main() {
  const result = await agentAI.generate({
    prompt: "I had a plan 399. I need a refund right now. my cus id is cust123 because of I am Shifting to a new place",
  })
  console.log(result.text)
}

main().catch(console.error)
