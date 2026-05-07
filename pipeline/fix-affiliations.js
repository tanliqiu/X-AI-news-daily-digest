import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { gunzipSync } from 'zlib'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ARXIV_JS_PATH = join(__dirname, 'collectors', 'arxiv.js')
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'tanliqiu/X-AI-news-daily-digest'

async function fetchTexAuthorBlock(arxivId) {
  try {
    const res = await fetch(`https://arxiv.org/e-print/${arxivId}`, {
      headers: { 'User-Agent': 'AI-Digest-Bot/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    let content = ''
    try {
      const unpacked = gunzipSync(buf)
      // Find main.tex or authors.tex
      let offset = 0
      const candidates = []
      while (offset + 512 <= unpacked.length) {
        if (unpacked[offset] === 0) break
        const name = unpacked.subarray(offset, offset + 100).toString('utf8').replace(/\0+$/, '')
        const size = parseInt(unpacked.subarray(offset + 124, offset + 136).toString('utf8'), 8) || 0
        const type = unpacked[offset + 156]
        offset += 512
        if ((type === 0 || type === 48) && name.endsWith('.tex')) {
          candidates.push({ name, content: unpacked.subarray(offset, offset + size).toString('utf8') })
        }
        offset += Math.ceil(size / 512) * 512
      }
      const main = candidates.find(f => f.content.includes('\\begin{document}') && f.content.includes('\\author'))
        ?? candidates.find(f => f.content.includes('\\affil') || f.content.includes('\\affiliation') || f.content.includes('\\author{'))
        ?? candidates[0]
      content = main?.content ?? ''
    } catch {
      content = buf.toString('utf8')
    }
    // Extract just the author/affiliation preamble (up to \begin{document} or first 3000 chars)
    const docIdx = content.indexOf('\\begin{document}')
    return (docIdx > 0 ? content.slice(0, docIdx) : content).slice(0, 3000)
  } catch {
    return null
  }
}

async function createGitHubPR(branchName, newArxivJs, prTitle, prBody) {
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
  const base = `https://api.github.com/repos/${GITHUB_REPO}`

  // Get current SHA of main
  const refRes = await fetch(`${base}/git/ref/heads/main`, { headers })
  if (!refRes.ok) throw new Error('Failed to get main ref')
  const { object: { sha: mainSha } } = await refRes.json()

  // Create branch
  const branchRes = await fetch(`${base}/git/refs`, {
    method: 'POST', headers,
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
  })
  if (!branchRes.ok) throw new Error('Failed to create branch')

  // Get current file SHA
  const fileRes = await fetch(`${base}/contents/pipeline/collectors/arxiv.js`, { headers })
  if (!fileRes.ok) throw new Error('Failed to get file info')
  const { sha: fileSha } = await fileRes.json()

  // Update file on branch
  const content = Buffer.from(newArxivJs).toString('base64')
  const updateRes = await fetch(`${base}/contents/pipeline/collectors/arxiv.js`, {
    method: 'PUT', headers,
    body: JSON.stringify({
      message: `fix: improve affiliation extraction rules\n\nAuto-proposed by fix-affiliations.js`,
      content,
      sha: fileSha,
      branch: branchName,
    }),
  })
  if (!updateRes.ok) throw new Error('Failed to update file')

  // Open PR
  const prRes = await fetch(`${base}/pulls`, {
    method: 'POST', headers,
    body: JSON.stringify({ title: prTitle, body: prBody, head: branchName, base: 'main' }),
  })
  if (!prRes.ok) throw new Error('Failed to create PR')
  const pr = await prRes.json()
  return pr.html_url
}

export async function generateCodeFixPR(patched) {
  if (!GITHUB_TOKEN) {
    console.warn('[fix-affiliations] GITHUB_TOKEN not set, skipping PR generation')
    return
  }
  if (patched.length === 0) return

  console.log(`[fix-affiliations] Generating code-fix PR for ${patched.length} patched paper(s)...`)

  const client = new Anthropic()
  const currentCode = await readFile(ARXIV_JS_PATH, 'utf-8')

  const caseDescriptions = []
  for (const { arxivId, affiliations, userCorrection } of patched) {
    const texBlock = await fetchTexAuthorBlock(arxivId)
    caseDescriptions.push(
      `### Paper: ${arxivId}\n` +
      (texBlock ? `TeX author preamble:\n\`\`\`latex\n${texBlock}\n\`\`\`\n` : '') +
      `Extracted correctly as: ${affiliations.join(', ')}\n` +
      (userCorrection ? `User-provided correction: ${userCorrection}\n` : '') +
      `(The extraction now works after the data patch — the question is whether the parsing logic in affiliationsFromTex needs hardening to handle this pattern reliably in future.)`
    )
  }

  const prompt = `You are improving a LaTeX affiliation extractor in a Node.js pipeline.

Here is the current \`pipeline/collectors/arxiv.js\` file:
\`\`\`javascript
${currentCode}
\`\`\`

The following papers were flagged by a user as having incorrect or missing affiliations. The data has already been patched manually, but we want to harden the code so similar papers work automatically in future.

${caseDescriptions.join('\n\n')}

Your task:
1. Identify what pattern or edge case caused the extraction to fail or produce wrong results.
2. Propose the minimal change to \`affiliationsFromTex\` (or \`fetchArxivAffiliations\`) that would handle this pattern correctly.
3. Return the COMPLETE updated \`pipeline/collectors/arxiv.js\` file with your change applied. Do not summarize or truncate — return the full file.
4. After the file, write a brief "## PR Description" section explaining what you changed and why (2-4 sentences).

Format your response as:
<file>
...complete updated arxiv.js...
</file>
<pr_description>
...explanation...
</pr_description>`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const fileMatch = responseText.match(/<file>([\s\S]*?)<\/file>/)
  const prDescMatch = responseText.match(/<pr_description>([\s\S]*?)<\/pr_description>/)

  if (!fileMatch) {
    console.error('[fix-affiliations] Claude did not return a <file> block, skipping PR')
    return
  }

  const newCode = fileMatch[1].trim()
  const prDesc = prDescMatch?.[1]?.trim() ?? 'Auto-proposed affiliation parsing improvement.'

  const date = new Date().toISOString().split('T')[0]
  const branchName = `fix/affiliation-rules-${date}`
  const papers = patched.map((p) => `- \`${p.arxivId}\``).join('\n')
  const prBody = `## Summary\n\n${prDesc}\n\n## Flagged papers\n\n${papers}\n\n🤖 Auto-proposed by \`fix-affiliations.js\``

  try {
    const prUrl = await createGitHubPR(branchName, newCode, `fix: improve affiliation extraction rules (${date})`, prBody)
    console.log(`[fix-affiliations] PR opened: ${prUrl}`)
  } catch (err) {
    console.error(`[fix-affiliations] PR creation failed: ${err.message}`)
  }
}
