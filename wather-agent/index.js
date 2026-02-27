import 'dotenv/config';
import { google } from '@ai-sdk/google';
import { ToolLoopAgent, tool } from 'ai';
import axios from 'axios';
import { z } from 'zod';

const GetWeatherResultSchema = z.object({
    city: z.string().describe("name of city"),
    degree_c: z.number().describe("the dgree celcius"),
    condition: z.string().describe("condition of the weather")
})

const weatherAgent = tool({
  description: "Get the weather in a city (in Celcius)",
  inputSchema: z.object({
    city: z.string().describe("The city to get the weather for")
  }),
  execute: async ({ city }) => {
    const url = `https://wttr.in/${city.toLowerCase()}?format=%C+%t`;

    const response = await axios.get(url, {
      responseType: "text"
    });

    return `The weather of ${city} is ${response.data}`
  },
  outputSchema: GetWeatherResultSchema
});

const nickAi = new ToolLoopAgent({
  model: google("gemini-2.5-flash"),
  tools: { getWeather: weatherAgent },
  
});

async function main() {
  const result = await nickAi.generate({
    prompt: "What is the weather in Sardarshahar,Rajasthan?"
  });

  console.log(result.text);
}

main();
