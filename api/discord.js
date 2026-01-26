export default async function handler(req, res) {
  if (req.method === "POST") {
    const { message } = req.body;
    await fetch("https://discord.com/api/webhooks/1465307577968623658/6q2TIrUXMnwKosoB5DN_zAD6tQgGYeaF4MhIY1urHFb_TijegCavwVIT9iRzndL_yAkQ", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message })
    });
    res.status(200).json({ status: "sent" });
  } else {
    res.status(405).json({ status: "method not allowed" });
  }
}
