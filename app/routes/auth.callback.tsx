import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { registerCartWebhook } from "./webhooks.registerwebhook";
import logger from "app/logger";
import { exchangeCodeForToken } from "app/utils/shopify";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const code = url.searchParams.get("code");

  if (!shop || !code) {
    throw new Response("Missing shop or code", { status: 400 });
  }

  // 🔐 Exchange for access token
  const accessToken = await exchangeCodeForToken(shop, code); // your implementation

  // ✅ Register webhook
  try {
    await registerCartWebhook(shop, accessToken);
    logger.info(`✅ carts/create webhook registered for ${shop}`);
  } catch (err) {
    logger.error(err, "❌ Failed to register carts/create webhook");
  }

  return redirect(`/app?shop=${shop}`);
};
