import { Redis } from '@upstash/redis'
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === "GET") {
        const [players, usercache] = await Promise.all([
            redis.get('players'),
            redis.get('usercache')
        ]);
            const result = players.map(uuid => {
            const entry = usercache.find(u => u.uuid === uuid);
            return { uuid, name: entry ? entry.name : uuid };
        });
        res.status(200).json(result);
    } else {
        res.status(405).json({ status: "method not allowed" });
    }
}