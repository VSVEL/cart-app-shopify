import prisma from "../db.server";

async function seedTestData() {
  console.log("🌱 Seeding test data...");

  // Sample cart data
  const testCarts = [
    {
      id: "test-cart-1",
      shop: "test-shop.myshopify.com",
      customerEmail: "customer1@example.com",
      isGuest: false,
      createdAt: new Date(),
      status: "PENDING" as const,
      cartData: {
        id: "test-cart-1",
        line_items: [
          {
            title: "Test Product 1",
            quantity: 2,
            price: "29.99",
          },
          {
            title: "Test Product 2",
            quantity: 1,
            price: "49.99",
          },
        ],
      },
    },
    {
      id: "test-cart-2",
      shop: "test-shop.myshopify.com",
      customerEmail: "customer1@example.com",
      isGuest: false,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: "CONVERTED" as const,
      cartData: {
        id: "test-cart-2",
        line_items: [
          {
            title: "Premium Product",
            quantity: 1,
            price: "99.99",
          },
        ],
      },
    },
    {
      id: "test-cart-3",
      shop: "test-shop.myshopify.com",
      customerEmail: "customer2@example.com",
      isGuest: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      status: "ABANDONED" as const,
      cartData: {
        id: "test-cart-3",
        line_items: [
          {
            title: "Abandoned Product",
            quantity: 3,
            price: "19.99",
          },
        ],
      },
    },
    {
      id: "test-cart-4",
      shop: "test-shop.myshopify.com",
      customerEmail: null,
      isGuest: true,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      status: "PENDING" as const,
      cartData: {
        id: "test-cart-4",
        line_items: [
          {
            title: "Guest Product",
            quantity: 1,
            price: "39.99",
          },
        ],
      },
    },
  ];

  try {
    // Clear existing test data
    await prisma.cart.deleteMany({
      where: {
        id: {
          startsWith: "test-cart-",
        },
      },
    });

    // Insert test data
    for (const cart of testCarts) {
      await prisma.cart.create({
        data: cart,
      });
    }

    console.log("✅ Test data seeded successfully!");
    console.log(`📊 Created ${testCarts.length} test carts`);
  } catch (error) {
    console.error("❌ Error seeding test data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedTestData(); 