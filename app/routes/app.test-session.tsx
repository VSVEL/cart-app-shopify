import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import logger from "app/logger";
import prisma from "../db.server";

async function getAccessTokenForShop(shop: string): Promise<string | null> {
  const session = await prisma.session.findFirst({
    where: { shop },
    orderBy: { expires: "desc" },
  });
  return session?.accessToken || null;
}

async function getCustomerFromSession(shop: string, accessToken: string) {
  try {
    const response = await fetch(`https://${shop}/admin/api/2025-07/customers/current.json`, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.customer;
    }
  } catch (err) {
    logger.error("❌ Failed to get customer from session", { error: err });
  }
  return null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ message: "Session test endpoint ready" });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Get shop from the admin context
    const shop = (admin as any).session?.shop || "unknown-shop";
    const accessToken = await getAccessTokenForShop(shop);
    
    if (!accessToken) {
      return json({ 
        success: false, 
        error: "No access token found for shop" 
      }, { status: 500 });
    }

    logger.info("🧪 Testing session-based customer identification...");
    
    const customerDetails = await getCustomerFromSession(shop, accessToken);
    
    if (customerDetails) {
      logger.info("✅ Found customer from session:", {
        email: customerDetails.email,
        id: customerDetails.id,
        name: `${customerDetails.first_name} ${customerDetails.last_name}`
      });
      
      return json({ 
        success: true, 
        message: "Customer found in session",
        customer: {
          email: customerDetails.email,
          id: customerDetails.id,
          name: `${customerDetails.first_name} ${customerDetails.last_name}`
        }
      });
    } else {
      logger.info("ℹ️ No customer found in session");
      
      return json({ 
        success: true, 
        message: "No customer found in session - this is normal for guest carts",
        customer: null
      });
    }
  } catch (error) {
    logger.error("❌ Error testing session:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}; 