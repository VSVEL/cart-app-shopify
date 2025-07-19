import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
//import { Kafka } from "kafkajs";
import type { ActionFunctionArgs } from "@remix-run/node";
import logger from "app/logger";
import { createHmac } from "crypto";

// const kafka = new Kafka({
//   clientId: "shopify-app",
//   brokers: ["localhost:9092"],
// });

// const producer = kafka.producer();
// await producer.connect();

export const action = async ({ request }: ActionFunctionArgs) => {
  logger.info("🛎️ Incoming webhook to /webhooks/cart-create");

  try {
    console.log(request.headers.get("x-shopify-shop-domain"));
    console.log(request.headers.get("x-shopify-hmac-sha256"));
    console.log(request.headers.get("content-type"));
    console.log(request.headers.get("x-shopify-topic"));
    console.log(request.headers.get("x-shopify-webhook-id"));
    console.log(Object.fromEntries(request.headers.entries()));
    console.log("Request URL:", request.url);
    console.log("Request Method:", request.method); 
    console.log("Request Body:", await request.text());
    // Extract HMAC and raw body
    // const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "";
    // if (!SHOPIFY_API_SECRET) {
    //   throw new Error("SHOPIFY_API_SECRET is not set");
    // }
    // const hmac = request.headers.get("x-shopify-hmac-sha256");
    const rawBody = await request.text();
    if (!request.headers.get("x-shopify-hmac-sha256")) {
      throw new Error("Missing HMAC header");
    }   
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Invalid content type, expected application/json");
    }
    if (!request.headers.get("x-shopify-topic")) {
      throw new Error("Missing x-shopify-topic header");
    }
    if (!request.headers.get("x-shopify-webhook-id")) {
      throw new Error("Missing x-shopify-webhook-id header");
    }
    if (!request.headers.get("x-shopify-shop-domain")) {
      throw new Error("Missing x-shopify-shop-domain header");
    }
      
    // Validate HMAC
    const hmac = request.headers.get("x-shopify-hmac-sha256") || "";
    // const hmac = request.headers.get("x-shopify-hmac-sha256");
    // if (!hmac) {
    //   throw new Error("Missing HMAC header");
    // }  
    // if (!rawBody) {
    //   throw new Error("Missing request body");
    // }
    // if (!SHOPIFY_API_SECRET) {
    //   throw new Error("SHOPIFY_API_SECRET is not set");
    // }
    const generatedHmac = createHmac("sha256", process.env.SHOPIFY_API_SECRET || "")
      .update(rawBody, "utf8") 
      .digest("base64");
    if (hmac !== generatedHmac) {
      throw new Error("HMAC validation failed");
    }
    // Log headers and body for debugging
    logger.info("🧾 Headers:", Object.fromEntries(request.headers.entries()));

    // Important: Validate HMAC manually (if needed)
    // const generatedHmac = createHmac("sha256", SHOPIFY_API_SECRET)
    //   .update(rawBody, "utf8")
    //   .digest("base64");

    logger.info("📦 Raw Body:", rawBody);
    logger.info("🧾 Headers:", Object.fromEntries(request.headers.entries()));
    logger.info("🔐 HMAC:", hmac);

    const reRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: rawBody,
    });

    const { topic, shop, payload } = await authenticate.webhook(reRequest);

    logger.info(`🔔 Webhook topic: ${topic}, shop: ${shop}`);

    const cartId = payload.id;
    const customerEmail = payload.customer?.email ?? null;
    const isGuest = !customerEmail;
    const createdAt = new Date().toISOString();

    logger.info(
      {
        cartId,
        customerEmail: customerEmail || "guest",
        isGuest,
        shop,
        createdAt,
      },
      "Received new cart",
    );

    // await producer.send({
    //   topic: "carts",
    //   messages: [
    //     {
    //       key: String(cartId),
    //       value: JSON.stringify({
    //         cart: payload,
    //         shop,
    //         createdAt,
    //       }),
    //     },
    //   ],
    // });

    logger.info("📤 Cart data sent to Kafka topic `carts`");
    return json({ success: true });
  } catch (error) {
    logger.error("❌ Error processing webhook", {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return json({ success: false }, { status: 500 });
  }
};
