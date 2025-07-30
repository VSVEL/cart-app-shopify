export async function checkIfCartConverted(cartToken: string, shop: string): Promise<boolean> {
    const endpoint = `https://${shop}/admin/api/2024-04/graphql.json`;
  
    const query = `
      {
        orders(first: 1, query: "cart_token:${cartToken}") {
          edges {
            node {
              id
              name
              createdAt
            }
          }
        }
      }
    `;
  
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
  
    const result = await response.json();
  
    const orders = result?.data?.orders?.edges || [];
  
    return orders.length > 0;
  }
  