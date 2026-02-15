import { useState, useRef, useCallback } from "react"
import { ArrowLeft, Sparkles, Languages } from "lucide-react"
import { cn } from "../lib/utils"
import type { Article, DigResult, SelectionPosition, Language } from "../types"
import { DigPopover } from "./DigPopover"
import { explainTextStream } from "../services/ai"

interface ArticleReaderProps {
  article: Article
  language: Language
  onBack: () => void
}

export function ArticleReader({ article, language, onBack }: ArticleReaderProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectionPosition, setSelectionPosition] = useState<SelectionPosition>({ x: 0, y: 0 })
  const [digResult, setDigResult] = useState<DigResult | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<string>("")

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setPopoverOpen(false)
      return
    }

    const selectedText = selection.toString().trim()
    if (!selectedText || selectedText.length > 100) {
      setPopoverOpen(false)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    selectionRef.current = selectedText
    setSelectionPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
    setDigResult({
      selectedText,
      explanation: "",
      loading: false,
    })
    setIsStreaming(false)
    setPopoverOpen(true)
  }, [])

  const handleDig = useCallback(() => {
    if (!selectionRef.current) return

    setDigResult({
      selectedText: selectionRef.current,
      explanation: "",
      loading: true,
    })
    setIsStreaming(true)

    // 获取上下文（选中位置前后的文本）
    const content = article.content
    const selection = window.getSelection()
    let context = content
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const container = contentRef.current
      if (container) {
        // 获取选中文本在文章中的位置
        const preSelectionRange = document.createRange()
        preSelectionRange.selectNodeContents(container)
        preSelectionRange.setEnd(range.startContainer, range.startOffset)
        const startIndex = preSelectionRange.toString().length
        const endIndex = startIndex + selectionRef.current.length
        
        // 提取上下文（前后各100个字符）
        const contextStart = Math.max(0, startIndex - 100)
        const contextEnd = Math.min(content.length, endIndex + 100)
        context = content.substring(contextStart, contextEnd)
      }
    }

    // 使用流式输出
    explainTextStream(
      selectionRef.current,
      context,
      language,
      {
        onChunk: (chunk) => {
          setDigResult((prev) =>
            prev
              ? {
                  ...prev,
                  explanation: prev.explanation + chunk,
                  loading: true,
                }
              : null
          )
        },
        onComplete: () => {
          setIsStreaming(false)
          setDigResult((prev) =>
            prev
              ? {
                  ...prev,
                  loading: false,
                }
              : null
          )
        },
        onError: (error) => {
          setIsStreaming(false)
          setDigResult({
            selectedText: selectionRef.current,
            explanation: `获取解释失败: ${error.message}`,
            loading: false,
          })
        },
      }
    )
  }, [article.content, language])

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    setPopoverOpen(open)
    if (!open) {
      window.getSelection()?.removeAllRanges()
      setIsStreaming(false)
    }
  }, [])

  const paragraphs = article.content.split("\n").filter((p) => p.trim())

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={onBack}
            className={cn(
              "flex items-center gap-2 text-sm text-gray-600",
              "hover:text-gray-900 transition-colors"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <Languages className="w-4 h-4" />
              <span>{language === 'zh' ? '中文' : 'EN'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Sparkles className="w-4 h-4" />
              <span>选中文字即可 Dig</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <article>
          <h1 className="text-4xl font-bold text-gray-900 mb-8 leading-tight">
            {article.title}
          </h1>

          <div
            ref={contentRef}
            onMouseUp={handleTextSelection}
            className="prose prose-lg max-w-none"
          >
            {paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className={cn(
                  "mb-6 text-gray-700 leading-relaxed",
                  "text-lg",
                  "selection:bg-orange-100 selection:text-orange-900"
                )}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </main>

      <DigPopover
        open={popoverOpen}
        position={selectionPosition}
        digResult={digResult}
        onOpenChange={handlePopoverOpenChange}
        onDig={handleDig}
        isStreaming={isStreaming}
        language={language}
      />
    </div>
  )
}
