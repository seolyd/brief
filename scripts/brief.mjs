/**
 * Morning Intelligence Brief — data/feed.json의 최근 기사로 "오늘 알아야 할 10가지"를 씁니다.
 *
 * ANTHROPIC_API_KEY가 없으면 아무것도 하지 않고 끝납니다. 앱은 브리핑이 없으면
 * 분야별 헤드라인으로 대신 보여주므로, 키 없이도 앱은 온전히 돕니다.
 *
 * 모델이 주소를 지어내지 못하게, 기사에는 번호만 붙여 보내고 답도 번호로 받습니다.
 * 주소와 매체명은 이 스크립트가 번호로 다시 붙입니다.
 */
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'node:fs'

const FEED_PATH = process.env.FEED_OUT ?? 'public/data/feed.json'
const OUT_PATH = process.env.BRIEF_OUT ?? 'public/data/brief.json'
const WINDOW_HOURS = 36
const PER_DOMAIN = 30

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('ANTHROPIC_API_KEY가 없어 브리핑을 건너뜁니다. 앱은 헤드라인으로 대신 보여줍니다.')
  process.exit(0)
}

const feed = JSON.parse(readFileSync(FEED_PATH, 'utf8'))
const since = Date.now() - WINDOW_HOURS * 3_600_000
const domainLabel = Object.fromEntries((feed.domains ?? []).map((d) => [d.id, d.label]))

// 분야마다 최신 순으로 자릅니다. 한 분야가 발행량으로 나머지를 밀어내지 않게.
const pool = []
for (const d of feed.domains ?? []) {
  const mine = feed.items
    .filter((i) => i.domain === d.id && i.kind === 'article' && Date.parse(i.publishedAt) >= since)
    .slice(0, PER_DOMAIN)
  pool.push(...mine)
}
if (pool.length < 10) {
  console.log(`최근 ${WINDOW_HOURS}시간 기사가 ${pool.length}개뿐이라 브리핑을 건너뜁니다.`)
  process.exit(0)
}

const listing = pool
  .map((i, n) => `[${n}] (${domainLabel[i.domain] ?? i.domain} · ${i.sourceName}) ${i.title}${i.excerpt ? `\n    ${i.excerpt}` : ''}`)
  .join('\n')

const SECTIONS = [
  { id: 'global', title: '글로벌 경제', hint: '미국 경제·금리·환율, 지정학 이슈' },
  { id: 'invest', title: '투자', hint: '나스닥·반도체·빅테크, ETF와 시장 위험 요인. 한국 시장 영향이 있으면 함께' },
  { id: 'tech', title: 'AI & Technology', hint: 'OpenAI·Anthropic·Google 등 AI 산업, 주목할 신기술과 스타트업' },
  { id: 'business', title: 'Business & Career', hint: '실리콘밸리와 한국 테크기업, 조직관리와 채용 트렌드' },
]

const system = `당신은 바쁜 한국인 PM을 위한 아침 브리핑 편집자입니다.
독자는 영상 대신 글로 10분 안에 세상을 파악하려 합니다. 자극적인 표현, 과장, 투자 권유를 쓰지 않습니다.

규칙:
- 주어진 기사 목록에 있는 사실만 씁니다. 목록에 없는 수치나 사건을 보태지 않습니다.
- 각 항목의 refs에는 근거가 된 기사 번호를 1~3개 넣습니다.
- 같은 사건을 다룬 기사는 한 항목으로 묶습니다.
- 모든 글은 한국어로, 짧은 평서문으로 씁니다.`

const user = `아래는 최근 ${WINDOW_HOURS}시간 기사 목록입니다.

${listing}

이 목록으로 "오늘 반드시 알아야 할 10가지"를 만드세요. 섹션은 다음 네 개이고, 합쳐서 정확히 10개 항목입니다.
${SECTIONS.map((s, n) => `${String(n + 1).padStart(2, '0')}. ${s.id} — ${s.title}: ${s.hint}`).join('\n')}

각 항목:
- title: 한 줄 제목 (30자 안팎)
- what: 핵심 내용 1~2문장
- why: 왜 중요한지 1문장
- next: 앞으로 볼 지점 또는 영향 1문장
- refs: 근거 기사 번호

headline에는 오늘을 한 문장으로 요약한 문장을 넣으세요.`

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'sections'],
  properties: {
    headline: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'items'],
        properties: {
          id: { type: 'string', enum: SECTIONS.map((s) => s.id) },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'what', 'why', 'next', 'refs'],
              properties: {
                title: { type: 'string' },
                what: { type: 'string' },
                why: { type: 'string' },
                next: { type: 'string' },
                refs: { type: 'array', items: { type: 'integer' } },
              },
            },
          },
        },
      },
    },
  },
}

const client = new Anthropic()

let response
try {
  response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    // 안전 분류기가 거절하면 서버가 알맞은 모델로 다시 돌립니다.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: user }],
  })
} catch (err) {
  if (err instanceof Anthropic.AuthenticationError) console.error('API 키가 유효하지 않습니다.')
  else if (err instanceof Anthropic.RateLimitError) console.error('요청 한도에 걸렸습니다. 내일 다시 돕니다.')
  else if (err instanceof Anthropic.APIError) console.error(`API 오류 ${err.status}: ${err.message}`)
  else console.error(err)
  // 브리핑이 실패해도 피드 갱신은 커밋되어야 합니다. 지난 브리핑은 그대로 둡니다.
  process.exit(0)
}

if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
  console.error(`브리핑을 만들지 못했습니다 (stop_reason: ${response.stop_reason}).`)
  process.exit(0)
}

const text = response.content.find((b) => b.type === 'text')?.text ?? ''
let parsed
try {
  parsed = JSON.parse(text)
} catch {
  console.error('응답이 JSON이 아닙니다.')
  process.exit(0)
}

const sections = SECTIONS.map((s) => {
  const got = parsed.sections.find((x) => x.id === s.id)
  return {
    id: s.id,
    title: s.title,
    items: (got?.items ?? []).map((item) => ({
      title: item.title,
      what: item.what,
      why: item.why,
      next: item.next,
      // 번호가 목록 밖이면 버립니다. 근거 없는 주소는 싣지 않습니다.
      sources: [...new Set(item.refs)]
        .filter((n) => Number.isInteger(n) && pool[n])
        .map((n) => ({ name: pool[n].sourceName, title: pool[n].title, url: pool[n].url, itemId: pool[n].id })),
    })),
  }
}).filter((s) => s.items.length)

writeFileSync(
  OUT_PATH,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), model: response.model, headline: parsed.headline, sections }, null, 2)}\n`,
)
const count = sections.reduce((n, s) => n + s.items.length, 0)
console.log(`브리핑 ${count}개 항목 (${pool.length}개 기사에서, 모델 ${response.model})`)
