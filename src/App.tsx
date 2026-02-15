import { useState } from "react"
import { ArticleInput } from "./components/ArticleInput"
import { ArticleReader } from "./components/ArticleReader"
import { EpubReader } from "./components/EpubReader"
import type { Article, Language } from "./types"
import type { ParsedBook } from "./services/fileParser"
import "./index.css"

type ViewMode = 'input' | 'article' | 'epub'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('input')
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null)
  const [currentBook, setCurrentBook] = useState<ParsedBook | null>(null)
  const [language, setLanguage] = useState<Language>('zh')

  const handleArticleSubmit = (title: string, content: string, selectedLanguage: Language) => {
    const newArticle: Article = {
      id: Date.now().toString(),
      title,
      content,
      createdAt: new Date(),
    }
    setLanguage(selectedLanguage)
    setCurrentArticle(newArticle)
    setViewMode('article')
  }

  const handleBookSubmit = (book: ParsedBook, selectedLanguage: Language) => {
    setLanguage(selectedLanguage)
    setCurrentBook(book)
    setViewMode('epub')
  }

  const handleBack = () => {
    setViewMode('input')
    setCurrentArticle(null)
    setCurrentBook(null)
  }

  return (
    <>
      {viewMode === 'input' && (
        <ArticleInput
          onSubmit={handleArticleSubmit}
          onEpubSubmit={handleBookSubmit}
        />
      )}
      {viewMode === 'article' && currentArticle && (
        <ArticleReader
          article={currentArticle}
          language={language}
          onBack={handleBack}
        />
      )}
      {viewMode === 'epub' && currentBook && (
        <EpubReader
          epub={currentBook}
          language={language}
          onBack={handleBack}
        />
      )}
    </>
  )
}

export default App
