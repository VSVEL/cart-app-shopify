import { Kafka } from "kafkajs";
import { checkIfCartConverted } from "./checkOrder";
import { CartPayload, sendAbandonedCartEmail } from "./mailingSerive";


const kafka = new Kafka({
    clientId: "shopify-abandonment-consumer",
    brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "cart-check-group" });

async function start() {
    await consumer.connect();
    await consumer.subscribe({ topic: "shopify-cart-create", fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            if (!message.value) return;

            const cart: CartPayload = JSON.parse(message.value.toString());

            console.log(`Received cart: ${cart.id}. Waiting 4 hours...`);

            // Wait 4 hours
            setTimeout(async () => {
                const isConverted = await checkIfCartConverted(cart);

                if (!isConverted) {
                    console.log(`Cart ${cart.id} is abandoned. Sending email.`);
                    await sendAbandonedCartEmail(cart);
                } else {
                    console.log(`Cart ${cart.id} has been converted.`);
                }
            }, 10000); // 4 hours
        },
    });
}

start().catch(console.error);
