export interface Article {
  id: string
  title: string
  content: string
  createdAt: Date
}

export interface DigResult {
  selectedText: string
  explanation: string
  loading: boolean
}

export interface SelectionPosition {
  x: number
  y: number
}

export type Language = 'zh' | 'en'

// EPUB 相关类型
export interface ParsedEpub {
  title: string
  author: string
  chapters: Chapter[]
  toc: TocItem[]
  cover?: string
}

export interface Chapter {
  id: string
  href: string
  title: string
  content: string
  order: number
}

export interface TocItem {
  id: string
  title: string
  href: string
  level: number
  children?: TocItem[]
}
