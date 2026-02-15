import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, X, BookOpen, List, ArrowLeft, Type } from "lucide-react"
import { cn } from "../lib/utils"
import type { Language } from "../types"
import type { ParsedBook } from "../services/fileParser"
import { DigPopover } from "./DigPopover"
import { explainTextStream } from "../services/ai"
import { saveToHistory, updateReadingProgress } from "../services/readingHistory"

interface EpubReaderProps {
  epub: ParsedBook
  language: Language
  onBack: () => void
}

// 字体大小配置
const FONT_SIZES = [
  { name: 'small', label: '小', scale: 0.875 },
  { name: 'normal', label: '中', scale: 1 },
  { name: 'large', label: '大', scale: 1.125 },
  { name: 'xlarge', label: '特大', scale: 1.25 },
]

function getBookId(epub: ParsedBook): string {
  return `book_${epub.title}_${epub.chapters.length}`.replace(/\s+/g, '_')
}

function getBookType(epub: ParsedBook): 'epub' | 'pdf' | 'txt' | 'md' | 'text' {
  const title = epub.title.toLowerCase()
  if (title.endsWith('.pdf')) return 'pdf'
  if (title.endsWith('.txt')) return 'txt'
  if (title.endsWith('.md')) return 'md'
  return 'epub'
}

