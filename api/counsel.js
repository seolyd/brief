/**
 * 재물 상담사 — Vercel 서버리스 함수 (POST /api/counsel).
 *
 * 사용자가 적은 생각이나 상황을 12가지 성경적 재물관 기준에 비춰 보고,
 * 기준별 판단·조언·관련 말씀·기도를 JSON으로 돌려줍니다.
 *
 * 켜는 법 (Vercel → Settings → Environment Variables)
 *   ANTHROPIC_API_KEY  — Anthropic API 키
 *   COUNSEL_PASSCODE   — 아무 문자열. 앱에서 한 번 입력합니다. 주소를 아는 누구나 내 API 키로
 *                        상담을 돌리지 못하게 막는 장치라, 둘 다 있어야 켜집니다.
 * 둘 중 하나라도 없으면 앱은 'Claude 앱에서 상담' 방식으로 대신합니다 (API 키 불필요).
 */
import Anthropic from '@anthropic-ai/sdk'
import { TOPICS, BOOKS } from '../scripts/wealth-topics.mjs'

export const config = { maxDuration: 120 }

const MAX_INPUT = 4000
const STATUS = ['부합', '주의', '어긋남', '해당 없음']
const OVERALL = ['기준에 잘 부합', '부분적으로 부합', '다시 생각해 볼 필요']

const refOf = ([b, ch, from, to]) => `${BOOKS[b].abbr} ${ch}:${from}${to > from ? `-${to}` : ''}`
const REFS = TOPICS.flatMap((t) => t.passages.map((p) => ({ topic: t.id, ref: refOf(p) })))
const REF_SET = new Set(REFS.map((r) => r.ref))

const criteriaText = TOPICS.map(
  (t, n) =>
    `${n + 1}. [${t.id}] ${t.title}\n   기준: ${t.criterion}\n   말씀: ${t.passages.map(refOf).join(', ')}`,
).join('\n')

const SYSTEM = `당신은 그리스도인을 위한 재물 상담사입니다. 성경적 재물관 12가지 기준에 비추어 사용자의 생각과 계획을 살피고, 목회적이고 따뜻하지만 정직하게 조언합니다.

12가지 기준:
${criteriaText}

원칙:
- 사용자의 생각을 12가지 기준 각각에 비추어 '부합', '주의', '어긋남', '해당 없음' 중 하나로 판단하고 이유를 한두 문장으로 씁니다. 근거가 글에 없으면 '해당 없음'입니다. 짐작으로 판단하지 않습니다.
- 정죄하지 않습니다. 잘하고 있는 점을 먼저 인정하고, 고칠 점은 구체적인 다음 행동으로 제안합니다.
- 관련 말씀은 위 목록에 있는 장절만 고르고, 성경 본문을 직접 인용하지 않습니다(앱이 개역한글 본문을 붙여 보여줍니다).
- 특정 종목·상품의 매수·매도를 권하지 않습니다. 재정·세무·법률 판단이 필요한 부분은 전문가와 상의하라고 말합니다.
- 교파마다 다르게 가르치는 문제(십일조의 정확한 비율 등)는 한쪽으로 단정하지 않습니다.
- 한국어로, 차분하고 짧은 평서문으로 씁니다.`

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'overall', 'criteria', 'advice', 'verses', 'questions', 'prayer'],
  properties: {
    summary: { type: 'string', description: '사용자의 생각을 두세 문장으로 요약하고 전체 인상을 말함' },
    overall: { type: 'string', enum: OVERALL },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status', 'reason'],
        properties: {
          id: { type: 'string', enum: TOPICS.map((t) => t.id) },
          status: { type: 'string', enum: STATUS },
          reason: { type: 'string' },
        },
      },
    },
    advice: { type: 'array', items: { type: 'string' }, description: '구체적인 조언 3~5개' },
    verses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'why'],
        properties: { ref: { type: 'string', enum: [...REF_SET] }, why: { type: 'string' } },
      },
      description: '가장 관련 깊은 말씀 2~4개',
    },
    questions: { type: 'array', items: { type: 'string' }, description: '스스로 돌아볼 질문 2~3개' },
    prayer: { type: 'string', description: '이 상황을 위한 짧은 기도 2~3문장' },
  },
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

const enabled = () => Boolean(process.env.ANTHROPIC_API_KEY && process.env.COUNSEL_PASSCODE)

export function GET() {
  return json(200, { enabled: enabled() })
}

export async function POST(request) {
  if (!enabled()) return json(503, { error: 'disabled' })
  if (request.headers.get('x-counsel-passcode') !== process.env.COUNSEL_PASSCODE) {
    return json(401, { error: 'passcode' })
  }

  let text = ''
  try {
    text = String((await request.json())?.text ?? '').trim()
  } catch {
    return json(400, { error: 'bad_request' })
  }
  if (text.length < 10) return json(400, { error: 'too_short' })
  if (text.length > MAX_INPUT) return json(400, { error: 'too_long' })

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
      system: SYSTEM,
      messages: [{ role: 'user', content: `다음은 제 생각(또는 상황)입니다. 12가지 기준에 비추어 상담해 주세요.\n\n<생각>\n${text}\n</생각>` }],
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json(502, { error: 'api_key' })
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: 'rate_limit' })
    if (err instanceof Anthropic.APIError) return json(502, { error: 'api', status: err.status })
    return json(502, { error: 'unknown' })
  }

  if (response.stop_reason === 'refusal') return json(422, { error: 'refusal' })
  if (response.stop_reason === 'max_tokens') return json(502, { error: 'truncated' })

  let result
  try {
    result = JSON.parse(response.content.find((b) => b.type === 'text')?.text ?? '')
  } catch {
    return json(502, { error: 'parse' })
  }

  // 기준은 12개 모두, 목록 순서대로. 빠진 기준은 '해당 없음'으로 채웁니다.
  const byId = new Map(result.criteria.map((c) => [c.id, c]))
  result.criteria = TOPICS.map((t) => byId.get(t.id) ?? { id: t.id, status: '해당 없음', reason: '' })
  result.verses = result.verses.filter((v) => REF_SET.has(v.ref))
  return json(200, { ...result, createdAt: new Date().toISOString() })
}
