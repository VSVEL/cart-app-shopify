import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs } from "@remix-run/node";
import logger from "app/logger";
import prisma from "../db.server";
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "shopify-cart-producer",
  brokers: ["localhost:9092"], // Or your broker address
});

const producer = kafka.producer();
await producer.connect();

// async function getAccessTokenForShop(shop: string): Promise<string | null> {
//   // Find the most recent session for the shop
//   const session = await prisma.session.findFirst({
//     where: { shop, isOnline: false },
//     orderBy: { expires: "desc" },
//   });
//   return session?.accessToken || null;
// }

async function getAllCustomers(shop: string, accessToken: string) {
  try {
    const response = await fetch(
      `https://cart-app-dollarlab.myshopify.com/admin/api/2025-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": "shpua_c9432c41ce349aad3194c80f25a719c4",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
          query CustomerList {
            customers(first: 50) {
              nodes {
                id
                firstName
                lastName
                defaultEmailAddress {
                  emailAddress
                  marketingState
                }
                createdAt
                updatedAt
              }
            }
          }
        `,
        }),
      },
    );

    if (response.ok) {
      const data = await response.json();
      logger.info("✅ Retrieved customers via GraphQL:", {
        count: data.data?.customers?.nodes?.length || 0,
      });
      return data.data?.customers?.nodes || [];
    }
  } catch (err) {
    logger.error("❌ Failed to get customers via GraphQL", { error: err });
  }
  return [];
}

async function findCustomerByEmail(customers: any[], email: string) {
  if (!email) return null;

  const customer = customers.find(
    (c) =>
      c.defaultEmailAddress?.emailAddress?.toLowerCase() ===
      email.toLowerCase(),
  );

  if (customer) {
    logger.info("✅ Found customer by email:", {
      id: customer.id,
      email: customer.defaultEmailAddress?.emailAddress,
      name: `${customer.firstName} ${customer.lastName}`,
    });
  }

  return customer;
}

async function updateCustomerDetails(
  shop: string,
  customerId: string,
  accessToken: string,
  customerData: any,
) {
  try {
    const response = await fetch(
      `https://cart-app-dollarlab.myshopify.com/admin/api/2025-07/customers/${customerId}.json`,
      {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: {
            id: customerId,
            email: customerData.email,
            first_name: customerData.first_name,
            last_name: customerData.last_name,
          },
        }),
      },
    );

    if (response.ok) {
      const data = await response.json();
      logger.info("✅ Updated customer details:", data.customer);
      return data.customer;
    }
  } catch (err) {
    logger.error("❌ Failed to update customer details", { error: err });
  }
  return null;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  logger.info("header", request.headers);
  logger.info("🛎️ Incoming webhook to /webhooks/cart-update");

  try {
    // The authenticate.webhook function handles HMAC validation,
    // body parsing, and returns the topic, shop, and payload.
    const { topic, shop, payload } = await authenticate.webhook(request);

    // If the code reaches here, the webhook is authentic.
    logger.info(`✅ Webhook validated. Topic: ${topic}, Shop: ${shop}`);
    logger.info("📦 Cart payload:", payload);

    const cartId = payload.id;
    const cartToken = payload.token;
    const createdAt = new Date();

    // Step 1: Get all customers via GraphQL
    let customerEmail = null;
    let customerDetails = null;
    let customerId = null;

    const accessToken = "shpua_c9432c41ce349aad3194c80f25a719c4";
    logger.info("🔍 Access token:", accessToken);
    if (accessToken) {
      try {
        const allCustomers = await getAllCustomers(shop, accessToken);

        // Step 2: Try to find customer by email from cart data
        // Check multiple possible email fields in the cart payload
        const possibleEmails = [
          payload.customer?.email,
          payload.customer_email,
          payload.user?.email,
          payload.attributes?.email,
          payload.note?.email,
          payload.email,
          payload.user_email,
        ].filter(Boolean); // Remove null/undefined values

        logger.info(
          "🔍 Checking possible emails from cart payload:",
          possibleEmails,
        );
        logger.info("📦 Full cart payload structure:", {
          payloadKeys: Object.keys(payload),
          customer: payload.customer,
          user: payload.user,
          attributes: payload.attributes,
          note: payload.note,
        });

        for (const email of possibleEmails) {
          const customer = await findCustomerByEmail(allCustomers, email);
          if (customer) {
            customerEmail = customer.defaultEmailAddress?.emailAddress;
            customerDetails = customer;
            customerId = customer.id;
            break;
          }
        }

        if (customerDetails) {
          logger.info("✅ Found customer from GraphQL data:", {
            email: customerEmail,
            id: customerId,
            name: `${customerDetails.firstName} ${customerDetails.lastName}`,
          });
        } else {
          logger.info(
            "ℹ️ No customer found for cart - this might be a guest cart",
          );
        }
      } catch (err) {
        logger.error("❌ Failed to get customers or find customer", {
          error: err,
        });
      }
    } else {
      logger.error("❌ No access token found for shop", { shop });
    }

    // Step 3: If we have customer details, update them
    if (customerDetails && customerId) {
      try {
        await updateCustomerDetails(
          shop,
          customerId,
          accessToken!,
          customerDetails,
        );
        logger.info("✅ Customer details updated successfully");
      } catch (err) {
        logger.error("❌ Failed to update customer details", { error: err });
      }
    }

    // Step 4: Handle cart data
    const isGuest = !customerEmail;

    logger.info("🔍 Final customer identification:", {
      customerEmail,
      customerId,
      isGuest,
      cartId,
      cartToken,
    });

    // Store cart data in database
    await (prisma.cart as any).upsert({
      where: { id: cartId },
      update: {
        customerEmail,
        isGuest,
        status: "PENDING",
      },
      create: {
        id: cartId,
        shop,
        customerEmail,
        isGuest,
        createdAt,
        status: "PENDING",
      },
    });

    const cartPayload = {        
      id: cartId,
        shop,
        customerEmail,
        isGuest,
        createdAt,
        status: "PENDING",}

    await producer.send({
      topic: "shopify-cart-create",
      messages: [{ value: JSON.stringify(cartPayload) }],
    });

    logger.info(
      "📤 Sent cart to Kafka topic: shopify-cart-create",
      cartPayload,
    );

    logger.info(
      {
        cartId,
        customerEmail,
        isGuest: !customerEmail,
        shop,
        createdAt,
      },
      "✅ Updated cart in database",
    );

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
