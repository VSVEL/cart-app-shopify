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
  logger.info("🧪 Access token for shop:", { shop, accessToken: session?.accessToken });
  return session?.accessToken || null;
}

async function getAllCustomers(shop: string, accessToken: string) {
  try {
    const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
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
                defaultPhoneNumber {
                  phoneNumber
                  marketingState
                  marketingCollectedFrom
                }
                createdAt
                updatedAt
                numberOfOrders
                state
                amountSpent {
                  amount
                  currencyCode
                }
                verifiedEmail
                taxExempt
                tags
                addresses {
                  id
                  firstName
                  lastName
                  address1
                  city
                  province
                  country
                  zip
                  phone
                  name
                  provinceCode
                  countryCodeV2
                }
                defaultAddress {
                  id
                  address1
                  city
                  province
                  country
                  zip
                  phone
                  provinceCode
                  countryCodeV2
                }
              }
            }
          }
        `
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      logger.info("✅ Retrieved customers via GraphQL:", {
        count: data.data?.customers?.nodes?.length || 0
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
  
  const customer = customers.find(c => 
    c.defaultEmailAddress?.emailAddress?.toLowerCase() === email.toLowerCase()
  );
  
  if (customer) {
    logger.info("✅ Found customer by email:", {
      id: customer.id,
      email: customer.defaultEmailAddress?.emailAddress,
      name: `${customer.firstName} ${customer.lastName}`
    });
  }
  
  return customer;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ message: "Cart test endpoint ready" });
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

    logger.info("🧪 Testing cart customer identification...");
    
    // Get all customers
    const allCustomers = await getAllCustomers(shop, accessToken);
    
    // Test with a sample email from your customer data
    const testEmail = "sakthivelblogs@gmail.com"; // From your customer data
    const customer = await findCustomerByEmail(allCustomers, testEmail);
    
    if (customer) {
      logger.info("✅ Successfully found customer:", {
        id: customer.id,
        email: customer.defaultEmailAddress?.emailAddress,
        name: `${customer.firstName} ${customer.lastName}`
      });
      
      return json({ 
        success: true, 
        message: "Customer identification test successful",
        customer: {
          id: customer.id,
          email: customer.defaultEmailAddress?.emailAddress,
          firstName: customer.firstName,
          lastName: customer.lastName,
          state: customer.state,
          numberOfOrders: customer.numberOfOrders,
        }
      });
    } else {
      logger.info("❌ Customer not found for test email");
      
      return json({ 
        success: false, 
        message: "Customer not found for test email",
        testEmail,
        availableCustomers: allCustomers.map((c: any) => ({
          id: c.id,
          email: c.defaultEmailAddress?.emailAddress,
          name: `${c.firstName} ${c.lastName}`
        }))
      });
    }
  } catch (error) {
    logger.error("❌ Error testing cart customer identification:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}; 