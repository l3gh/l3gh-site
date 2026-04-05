import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') return res.status(405).json({ status: 'method not allowed' });

    const { secret, uuid, ...data } = req.body;

    if (!secret || secret !== process.env.INV_SECRET) {
        return res.status(401).json({ status: 'unauthorized' });
    }

    if (!uuid) return res.status(400).json({ status: 'missing uuid' });

    // store as inv:<uuid>, keep for 30 days
    await redis.set(`inv:${uuid}`, JSON.stringify(data), { ex: 60 * 60 * 24 * 30 });

    return res.status(200).json({ status: 'ok' });
}