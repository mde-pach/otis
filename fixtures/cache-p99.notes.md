The cache was doing exactly what we asked it to do, which was the problem.

p99 went from 180ms to 410ms in the week after we shipped the read-through cache. p50 barely moved, 42ms to 39ms.

Nobody experiences the average.

We optimised for the average and forgot that nobody actually lives there.

Redis was healthy the entire time. Memory fine, CPU fine, every dashboard green. That is why it took four days to find.

A miss under load is more expensive than having no cache at all: you pay for the lookup, then you pay the origin anyway.

```ts
// what we shipped first
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);

const fresh = await db.query(HOT_QUERY);
await redis.set(key, JSON.stringify(fresh), { px: 30_000 });
return fresh;
```

When the key expired, every in-flight request missed at the same moment and they all went to Postgres together.

Thundering herd. Dogpile. Stampede. Everyone has a name for it and we walked into it anyway.

The fix was single-flight: one request per key populates the cache, the rest wait on that one.

Request coalescing is three lines if your language has it in the standard library, and a week of subtle bugs if it does not.

We picked a 30 second TTL because someone said in a meeting that 30 seconds sounded reasonable. Nobody asked reasonable relative to what.

A TTL is a guess about how stale you can afford to be, and we never wrote the guess down anywhere.

I still think adding the cache was the right call. The rollout was not.

Honestly the whole thing would have been avoidable if any of us had read the client library docs properly.

Measuring p50 is how you end up shipping something that is worse for exactly the people who complain.

The graph that finally showed it was origin QPS, not latency. The cache was supposed to reduce load on the origin, and origin load went up.

Four hundred concurrent requests for the same key, every thirty seconds, like clockwork.

What I would tell myself: add the cache and the stampede protection in the same PR, or do not add the cache.

Jitter the expiry. Even ten percent of spread would have been enough to hide the problem, which is its own kind of problem.

Coalescing buys you a new failure mode: if the one in-flight request hangs, everybody waiting on it hangs too. We added a timeout after the second incident.

The word cache does a lot of work in this sentence. Ours was a read-through cache in front of a single Postgres query. Not a CDN, not a memo table.

Reading old incident reports afterwards, three teams in this company hit the same thing before us. None of it was written down anywhere I would have looked.

The dashboards were green because we were measuring the cache, not the request.

Every request now had two ways to be slow instead of one, and the second was slower than the first.

Add a cache is an answer to a question nobody asked out loud: which read is hot, and why is it hot.

Postgres was never the bottleneck. Connection setup under burst was.

We rolled it out to five percent and saw nothing, because at five percent the herd is too small to hurt. Percentage rollouts hide superlinear failures.

p99 after coalescing: 96ms. Better than before the cache existed, which is the only reason this story has an ending.

Nobody experiences the average. They experience the worst request they made today.
