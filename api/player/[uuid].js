import { Redis } from '@upstash/redis'
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === "GET") {
        const { uuid } = req.query;
        const player = await redis.get(`player:${uuid}`);
        res.status(200).json(player);
    } else {
        res.status(405).json({ status: "method not allowed" });
    }
}