import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import logger from "app/logger";
import prisma from "../db.server";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Text,
  BlockStack,
  Spinner,
  EmptyState,
} from "@shopify/polaris";

async function getAccessTokenForShop(shop: string): Promise<string | null> {
  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
    orderBy: { expires: "desc" },
  });
  logger.info("🧪 Access token for shop:", { shop, accessToken: session?.accessToken });
  return session?.accessToken || null;
}

async function getAllCustomers(shop: string, accessToken: string) {
  try {
    const response = await fetch(`https:///admin/api/2025-07/graphql.json`, {
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const shop = (admin as any)?.session?.shop;
  if (!shop) {
    return json({ success: false, error: "Shop not found in session" }, { status: 400 });
  }
  try {
    const accessToken = await getAccessTokenForShop(shop);
    
    if (!accessToken) {
      return json({ 
        success: false, 
        error: "No access token found for shop" 
      }, { status: 500 });
    }

    logger.info("🧪 Testing GraphQL customer data retrieval...");
    
    const customers = await getAllCustomers(shop, accessToken);
    
    if (customers.length > 0) {
      logger.info("✅ Successfully retrieved customers via GraphQL");
      
      return json({ 
        success: true, 
        message: "Customer data retrieved successfully via GraphQL",
        customers: customers.map((c: any) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.defaultEmailAddress?.emailAddress,
          phone: c.defaultPhoneNumber?.phoneNumber,
          numberOfOrders: c.numberOfOrders,
          state: c.state,
          verifiedEmail: c.verifiedEmail,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
        total: customers.length
      });
    } else {
      logger.info("ℹ️ No customers found");
      
      return json({ 
        success: true, 
        message: "No customers found",
        customers: [],
        total: 0
      });
    }
  } catch (error) {
    logger.error("❌ Error getting customer data:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}; 



export default function AllCustomers() {
  const data = useLoaderData<typeof loader>() as any;
  const customers = data?.customers || [];
  const loading = typeof customers === 'undefined';

  const rows = customers.map((c: any) => [
    c.firstName || "-",
    c.lastName || "-",
    c.email || "-",
    c.phone || "-",
    c.numberOfOrders?.toString() || "0",
    c.state || "-",
    c.verifiedEmail ? "Yes" : "No",
    new Date(c.createdAt).toLocaleDateString(),
    new Date(c.updatedAt).toLocaleDateString(),
  ]);

  return (
    <Page title="All Customers">
      <BlockStack gap="400">
        <Card>
          <Text variant="headingMd" as="h2">All Customers in this Shopify App</Text>
          {loading ? (
            <Spinner accessibilityLabel="Loading customers" size="large" />
          ) : customers.length === 0 ? (
            <EmptyState heading="No customers found" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
              <p>No customers are present in this Shopify app yet.</p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "numeric", "text", "text", "text", "text"]}
              headings={["First Name", "Last Name", "Email", "Phone", "Orders", "State", "Verified Email", "Created At", "Updated At"]}
              rows={rows}
            />
          )}
        </Card>
      </BlockStack>
    </Page>
  );
} 