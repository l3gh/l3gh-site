import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'GET') return res.status(405).json({ status: 'method not allowed' });

    const { uuid } = req.query;
    if (!uuid) return res.status(400).json({ status: 'missing uuid' });

    const data = await redis.get(`inv:${uuid}`);
    if (!data) return res.status(404).json({ status: 'not found' });

    // redis may return already-parsed object or a string depending on client version
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return res.status(200).json(parsed);
}