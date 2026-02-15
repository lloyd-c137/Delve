import { useState, useRef } from "react"
import { FileText, ArrowRight, Languages, Upload, Loader2, BookOpenCheck, Settings, X, FileUp, History } from "lucide-react"
import { cn } from "../lib/utils"
import type { Language } from "../types"
import type { ParsedBook } from "../services/fileParser"
import { parseFile } from "../services/fileParser"
import { HistoryModal } from "./HistoryModal"
import type { ReadingHistory } from "../services/readingHistory"
import { loadBookFromHistory, saveToHistory, saveTextToHistory } from "../services/readingHistory"

interface ArticleInputProps {
  onSubmit: (title: string, content: string, language: Language) => void
  onEpubSubmit: (epub: ParsedBook, language: Language) => void
}

export function ArticleInput({ onSubmit, onEpubSubmit }: ArticleInputProps) {
  const [content, setContent] = useState("")
  const [language, setLanguage] = useState<Language>('zh')
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedBook, setParsedBook] = useState<ParsedBook | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMode === 'text' && content.trim()) {
      const lines = content.trim().split('\n')
      const firstLine = lines[0].trim()
      const title = firstLine.length > 20 
        ? firstLine.substring(0, 20) + '...' 
        : firstLine
      saveTextToHistory(title, content.trim())
      onSubmit(title, content.trim(), language)
    } else if (inputMode === 'file' && parsedBook) {
      const fileType = parsedBook.title.endsWith('.pdf') ? 'pdf' : 
                       parsedBook.title.endsWith('.txt') ? 'txt' :
                       parsedBook.title.endsWith('.md') ? 'md' : 'epub'
      await saveToHistory(parsedBook, fileType)
      onEpubSubmit(parsedBook, language)
    }
  }

  const handleHistorySelect = (history: ReadingHistory) => {
    const book = loadBookFromHistory(history.id)
    if (book) {
      setShowHistory(false)
      onEpubSubmit(book, language)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 检查文件格式
    const validExtensions = ['.epub', '.pdf', '.txt', '.md']
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!validExtensions.includes(fileExtension)) {
      setParseError('请选择 EPUB、PDF、TXT 或 MD 格式的文件')
      return
    }

    setIsParsing(true)
    setParseError(null)

    try {
      const parsed = await parseFile(file)
      setParsedBook(parsed)
      setParseError(null)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : '解析文件失败')
      setParsedBook(null)
    } finally {
      setIsParsing(false)
    }
  }

  const handleClearFile = () => {
    setParsedBook(null)
    setParseError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center p-4 relative">
      {/* 右上角设置按钮 */}
      <div className="absolute top-4 right-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-3 rounded-xl",
              "flex items-center justify-center",
              "bg-white text-gray-700 shadow-sm border border-gray-200",
              "hover:bg-gray-50 hover:shadow-md",
              "transition-all duration-200"
            )}
            title="设置"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          {/* 设置面板 */}
          {showSettings && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSettings(false)}
              />
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 w-64">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-800">设置</h3>
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                
                {/* 语言选择 */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-500 flex items-center gap-2">
                    <Languages className="w-4 h-4" />
                    AI 回答语言
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLanguage('zh')}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        language === 'zh'
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      中文
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        language === 'en'
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      English
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 mb-4 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Dig</h1>
          <p className="text-gray-500">粘贴文章或导入 EPUB，开始沉浸式阅读体验</p>
        </div>

        {/* 输入方式切换 */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
            <button
                type="button"
                onClick={() => {
                  setInputMode('text')
                  handleClearFile()
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  inputMode === 'text'
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <FileText className="w-4 h-4" />
                粘贴文本
              </button>
              <button
                type="button"
                onClick={() => setInputMode('file')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  inputMode === 'file'
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <FileUp className="w-4 h-4" />
                导入文件
              </button>
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  "text-gray-600 hover:bg-gray-100"
                )}
              >
                <History className="w-4 h-4" />
                继续阅读
              </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {inputMode === 'text' ? (
            // 文本输入模式
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <textarea
                placeholder="在此粘贴文章内容..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={cn(
                  "w-full px-6 py-4 min-h-[250px] resize-none",
                  "text-gray-700 leading-relaxed",
                  "focus:outline-none focus:bg-gray-50",
                  "placeholder:text-gray-400",
                  "transition-colors"
                )}
              />
            </div>
          ) : (
            // 文件导入模式
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub,.pdf,.txt,.md"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {!parsedBook ? (
                // 未选择文件：显示上传区域
                <button
                  type="button"
                  onClick={triggerFileInput}
                  disabled={isParsing}
                  className={cn(
                    "w-full px-6 py-12 min-h-[250px]",
                    "flex flex-col items-center justify-center gap-4",
                    "border-2 border-dashed border-gray-300",
                    "hover:border-orange-400 hover:bg-orange-50",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                      <p className="text-gray-600 font-medium">正在解析文件...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400" />
                      <div className="text-center">
                        <p className="text-gray-600 font-medium mb-1">点击上传文件</p>
                        <p className="text-gray-400 text-sm">支持 EPUB、PDF、TXT、MD 格式</p>
                      </div>
                    </>
                  )}
                </button>
              ) : (
                // 已选择文件：显示简略预览
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    {/* 封面 */}
                    <div className="flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden shadow-md bg-gray-100">
                      <img
                        src={parsedBook.cover}
                        alt={parsedBook.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // 图片加载失败时显示默认图标
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                    
                    {/* 书籍信息 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 text-lg mb-1 truncate">
                        {parsedBook.title}
                      </h3>
                      <p className="text-sm text-gray-500 mb-3">{parsedBook.author}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <BookOpenCheck className="w-4 h-4" />
                          {parsedBook.chapters.length} 章
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {parseError && (
                <div className="px-6 pb-4 pt-4">
                  <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">
                    {parseError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 提交按钮 */}
          {inputMode === 'text' ? (
            <button
              type="submit"
              disabled={!content.trim() || isParsing}
              className={cn(
                "w-full py-3 rounded-xl font-medium",
                "flex items-center justify-center gap-2",
                "bg-gray-900 text-white",
                "hover:bg-gray-800",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-200",
                "shadow-lg hover:shadow-xl"
              )}
            >
              开始阅读
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : parsedBook ? (
            <button
              type="submit"
              className={cn(
                "w-full py-3 rounded-xl font-medium",
                "flex items-center justify-center gap-2",
                "bg-gray-900 text-white",
                "hover:bg-gray-800",
                "transition-all duration-200",
                "shadow-lg hover:shadow-xl"
              )}
            >
              开始阅读
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : null}
        </form>

        <div className="mt-8 text-center text-sm text-gray-400">
          <p className="flex items-center justify-center gap-2">
            <Languages className="w-4 h-4" />
            AI 将使用 {language === 'zh' ? '中文' : 'English'} 回答
          </p>
          <p className="mt-2">提示：阅读时选中不理解的字词，点击 Dig 获取 AI 解释</p>
        </div>
      </div>

      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelect={handleHistorySelect}
      />
    </div>
  )
}
