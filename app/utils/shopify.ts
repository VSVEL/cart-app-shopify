// app/utils/shopify.ts
export async function exchangeCodeForToken(shop: string, code: string) {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: process.env.SHOPIFY_API_KEY!,
            client_secret: process.env.SHOPIFY_API_SECRET!,
            code,
        }),
    });

    if (!res.ok) {
        throw new Error("Failed to exchange code for token");
    }

    const json = await res.json();
    return json.access_token as string;
}
