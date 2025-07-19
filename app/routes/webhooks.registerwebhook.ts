export async function registerCartWebhook(shop: string, accessToken: string) {
    const response = await fetch(`https://${shop}/admin/api/2024-04/webhooks.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
            webhook: {
                topic: "carts/create",
                address: "https://cart-app-dollar.trycloudflare.com/webhooks/cart-create",
                format: "json",
            },
        }),
    });

    const data = await response.json();
    console.log("Webhook registration response:", data);
}
