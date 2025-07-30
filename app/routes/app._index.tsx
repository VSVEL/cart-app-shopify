
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  List,
  InlineStack,
  Badge,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Get all carts
  const allCarts = await prisma.cart.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      tags: true,
    },
  });

  // Separate customer carts and guest carts
  const customerCarts = allCarts.filter(cart => cart.customerEmail);
  const guestCarts = allCarts.filter(cart => !cart.customerEmail);

  // Group carts by customer email
  const customersWithCarts = customerCarts.reduce((acc, cart) => {
    const email = cart.customerEmail!;
    if (!acc[email]) {
      acc[email] = {
        email,
        carts: [],
        totalCarts: 0,
        lastActivity: cart.createdAt,
      };
    }
    acc[email].carts.push(cart);
    acc[email].totalCarts++;
    if (cart.createdAt > acc[email].lastActivity) {
      acc[email].lastActivity = cart.createdAt;
    }
    return acc;
  }, {} as Record<string, { email: string; carts: any[]; totalCarts: number; lastActivity: Date }>);

  return {
    customers: Object.values(customersWithCarts),
    guestCarts,
    totalCustomers: Object.keys(customersWithCarts).length,
    totalCarts: allCarts.length,
    totalGuestCarts: guestCarts.length,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {;
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "refresh") {
    // This could trigger a refresh of customer data from Shopify
    return { success: true };
  }

  return { success: false };
};

export default function Index() {
  const { customers, guestCarts, totalCustomers, totalCarts, totalGuestCarts } = useLoaderData<typeof loader>();

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // const getCartItems = (cart: any) => {
  //   const cartData = cart.cartData as any;
  //   if (!cartData || !cartData.line_items) {
  //     return [];
  //   }
  //   return cartData.line_items.map((item: any) => ({
  //     title: item.title || "Unknown Product",
  //     quantity: item.quantity || 0,
  //     price: item.price || "0.00",
  //   }));
  // };

  const getCartStatus = (cart: any) => {
    switch (cart.status) {
      case "CONVERTED":
        return <Badge tone="success">Converted</Badge>;
      case "ABANDONED":
        return <Badge tone="critical">Abandoned</Badge>;
      default:
        return <Badge tone="attention">Pending</Badge>;
    }
  };

  return (
    <Page>
      <TitleBar title="Customer Cart Analytics">
        <Button
          submit
          variant="primary"
        >
          Refresh Data
        </Button>
      </TitleBar>

      <form id="refresh-form" method="post">
        <input type="hidden" name="action" value="refresh" />
      </form>

      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Customer Cart Overview
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Track your customers and their cart activity to understand shopping behavior.
                  </Text>
                </BlockStack>

                <InlineStack gap="400">
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Total Customers
                      </Text>
                      <Text variant="headingLg" as="p">
                        {totalCustomers}
                      </Text>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Total Carts
                      </Text>
                      <Text variant="headingLg" as="p">
                        {totalCarts}
                      </Text>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Guest Carts
                      </Text>
                      <Text variant="headingLg" as="p">
                        {totalGuestCarts}
                      </Text>
                    </BlockStack>
                  </Card>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Customer Cart Details
                </Text>

                {customers.length === 0 ? (
                  <EmptyState
                    heading="No customer carts found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Customer cart data will appear here once customers start adding items to their carts.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="400">
                    {customers.map((customer) => (
                      <Card key={customer.email}>
                        <BlockStack gap="400">
                          <InlineStack align="space-between">
                            <BlockStack gap="200">
                              <Text variant="headingMd" as="h3">
                                {customer.email}
                              </Text>
                              <Text variant="bodyMd" as="p">
                                {customer.totalCarts} cart{customer.totalCarts !== 1 ? 's' : ''} • Last activity: {formatDate(customer.lastActivity)}
                              </Text>
                            </BlockStack>
                          </InlineStack>

                          <BlockStack gap="300">
                            {customer.carts.map((cart) => (
                              <Card key={cart.id}>
                                <BlockStack gap="300">
                                  <InlineStack align="space-between">
                                    <Text variant="bodyMd" as="p">
                                      Cart ID: {cart.id}
                                    </Text>
                                    {getCartStatus(cart)}
                                  </InlineStack>
                                  
                                  <Text variant="bodyMd" as="p">
                                    Created: {formatDate(cart.createdAt)}
                                  </Text>

                                  {(cart as any).cartData && (cart as any).cartData.line_items && (cart as any).cartData.line_items.length > 0 ? (
                                    <BlockStack gap="200">
                                      <Text variant="headingSm" as="h4">
                                        Cart Items:
                                      </Text>
                                      <List type="bullet">
                                        {(cart as any).cartData.line_items.map((item: any, index: number) => (
                                          <List.Item key={index}>
                                            {item.title} - Qty: {item.quantity} - ${item.price}
                                          </List.Item>
                                        ))}
                                      </List>
                                    </BlockStack>
                                  ) : (
                                    <Text variant="bodyMd" as="p" tone="subdued">
                                      No items in cart
                                    </Text>
                                  )}
                                </BlockStack>
                              </Card>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      </Card>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {guestCarts.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Guest Carts
                  </Text>

                  <BlockStack gap="400">
                    {guestCarts.map((cart) => (
                      <Card key={cart.id}>
                        <BlockStack gap="300">
                          <InlineStack align="space-between">
                            <Text variant="bodyMd" as="p">
                              Cart ID: {cart.id}
                            </Text>
                            {getCartStatus(cart)}
                          </InlineStack>
                          
                          <Text variant="bodyMd" as="p">
                            Created: {formatDate(cart.createdAt)}
                          </Text>

                          {(cart as any).cartData && (cart as any).cartData.line_items && (cart as any).cartData.line_items.length > 0 ? (
                            <BlockStack gap="200">
                              <Text variant="headingSm" as="h4">
                                Cart Items:
                              </Text>
                              <List type="bullet">
                                {(cart as any).cartData.line_items.map((item: any, index: number) => (
                                  <List.Item key={index}>
                                    {item.title} - Qty: {item.quantity} - ${item.price}
                                  </List.Item>
                                ))}
                              </List>
                            </BlockStack>
                          ) : (
                            <Text variant="bodyMd" as="p" tone="subdued">
                              No items in cart
                            </Text>
                          )}
                        </BlockStack>
                      </Card>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}
