import { Kafka } from "kafkajs";
import { checkIfCartConverted } from "./check_order";
import { CartPayload, sendAbandonedCartEmail } from "./mailing_service";
import prisma from "../db.server";
import cron from "node-cron";

const kafka = new Kafka({
    clientId: "shopify-abandonment-consumer",
    brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "cart-check-group" });

// Function to process abandoned carts
async function processAbandonedCarts() {
    // Find carts that are 4+ hours old, not converted, and not already emailed
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const carts = await prisma.cart.findMany({
        where: {
            status: "PENDING",
            createdAt: { lte: fourHoursAgo },
            emailSentAt: null,
        },
    });

    for (const cart of carts) {
        // cartData may be a string or object
        let cartDataObj: any = {};
        // if (typeof cart.cartData === 'string') {
        //     try {
        //         cartDataObj = JSON.parse(cart.cartData);
        //     } catch {
        //         cartDataObj = {};
        //     }
        // } else if (typeof cart.cartData === 'object' && cart.cartData !== null) {
        //     cartDataObj = cart.cartData;
        // }
        let token = cartDataObj.token || cart.recoveryLink || cart.id;
        let line_items = cartDataObj.line_items || [];
        let customer = { email: cart.customerEmail || undefined };
        const cartPayload = {
            id: cart.id,
            token,
            line_items,
            customer,
            shop: cart.shop,
        };
        const isConverted = await checkIfCartConverted(token, cart.shop);
        if (!isConverted) {
            console.log(`Cart ${cart.id} is abandoned. Sending email.`);
            await sendAbandonedCartEmail(cartPayload);
            await prisma.cart.update({
                where: { id: cart.id },
                data: { emailSentAt: new Date() },
            });
        } else {
            console.log(`Cart ${cart.id} has been converted.`);
        }
    }
}

async function start() {
    await consumer.connect();
    await consumer.subscribe({ topic: "shopify-cart-create", fromBeginning: false });
    // You can still process messages if needed, but main logic is in cron
    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;
            const cart: CartPayload = JSON.parse(message.value.toString());
            console.log(`Received cart: ${cart.id}.`);
        },
    });

    // Run the abandoned cart check every 10 minutes
    cron.schedule("*/10 * * * *", async () => {
        console.log("Running abandoned cart check...");
        await processAbandonedCarts();
    });

    // Run once on startup
    await processAbandonedCarts();
}

start().catch(console.error);
