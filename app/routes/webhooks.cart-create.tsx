import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
//import { Kafka } from "kafkajs";
import type { ActionFunctionArgs } from "@remix-run/node";
import logger from "app/logger";

// const kafka = new Kafka({
//   clientId: "shopify-app",
//   brokers: ["localhost:9092"],
// });

// const producer = kafka.producer();
// await producer.connect();

export const action = async ({ request }: ActionFunctionArgs) => {
  logger.info("🛎️ Incoming webhook to /webhooks/cart-create");

  try {
    // The authenticate.webhook function handles HMAC validation,
    // body parsing, and returns the topic, shop, and payload.
    const { topic, shop, payload } = await authenticate.webhook(request);

    // If the code reaches here, the webhook is authentic.
    logger.info(`✅ Webhook validated. Topic: ${topic}, Shop: ${shop}`);

    // Your business logic starts here
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

    // logger.info("📤 Cart data sent to Kafka topic `carts`");
    return json({ success: true });
  } catch (error) {
    // The library throws an error if validation fails.
    // Log the detailed error to see what went wrong.
    logger.error("❌ Error processing webhook", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Respond with a 401 Unauthorized if it's an authentication error
    if (error instanceof Response) {
      return error;
    }

    return json({ success: false }, { status: 500 });
  }
};
