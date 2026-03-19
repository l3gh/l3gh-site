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
        const usercache = await redis.get('usercache');
        const entry = usercache.find(u => u.uuid === uuid);
        const name = entry ? entry.name : uuid;
        res.status(200).json({ name, ...player });
    } else {
        res.status(405).json({ status: "method not allowed" });
    }
}