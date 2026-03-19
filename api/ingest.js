//mc mod ingest.js
import { Redis } from '@upstash/redis'
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { secret, usercache, stats } = req.body;

    if (secret !== process.env.INGEST_SECRET) {
    return res.status(401).json({ status: "unauthorized" });
}   //check for the secret password

    await redis.set('usercache', JSON.stringify(usercache));
    for (const uuid of Object.keys(stats)) {
    await redis.set(`player:${uuid}`, JSON.stringify(stats[uuid]));
}
    await redis.set('players', JSON.stringify(Object.keys(stats)));
    
    res.status(200).json({ status: "recieved" });
  } else {
    res.status(405).json({ status: "method not allowed" });
  }
}

