import nodemailer from "nodemailer";

// Define CartPayload type (adjust fields as needed)
export interface CartPayload {
    id: string;
    token: string;
    line_items: Array<any>;
    customer?: {
        email?: string;
    };
    shop: string;
}


export async function sendAbandonedCartEmail(cart: CartPayload) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const firstItem = cart.line_items?.[0]?.title || "your cart";

    const mailOptions = {
        from: `"Shopify Store" <${process.env.EMAIL_USER}>`,
        to: cart.customer?.email || "customer@example.com", // fallback
        subject: "You left something in your cart!",
        html: `
      <p>Hey there!</p>
      <p>Looks like you left <strong>${firstItem}</strong> in your cart.</p>
      <p><a href="https://${cart.shop}/cart/${cart.token}">Complete your purchase</a> now!</p>
    `,
    };

    await transporter.sendMail(mailOptions);
}