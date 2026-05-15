import client from "@repo/db/client";

/**
 * Dispatches an event to all webhooks registered by the user that listen for this event type.
 */
export async function fireWebhook(userId: string, eventType: string, payload: any) {
  try {
    // Find webhooks for this user that want this event
    const webhooks = await client.webhook.findMany({
      where: { userId },
    });

    const relevantWebhooks = webhooks.filter(wh => {
      try {
        const events = JSON.parse(wh.events || "[]");
        return events.includes(eventType) || events.includes("*");
      } catch {
        return false;
      }
    });

    if (relevantWebhooks.length === 0) return;

    const data = {
      event: eventType,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Fire requests asynchronously without blocking
    Promise.allSettled(
      relevantWebhooks.map(async (wh) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "CollabyDraw-Webhook/1.0",
        };

        if (wh.secret) {
          // Simple signing mechanism (in prod, use HMAC SHA256)
          headers["X-CollabyDraw-Signature"] = wh.secret;
        }

        let finalBody = JSON.stringify(data);

        // Native Slack Webhook formatting
        if (wh.url.includes("hooks.slack.com")) {
          let text = `CollabyDraw Event: *${eventType}*`;
          if (eventType === "board.created") {
            text = `🆕 New Board Created: *${payload.name}*`;
          } else if (eventType === "board.updated") {
            text = `🔄 Board Updated: *${payload.name}*`;
          } else if (eventType === "board.deleted") {
            text = `🗑️ Board Deleted: ID ${payload.id}`;
          }

          finalBody = JSON.stringify({ text });
        }

        try {
          await fetch(wh.url, {
            method: "POST",
            headers,
            body: finalBody,
          });
        } catch (e) {
          console.error(`Failed to fire webhook to ${wh.url}`, e);
        }
      })
    );
  } catch (error) {
    console.error("Error in webhook dispatcher:", error);
  }
}
