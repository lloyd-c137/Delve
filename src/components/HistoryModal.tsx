import { useState, useEffect } from "react"
import { X, Trash2, BookOpen, Clock, FileText } from "lucide-react"
import type { ReadingHistory } from "../services/readingHistory"
import { getReadingHistory, removeFromHistory } from "../services/readingHistory"

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (history: ReadingHistory) => void
}

export function HistoryModal({ isOpen, onClose, onSelect }: HistoryModalProps) {
  const [history, setHistory] = useState<ReadingHistory[]>([])

  useEffect(() => {
    if (isOpen) {
      setHistory(getReadingHistory())
    }
  }, [isOpen])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeFromHistory(id)
    setHistory(getReadingHistory())
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        return `${minutes} 分钟前`
      }
      return `${hours} 小时前`
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days} 天前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      epub: 'EPUB',
      pdf: 'PDF',
      txt: 'TXT',
      md: 'MD',
      text: '文本'
    }
    return labels[type] || type.toUpperCase()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">继续阅读</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <BookOpen className="w-16 h-16 mb-4" />
              <p className="text-lg">暂无阅读记录</p>
              <p className="text-sm mt-1">导入文档后将自动保存在这里</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <div className="flex-shrink-0 w-14 h-18 rounded-lg overflow-hidden shadow-sm bg-gray-100">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-pink-500">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">{item.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{item.author}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="px-2 py-0.5 bg-gray-100 rounded">{getTypeLabel(item.type)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(item.lastReadAt)}
                      </span>
                      {item.totalChapters > 1 && (
                        <span>第 {item.currentChapter + 1} / {item.totalChapters} 章</span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    title="删除记录"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