export function EpubReader({ epub, language, onBack }: EpubReaderProps) {
  const initialChapterIndex = epub.chapters.length > 1 ? 1 : 0
  const [currentChapterIndex, setCurrentChapterIndex] = useState(initialChapterIndex)
  const [showToc, setShowToc] = useState(false)
  const [selection, setSelection] = useState<string>("")
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 })
  const [digResult, setDigResult] = useState<{ selectedText: string; explanation: string; loading: boolean } | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [fontSizeIndex, setFontSizeIndex] = useState(2)
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const isEnglish = language === 'en'
  const bookId = getBookId(epub)
  
  const currentFontSize = FONT_SIZES[fontSizeIndex]

  const currentChapter = epub.chapters[currentChapterIndex]

  useEffect(() => {
    saveToHistory(epub, getBookType(epub), currentChapterIndex)
  }, [])

  useEffect(() => {
    updateReadingProgress(bookId, currentChapterIndex)
  }, [currentChapterIndex, bookId])

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
    window.scrollTo(0, 0)
  }, [currentChapterIndex])

  const handleTextSelection = () => {
    const selectedText = window.getSelection()?.toString().trim()
    if (selectedText && selectedText.length > 0) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setSelectionPosition({
          x: rect.left + rect.width / 2,
          y: rect.top,
        })
        setSelection(selectedText)
        setDigResult({ selectedText, explanation: "", loading: false })
        setPopoverOpen(true)
      }
    }
  }

  // 处理内容点击，阻止链接跳转
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const link = target.closest('a')
    
    if (link) {
      const href = link.getAttribute('href')
      if (href) {
        // 阻止默认跳转行为
        e.preventDefault()
        e.stopPropagation()
        
        // 处理内部锚点链接
        if (href.startsWith('#')) {
          // 页面内锚点，尝试滚动到对应元素
          const targetId = href.substring(1)
          const targetElement = document.getElementById(targetId) || 
                               mainRef.current?.querySelector(`[id="${targetId}"], [name="${targetId}"]`)
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        } else if (href.includes('.html') || href.includes('.xhtml')) {
          // 可能是章节链接，尝试找到对应章节
          const cleanHref = href.split('#')[0]
          const chapterIndex = epub.chapters.findIndex(ch => 
            ch.href === cleanHref || 
            ch.href.endsWith(cleanHref) || 
            cleanHref.endsWith(ch.href)
          )
          
          if (chapterIndex >= 0) {
            setCurrentChapterIndex(chapterIndex)
          }
        }
      }
    }
  }

  // 处理 Dig 请求
  const handleDig = async () => {
    if (!selection) return

    setIsStreaming(true)
    setDigResult({ selectedText: selection, explanation: "", loading: true })

    try {
      let explanation = ""
      await explainTextStream(
        selection,
        currentChapter?.content || "",
        language,
        {
          onChunk: (chunk) => {
            explanation += chunk
            setDigResult({ selectedText: selection, explanation, loading: true })
          },
          onComplete: () => {
            setIsStreaming(false)
            setDigResult({ selectedText: selection, explanation, loading: false })
          },
          onError: (error) => {
            console.error("AI解释失败:", error)
            setDigResult({
              selectedText: selection,
              explanation: isEnglish ? "Failed to get explanation. Please try again." : "获取解释失败，请重试。",
              loading: false
            })
            setIsStreaming(false)
          },
        }
      )
    } catch (error) {
      console.error("Dig failed:", error)
      setIsStreaming(false)
    }
  }

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open)
    if (!open) {
      window.getSelection()?.removeAllRanges()
    }
  }

  // 跳转到指定章节
  const goToChapter = (tocItem: typeof epub.toc[0]) => {
    // 在章节列表中查找匹配的章节
    const chapterIndex = epub.chapters.findIndex(ch => {
      // 处理带锚点的 href
      const tocHref = tocItem.href.split('#')[0]
      const chapterHref = ch.href.split('#')[0]
      return chapterHref === tocHref || chapterHref.endsWith(tocHref) || tocHref.endsWith(chapterHref)
    })
    
    if (chapterIndex >= 0) {
      setCurrentChapterIndex(chapterIndex)
      setShowToc(false)
    }
  }

  // 上一章
  const goToPrevChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1)
    }
  }

  // 下一章
  const goToNextChapter = () => {
    if (currentChapterIndex < epub.chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1)
    }
  }

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && !e.shiftKey) {
        goToPrevChapter()
      } else if (e.key === "ArrowRight" && !e.shiftKey) {
        goToNextChapter()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentChapterIndex])

  return (
    <div className="h-screen bg-[#f7f6f3] flex overflow-hidden">
      {/* 目录侧边栏 */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out",
          showToc ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* 目录头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-800">{isEnglish ? 'Contents' : '目录'}</span>
            </div>
            <button
              onClick={() => setShowToc(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* 书籍信息 */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800 line-clamp-2">{epub.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{epub.author}</p>
          </div>

          {/* 目录列表 */}
          <div className="flex-1 overflow-y-auto">
            {epub.toc.map((item) => {
              const chapterIndex = epub.chapters.findIndex(ch => {
                const tocHref = item.href.split('#')[0]
                const chapterHref = ch.href.split('#')[0]
                return chapterHref === tocHref || chapterHref.endsWith(tocHref) || tocHref.endsWith(chapterHref)
              })
              const isActive = chapterIndex === currentChapterIndex
              
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    goToChapter(item)
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 text-sm transition-colors",
                    "hover:bg-gray-50 border-b border-gray-100",
                    isActive ? "bg-orange-50 text-orange-600 border-l-4 border-l-orange-500" : "text-gray-700 border-l-4 border-l-transparent"
                  )}
                  style={{ paddingLeft: `${16 + item.level * 16}px` }}
                >
                  <span className="line-clamp-2">{item.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 遮罩层 */}
      {showToc && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setShowToc(false)}
        />
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="flex-none bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowToc(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <List className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 mx-4 text-center">
              <h1 className="text-sm font-medium text-gray-800 truncate max-w-md mx-auto">
                {currentChapter?.title}
              </h1>
              <p className="text-xs text-gray-400">
                {currentChapterIndex + 1} / {epub.chapters.length}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* 字体大小调节 */}
              <div className="relative">
                <button
                  onClick={() => setShowFontSizeMenu(!showFontSizeMenu)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title={isEnglish ? 'Font Size' : '字体大小'}
                >
                  <Type className="w-5 h-5 text-gray-600" />
                </button>
                
                {showFontSizeMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowFontSizeMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-[120px]">
                      {FONT_SIZES.map((size, index) => (
                        <button
                          key={size.name}
                          onClick={() => {
                            setFontSizeIndex(index)
                            setShowFontSizeMenu(false)
                          }}
                          className={cn(
                            "w-full px-4 py-2 text-left text-sm transition-colors",
                            fontSizeIndex === index
                              ? "bg-orange-50 text-orange-600 font-medium"
                              : "text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          {size.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              <button
                onClick={goToPrevChapter}
                disabled={currentChapterIndex === 0}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={goToNextChapter}
                disabled={currentChapterIndex === epub.chapters.length - 1}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </header>

        {/* 阅读内容区 */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto scroll-smooth"
          onMouseUp={handleTextSelection}
          onClick={handleContentClick}
        >
          <article className="max-w-3xl mx-auto px-6 py-12 bg-white min-h-full shadow-sm">
            {/* 章节标题 */}
            <h1 
              className="font-bold text-gray-900 mb-10 leading-tight"
              style={{ fontSize: `${2.25 * currentFontSize.scale}rem` }}
            >
              {currentChapter?.title}
            </h1>

            {/* 章节内容 */}
            <div
              className="max-w-none"
              style={{ 
                fontSize: `${1.125 * currentFontSize.scale}rem`,
                lineHeight: '1.8',
              }}
              dangerouslySetInnerHTML={{ __html: currentChapter?.content || "" }}
            />

            {/* 章节导航底部 */}
            <div className="mt-16 pt-8 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={goToPrevChapter}
                disabled={currentChapterIndex === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                  currentChapterIndex === 0
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">{isEnglish ? 'Previous' : '上一章'}</span>
              </button>

              <button
                onClick={goToNextChapter}
                disabled={currentChapterIndex === epub.chapters.length - 1}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                  currentChapterIndex === epub.chapters.length - 1
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <span className="text-sm">{isEnglish ? 'Next' : '下一章'}</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </article>
        </main>
      </div>

      {/* Dig 弹窗 */}
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
