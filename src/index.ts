import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import TurndownService from 'turndown';
import 'dotenv/config';

const app = new Hono();
const turndown = new TurndownService();

// --- IDE ÍRD A SAJÁT TÁRCACÍMEDET ---
const RECEIVER_ADDRESS = "0xA933C181f5d812Fb46B397519c51704e6b22cffE";

// 1. Facilitator kliens létrehozása (xpay - támogatja a Base Mainnet-et)
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.xpay.sh"
});

// 2. Resource server létrehozása és az EVM séma regisztrálása
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme()); // Base mainnet

// 3. Fizetési middleware hozzáadása
app.use(
  paymentMiddleware(
    {
      "GET /api/extract": {
        accepts: {
          scheme: "exact",
          price: "$0.01",
          network: "eip155:8453",
          payTo: RECEIVER_ADDRESS,
        },
        description: "HTML to Markdown extraction API",
      },
    },
    resourceServer
  )
);

// A védett végpont
app.get('/api/extract', async (c) => {
  const targetUrl = c.req.query('url');

  if (!targetUrl) {
    return c.json({ error: 'Missing url parameter' }, 400);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return c.json({ error: `Failed to fetch: ${response.status}` }, 500);
    }

    const html = await response.text();
    const markdown = turndown.turndown(html);

    return c.json({
      success: true,
      url: targetUrl,
      markdown: markdown
    });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);
console.log(`Payment address: ${RECEIVER_ADDRESS}`);

serve({
  fetch: app.fetch,
  port
});