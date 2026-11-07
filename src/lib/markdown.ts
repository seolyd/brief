import { Marked } from 'marked'

/**
 * Must Read 마크다운을 HTML로 바꿉니다.
 * 글은 우리 파이프라인이 쓰지만 재료는 외부 기사라서, 원문 HTML은 한 글자도 통과시키지 않습니다.
 * 링크는 http(s)만, 새 탭으로 엽니다.
 */
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }) {
      return escape(text)
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens)
      if (!/^https?:\/\//i.test(href)) return label
      return `<a href="${escape(href)}" target="_blank" rel="noreferrer noopener">${label}</a>`
    },
    image({ text }) {
      return escape(text ?? '')
    },
    table(token) {
      // 좁은 화면에서 표가 페이지를 밀어내지 않게 가로 스크롤 상자로 감쌉니다.
      const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('')
      const rows = token.rows
        .map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`)
        .join('')
      return `<div class="table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
    },
  },
})

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false })
}
