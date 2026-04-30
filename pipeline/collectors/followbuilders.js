// Fetches the daily-updated feeds from https://github.com/zarazhangrui/follow-builders
// Provides first-hand content: X/Twitter builders, AI podcasts with transcripts, blog posts

const FEEDS = {
  x: 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json',
  podcasts: 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json',
  blogs: 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json',
}

const MIN_TWEET_LIKES = 10
const MAX_TWEETS_PER_BUILDER = 2
const MAX_TWEETS_TOTAL = 15
// Transcript is trimmed to avoid token bloat — enough for Claude to summarise
const TRANSCRIPT_PREVIEW_CHARS = 800

async function fetchJSON(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AI-Digest-Bot/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    return res.json()
  } catch (err) {
    console.error(`[followbuilders] Failed to fetch ${url}: ${err.message}`)
    return null
  }
}

export async function collectFollowBuilders() {
  const [xData, podcastData, blogData] = await Promise.all([
    fetchJSON(FEEDS.x),
    fetchJSON(FEEDS.podcasts),
    fetchJSON(FEEDS.blogs),
  ])

  const items = []

  // X/Twitter: top-engagement tweets from AI builders
  if (xData?.x) {
    let tweetCount = 0
    for (const builder of xData.x) {
      if (tweetCount >= MAX_TWEETS_TOTAL) break

      const topTweets = (builder.tweets || [])
        .filter((t) => t.likes >= MIN_TWEET_LIKES && !t.isQuote)
        .sort((a, b) => b.likes - a.likes)
        .slice(0, MAX_TWEETS_PER_BUILDER)

      for (const tweet of topTweets) {
        if (tweetCount >= MAX_TWEETS_TOTAL) break
        items.push({
          type: 'tweet',
          id: tweet.id,
          title: `@${builder.handle}: ${tweet.text.slice(0, 120)}${tweet.text.length > 120 ? '…' : ''}`,
          summary: tweet.text.slice(0, 400),
          url: tweet.url,
          source: `X (@${builder.handle})`,
          published: tweet.createdAt,
        })
        tweetCount++
      }
    }
  }

  // Podcasts: include full transcript preview for richer summarisation
  if (podcastData?.podcasts) {
    for (const episode of podcastData.podcasts) {
      const transcriptPreview = episode.transcript
        ? episode.transcript.replace(/\n+/g, ' ').trim().slice(0, TRANSCRIPT_PREVIEW_CHARS)
        : ''
      items.push({
        type: 'podcast',
        id: episode.guid,
        title: episode.title,
        summary: transcriptPreview,
        url: episode.url,
        source: episode.name,
        published: episode.publishedAt,
      })
    }
  }

  // Blog posts (may be empty depending on follow-builders lookback window)
  if (blogData?.blogs) {
    for (const post of blogData.blogs) {
      items.push({
        type: 'article',
        id: post.url,
        title: post.title,
        summary: String(post.content || '').replace(/<[^>]+>/g, '').trim().slice(0, 400),
        url: post.url,
        source: post.source || 'follow-builders',
        published: post.publishedAt || new Date().toISOString(),
      })
    }
  }

  console.log(
    `[followbuilders] ${items.filter((i) => i.type === 'tweet').length} tweets, ` +
    `${items.filter((i) => i.type === 'podcast').length} podcasts, ` +
    `${items.filter((i) => i.type === 'article').length} blog posts`
  )

  return items
}
