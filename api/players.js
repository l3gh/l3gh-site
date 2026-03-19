import { Redis } from '@upstash/redis'
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
    if (req.method === "GET") {
        const players = await redis.get('players');
        res.status(200).json(players);
    } else {
        res.status(405).json({ status: "method not allowed" });
    }
}