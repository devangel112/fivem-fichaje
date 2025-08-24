export async function sendDiscordWebhook(content: string) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("Webhook error", err);
  }
}
