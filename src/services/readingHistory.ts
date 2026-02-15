import type { ParsedBook } from "./fileParser"

export interface ReadingHistory {
  id: string
  title: string
  author: string
  type: 'epub' | 'pdf' | 'txt' | 'md' | 'text'
  cover?: string
  lastReadAt: number
  currentChapter: number
  totalChapters: number
  bookData: string
}

const HISTORY_KEY = 'delve_reading_history'
const MAX_HISTORY = 20

async function blobUrlToBase64(url: string): Promise<string> {
  if (!url.startsWith('blob:')) {
    return url
  }
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.error('Failed to convert blob URL to base64:', e)
    return url
  }
}

function serializeBook(book: ParsedBook): string {
  const serialized = {
    ...book,
    images: Array.from(book.images.entries())
  }
  return JSON.stringify(serialized)
}

function deserializeBook(data: string): ParsedBook {
  const parsed = JSON.parse(data)
  return {
    ...parsed,
    images: new Map(parsed.images || [])
  }
}

export function getReadingHistory(): ReadingHistory[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY)
    if (!data) return []
    const history = JSON.parse(data) as ReadingHistory[]
    return history.sort((a, b) => b.lastReadAt - a.lastReadAt)
  } catch (e) {
    console.error('Failed to load reading history:', e)
    return []
  }
}

export async function saveToHistory(book: ParsedBook, type: 'epub' | 'pdf' | 'txt' | 'md' | 'text', currentChapter: number = 0): Promise<void> {
  try {
    const history = getReadingHistory()
    const id = generateId(book.title, type)
    const existingIndex = history.findIndex(h => h.id === id)
    
    const coverBase64 = book.cover ? await blobUrlToBase64(book.cover) : undefined
    
    const entry: ReadingHistory = {
      id,
      title: book.title,
      author: book.author,
      type,
      cover: coverBase64,
      lastReadAt: Date.now(),
      currentChapter,
      totalChapters: book.chapters.length,
      bookData: serializeBook(book)
    }
    
    if (existingIndex >= 0) {
      history[existingIndex] = entry
    } else {
      history.unshift(entry)
    }
    
    const trimmedHistory = history.slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory))
  } catch (e) {
    console.error('Failed to save reading history:', e)
  }
}

export function saveTextToHistory(title: string, content: string, currentChapter: number = 0): void {
  const book: ParsedBook = {
    title,
    author: 'Unknown',
    chapters: [{
      id: 'ch-0',
      href: '#ch-0',
      title: title,
      content: content,
      order: 0
    }],
    toc: [],
    images: new Map(),
    opfDir: ''
  }
  saveToHistory(book, 'text', currentChapter)
}

export function updateReadingProgress(id: string, currentChapter: number): void {
  try {
    const history = getReadingHistory()
    const index = history.findIndex(h => h.id === id)
    if (index >= 0) {
      history[index].lastReadAt = Date.now()
      history[index].currentChapter = currentChapter
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    }
  } catch (e) {
    console.error('Failed to update reading progress:', e)
  }
}

export function removeFromHistory(id: string): void {
  try {
    const history = getReadingHistory()
    const filtered = history.filter(h => h.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered))
  } catch (e) {
    console.error('Failed to remove from history:', e)
  }
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
}

export function getHistoryItem(id: string): ReadingHistory | null {
  const history = getReadingHistory()
  return history.find(h => h.id === id) || null
}

export function loadBookFromHistory(id: string): ParsedBook | null {
  const item = getHistoryItem(id)
  if (!item) return null
  
  try {
    return deserializeBook(item.bookData)
  } catch (e) {
    console.error('Failed to parse book data:', e)
    return null
  }
}

function generateId(title: string, type: string): string {
  return `${type}_${title}_${title.length}`.replace(/\s+/g, '_')
}
