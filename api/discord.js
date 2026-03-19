export default async function handler(req, res) {
  if (req.method === "POST") {
    const { message } = req.body;
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message })
    });
    res.status(200).json({ status: "sent" });
  } else {
    res.status(405).json({ status: "method not allowed" });
  }
}
