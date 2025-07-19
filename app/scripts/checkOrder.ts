export async function checkIfCartConverted(cart: any): Promise<boolean> {
    // TODO: Save/store token → order mappings to identify
    const ordersUrl = `https://${cart.shop}/admin/api/2024-04/orders.json?status=any`;

    const res = await fetch(ordersUrl, {
        headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!,
        },
    });

    const data = await res.json();
    const orders = data.orders || [];

    return orders.some((order: any) => order.cart_token === cart.token);
}

