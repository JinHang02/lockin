import { useMemo } from 'react'

/** Escape a string for safe use inside an HTML attribute (quotes + HTML entities) */
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Lightweight markdown → HTML renderer (no external deps) */
function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="md-code-block"><code>${code.trim()}</code></pre>`
  )

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>')

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Images ![alt](url) — must come before links
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => {
    if (/^https?:\/\//i.test(url)) return `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" class="md-img" />`
    return `![${alt}](${url})`
  })

  // Links [text](url) — sanitize against javascript: URLs
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    if (/^(https?:\/\/|mailto:|#)/i.test(url)) return `<a href="${escapeAttr(url)}" class="md-link" target="_blank" rel="noopener">${text}</a>`
    return `${text} (${url})`
  })

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />')

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')

  // Unordered lists
  html = html.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="md-li">$1</li>')
  html = html.replace(/(<li class="md-li">[\s\S]*?<\/li>)/g, '<ul class="md-ul">$1</ul>')
  // Clean nested ul
  html = html.replace(/<\/ul>\s*<ul class="md-ul">/g, '')

  // Ordered lists
  html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="md-oli">$1</li>')
  html = html.replace(/(<li class="md-oli">[\s\S]*?<\/li>)/g, '<ol class="md-ol">$1</ol>')
  html = html.replace(/<\/ol>\s*<ol class="md-ol">/g, '')

  // Checkboxes
  html = html.replace(/\[x\]/gi, '<input type="checkbox" checked disabled class="md-checkbox" />')
  html = html.replace(/\[\s?\]/g, '<input type="checkbox" disabled class="md-checkbox" />')

  // Paragraphs — wrap remaining text lines
  html = html.replace(/^(?!<[a-z/])(.*\S.*)$/gm, '<p class="md-p">$1</p>')

  return html
}

export default function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content])

  return (
    <div
      className={`markdown-preview ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
