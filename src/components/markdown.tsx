import { memo } from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

import { CopyButton } from "./copy-button"
import { cn } from "@/lib/utils"

interface MarkdownProps {
  content: string
  className?: string
}

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children)
  }
  return ""
}

/**
 * Memoised because a streaming reply re-renders on every token, and
 * re-parsing a long markdown document tens of times a second is the fastest
 * way to make the whole window feel sticky.
 */
export const Markdown = memo(function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-invert max-w-none",
        "prose-p:leading-relaxed prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0",
        "prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:before:content-none prose-code:after:content-none",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre({ children }) {
            const source = extractText(children)
            return (
              <div className="group relative my-3 overflow-hidden rounded-lg border bg-[#0b0b0f]">
                <CopyButton
                  value={source}
                  className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                />
                <pre className="scrollbar-thin overflow-x-auto p-4 text-[13px] leading-relaxed">
                  {children}
                </pre>
              </div>
            )
          },
          code({ className: codeClassName, children, ...props }) {
            const isBlock = Boolean(codeClassName?.startsWith("language-"))
            if (isBlock) {
              return (
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code
                className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[0.85em] font-medium"
                {...props}
              >
                {children}
              </code>
            )
          },
          a({ children, ...props }) {
            return (
              <a target="_blank" rel="noreferrer noopener" {...props}>
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="scrollbar-thin my-3 overflow-x-auto rounded-lg border">
                <table className="!my-0 w-full text-sm">{children}</table>
              </div>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
