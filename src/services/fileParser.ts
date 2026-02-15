import JSZip from "jszip"
import * as pdfjsLib from "pdfjs-dist"

// 设置 worker 路径（添加版本号避免缓存问题）
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js?v=3.11.174"

// 检测文本是否主要是中文
function isMainlyChinese(text: string): boolean {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || []
  return chineseChars.length > text.length * 0.3
}

// 智能连接文本项（中文不加分隔符，英文加空格）
function smartJoinText(items: string[]): string {
  if (items.length === 0) return ''
  
  // 检测整体是否主要是中文
  const allText = items.join('')
  if (isMainlyChinese(allText)) {
    // 中文内容，直接连接，不添加空格
    return items.join('')
  }
  
  // 英文内容，用空格连接
  return items.join(' ')
}

// 解析 PDF 文件
async function parsePdfWithPdfjs(arrayBuffer: ArrayBuffer, fileName: string): Promise<{
  title: string
  author: string
  chapters: Chapter[]
  toc: TocItem[]
}> {
  const pdf = await pdfjsLib.getDocument({ 
    data: arrayBuffer,
  }).promise
  
  const allContent: string[] = []
  
  // 提取所有页面的文本，保留结构
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    
    // 按 Y 坐标分组文本项，形成行
    const items = textContent.items as any[]
    const lines: Map<number, Array<{text: string; x: number}>> = new Map()
    
    for (const item of items) {
      if (!item.str) continue // 保留空格，只跳过 undefined
      const y = Math.round(item.transform[5]) // Y 坐标
      const x = item.transform[4] // X 坐标
      const existingLine = lines.get(y) || []
      existingLine.push({ text: item.str, x })
      lines.set(y, existingLine)
    }
    
    // 按 Y 坐标降序排列（PDF 的 Y 坐标从上到下递减）
    const sortedYs = Array.from(lines.keys()).sort((a, b) => b - a)
    
    for (const y of sortedYs) {
      const lineItems = lines.get(y) || []
      // 按 X 坐标排序
      lineItems.sort((a, b) => a.x - b.x)
      
      // 智能连接文本
      const lineText = smartJoinText(lineItems.map(item => item.text))
      allContent.push(lineText)
    }
    
    // 页面之间添加分隔
    allContent.push('')
  }
  
  // 尝试从 PDF 元数据获取标题
  let title = fileName
  let author = 'Unknown'
  try {
    const metadata = await pdf.getMetadata()
    const info = metadata.info as Record<string, string> | undefined
    title = info?.Title || fileName
    author = info?.Author || 'Unknown'
  } catch (e) {
    // 忽略元数据读取错误
  }
  
  // 将内容转换为 HTML
  const htmlContent = allContent
    .map(line => {
      if (!line.trim()) return '<div class="h-4"></div>' // 空行
      return `<p class="mb-1 leading-relaxed">${escapeHtml(line)}</p>`
    })
    .join('\n')
  
  // 创建一个章节包含所有内容
  const chapters: Chapter[] = [{
    id: 'ch-0',
    href: '#ch-0',
    title: title,
    content: htmlContent,
    order: 0
  }]
  
  // 生成目录
  const toc: TocItem[] = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    href: ch.href,
    level: 0
  }))
  
  return { title, author, chapters, toc }
}

export interface ParsedBook {
  title: string
  author: string
  chapters: Chapter[]
  toc: TocItem[]
  cover?: string
  images: Map<string, string>
  opfDir: string
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

// 生成默认封面 SVG
function generateDefaultCover(title: string, type: string): string {
  const encodedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
  
  const shortTitle = encodedTitle.length > 20 
    ? encodedTitle.substring(0, 20) + '...' 
    : encodedTitle
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f97316;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="300" height="400" fill="url(#grad)"/>
    <rect x="20" y="20" width="260" height="360" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <text x="150" y="180" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${shortTitle}</text>
    <text x="150" y="220" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="rgba(255,255,255,0.8)" text-anchor="middle">${type}</text>
  </svg>`
  
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

// HTML 转义
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 解析 TXT 文件
async function parseTxtFile(file: File): Promise<ParsedBook> {
  const text = await file.text()
  const fileName = file.name.replace(/\.txt$/i, '')
  
  // 尝试从内容中提取标题（第一行）
  const lines = text.split('\n').filter(line => line.trim())
  const title = lines[0]?.trim() || fileName
  
  // 将文本按章节分割（尝试识别章节标题）
  const chapters: Chapter[] = []
  const chapterPattern = /^(第[一二三四五六七八九十百千万\d]+章|Chapter\s+\d+|\d+\.|【.*?】|.*?章\s*[:：])/im
  
  let currentChapter: Chapter | null = null
  let chapterContent: string[] = []
  let chapterIndex = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 检查是否是章节标题
    if (chapterPattern.test(line) || i === 0) {
      // 保存之前的章节
      if (currentChapter) {
        currentChapter.content = chapterContent.join('\n')
          .split('\n\n')
          .map(p => `<p class="mb-4">${escapeHtml(p)}</p>`)
          .join('')
      }
      
      // 创建新章节
      currentChapter = {
        id: `ch-${chapterIndex}`,
        href: `#ch-${chapterIndex}`,
        title: line.trim(),
        content: '',
        order: chapterIndex
      }
      chapters.push(currentChapter)
      chapterContent = []
      chapterIndex++
    } else {
      chapterContent.push(line)
    }
  }
  
  // 保存最后一个章节
  if (currentChapter && chapterContent.length > 0) {
    currentChapter.content = chapterContent.join('\n')
      .split('\n\n')
      .map(p => `<p class="mb-4">${escapeHtml(p)}</p>`)
      .join('')
  }
  
  // 如果没有识别到章节，将整个文本作为一个章节
  if (chapters.length === 0) {
    chapters.push({
      id: 'ch-0',
      href: '#ch-0',
      title: title,
      content: text.split('\n\n')
        .map(p => `<p class="mb-4">${escapeHtml(p)}</p>`)
        .join(''),
      order: 0
    })
  }
  
  // 生成目录
  const toc: TocItem[] = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    href: ch.href,
    level: 0
  }))
  
  return {
    title: title,
    author: 'Unknown',
    chapters,
    toc,
    cover: generateDefaultCover(title, 'TXT'),
    images: new Map(),
    opfDir: ''
  }
}

// 解析 PDF 文件
async function parsePdfFile(file: File): Promise<ParsedBook> {
  const arrayBuffer = await file.arrayBuffer()
  const fileName = file.name.replace(/\.pdf$/i, '')
  
  const { title, author, chapters, toc } = await parsePdfWithPdfjs(arrayBuffer, fileName)
  
  return {
    title,
    author,
    chapters,
    toc,
    cover: generateDefaultCover(title, 'PDF'),
    images: new Map(),
    opfDir: ''
  }
}

// 解析 EPUB 文件（复用原有逻辑）
async function parseEpubFile(file: File): Promise<ParsedBook> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  // 1. 找到 META-INF/container.xml
  const containerFile = zip.file("META-INF/container.xml")
  if (!containerFile) {
    throw new Error("无效的 EPUB 文件：找不到 container.xml")
  }
  
  const containerXml = await containerFile.async("text")
  const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml")
  const rootfile = containerDoc.querySelector("rootfile")
  const opfPath = rootfile?.getAttribute("full-path")
  
  if (!opfPath) {
    throw new Error("无效的 EPUB 文件：找不到 OPF 文件路径")
  }
  
  // 2. 解析 OPF 文件
  const opfFile = zip.file(opfPath)
  if (!opfFile) {
    throw new Error("无效的 EPUB 文件：找不到 OPF 文件")
  }
  
  const opfXml = await opfFile.async("text")
  const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml")
  
  // 3. 提取元数据
  const title = opfDoc.querySelector("metadata title")?.textContent || "未知标题"
  const author = opfDoc.querySelector("metadata creator")?.textContent || "未知作者"
  
  // 4. 解析 manifest
  const manifestItems: Array<{id: string, href: string, "media-type": string, properties?: string}> = []
  const manifestItems_nodes = opfDoc.querySelectorAll("manifest item")
  manifestItems_nodes.forEach(item => {
    manifestItems.push({
      id: item.getAttribute("id") || "",
      href: item.getAttribute("href") || "",
      "media-type": item.getAttribute("media-type") || "",
      properties: item.getAttribute("properties") || undefined
    })
  })
  
  // 5. 解析 spine（阅读顺序）
  const spineItems: Array<{idref: string}> = []
  const spineItems_nodes = opfDoc.querySelectorAll("spine itemref")
  spineItems_nodes.forEach(item => {
    spineItems.push({
      idref: item.getAttribute("idref") || ""
    })
  })
  
  // 6. 获取 OPF 文件所在目录
  const opfDir = opfPath.includes("/") 
    ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1)
    : ""
  
  // 7. 提取图片
  const images = new Map<string, string>()
  const imageItems = manifestItems.filter(item => 
    item["media-type"].startsWith('image/') ||
    item.href.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp)$/i)
  )
  
  for (const item of imageItems) {
    const imagePath = opfDir + item.href
    const imageFile = zip.file(imagePath)
    if (imageFile) {
      try {
        const blob = await imageFile.async("blob")
        const blobUrl = URL.createObjectURL(blob)
        images.set(item.href, blobUrl)
        images.set(imagePath, blobUrl)
        const fileName = item.href.split('/').pop()
        if (fileName) {
          images.set(fileName, blobUrl)
        }
        images.set('./' + item.href, blobUrl)
      } catch (e) {
        console.warn(`Failed to extract image: ${imagePath}`, e)
      }
    }
  }
  
  // 8. 提取封面
  let cover: string | undefined
  const coverItem = manifestItems.find(item => 
    item.properties === 'cover-image' ||
    item.id.toLowerCase().includes('cover') ||
    item.href.toLowerCase().includes('cover')
  )
  
  if (coverItem) {
    const coverPath = opfDir + coverItem.href
    const coverFile = zip.file(coverPath)
    if (coverFile) {
      const blob = await coverFile.async("blob")
      cover = URL.createObjectURL(blob)
    }
  }
  
  if (!cover) {
    cover = generateDefaultCover(title, 'EPUB')
  }
  
  // 9. 解析章节内容
  const chapters: Chapter[] = []
  let order = 0
  
  for (const spineItem of spineItems) {
    const manifestItem = manifestItems.find(item => item.id === spineItem.idref)
    if (!manifestItem) continue
    
    // 跳过非内容文件
    if (manifestItem["media-type"] !== "application/xhtml+xml" && 
        manifestItem["media-type"] !== "text/html") {
      continue
    }
    
    const chapterPath = opfDir + manifestItem.href
    const chapterFile = zip.file(chapterPath)
    if (!chapterFile) continue
    
    const chapterHtml = await chapterFile.async("text")
    const chapterDoc = new DOMParser().parseFromString(chapterHtml, "text/html")
    
    // 提取标题
    let chapterTitle = chapterDoc.querySelector("h1, h2, title")?.textContent?.trim() || 
                      `章节 ${order + 1}`
    
    // 清理内容
    const body = chapterDoc.body
    body.querySelectorAll("script, style, nav, header, footer").forEach(el => el.remove())
    
    // 处理图片路径
    body.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src')
      if (src && !src.startsWith('blob:') && !src.startsWith('data:') && !src.startsWith('http')) {
        const possiblePaths = [
          src,
          src.replace(/^\.\.?\//, ''),
          opfDir + src,
          opfDir + src.replace(/^\.\.?\//, ''),
        ]
        
        for (const path of possiblePaths) {
          const blobUrl = images.get(path)
          if (blobUrl) {
            img.setAttribute('src', blobUrl)
            break
          }
        }
      }
    })
    
    chapters.push({
      id: `ch-${order}`,
      href: manifestItem.href,
      title: chapterTitle,
      content: body.innerHTML,
      order: order
    })
    
    order++
  }
  
  // 10. 生成目录
  const toc: TocItem[] = chapters.map(ch => ({
    id: ch.id,
    title: ch.title,
    href: ch.href,
    level: 0
  }))
  
  return {
    title,
    author,
    chapters,
    toc,
    cover,
    images,
    opfDir
  }
}

// 解析 Markdown 文件
async function parseMdFile(file: File): Promise<ParsedBook> {
  const text = await file.text()
  const fileName = file.name.replace(/\.md$/i, '')
  
  // 尝试从内容中提取标题（第一个 # 标题）
  const titleMatch = text.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : fileName
  
  // 将 Markdown 按章节分割（按 # 或 ## 标题分割）
  const chapters: Chapter[] = []
  const lines = text.split('\n')
  let currentChapter: { title: string; content: string[] } | null = null
  let chapterIndex = 0
  
  for (const line of lines) {
    // 检查是否是一级或二级标题
    const h1Match = line.match(/^#\s+(.+)$/)
    const h2Match = line.match(/^##\s+(.+)$/)
    
    if (h1Match || h2Match) {
      // 保存之前的章节
      if (currentChapter) {
        chapters.push({
          id: `ch-${chapterIndex}`,
          href: `#ch-${chapterIndex}`,
          title: currentChapter.title,
          content: markdownToHtml(currentChapter.content.join('\n')),
          order: chapterIndex
        })
        chapterIndex++
      }
      
      // 创建新章节
      currentChapter = {
        title: (h1Match || h2Match)![1].trim(),
        content: []
      }
    } else if (currentChapter) {
      currentChapter.content.push(line)
    } else {
      // 如果还没有章节，创建一个默认章节
      if (line.trim()) {
        currentChapter = {
          title: title,
          content: [line]
        }
      }
    }
  }
  
  // 保存最后一个章节
  if (currentChapter && currentChapter.content.length > 0) {
    chapters.push({
      id: `ch-${chapterIndex}`,
      href: `#ch-${chapterIndex}`,
      title: currentChapter.title,
      content: markdownToHtml(currentChapter.content.join('\n')),
      order: chapterIndex
    })
  }
  
  // 如果没有识别到章节，将整个文本作为一个章节
  if (chapters.length === 0) {
    chapters.push({
      id: 'ch-0',
      href: '#ch-0',
      title: title,
      content: markdownToHtml(text),
      order: 0
    })
  }
  
  // 生成目录
  const toc: TocItem[] = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    href: ch.href,
    level: 0
  }))
  
  return {
    title: title,
    author: 'Unknown',
    chapters,
    toc,
    cover: generateDefaultCover(title, 'MD'),
    images: new Map(),
    opfDir: ''
  }
}

// 简单的 Markdown 转 HTML
function markdownToHtml(text: string): string {
  const lines = text.split('\n')
  const htmlParts: string[] = []
  let inCodeBlock = false
  let codeContent: string[] = []
  let listItems: string[] = []
  
  const flushList = () => {
    if (listItems.length > 0) {
      htmlParts.push('<ul class="list-disc list-inside mb-4 space-y-1">')
      for (const item of listItems) {
        htmlParts.push(`<li>${item}</li>`)
      }
      htmlParts.push('</ul>')
      listItems = []
    }
  }
  
  for (let line of lines) {
    // 代码块
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        htmlParts.push('<pre class="bg-gray-100 p-4 rounded-lg mb-4 overflow-x-auto"><code>' + escapeHtml(codeContent.join('\n')) + '</code></pre>')
        codeContent = []
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
      }
      continue
    }
    
    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }
    
    // 空行
    if (!line.trim()) {
      flushList()
      continue
    }
    
    // 列表项
    const listMatch = line.match(/^[-*+]\s+(.+)$/)
    if (listMatch) {
      listItems.push(parseInlineMarkdown(listMatch[1]))
      continue
    }
    
    // 有序列表
    const orderedListMatch = line.match(/^\d+\.\s+(.+)$/)
    if (orderedListMatch) {
      listItems.push(parseInlineMarkdown(orderedListMatch[1]))
      continue
    }
    
    flushList()
    
    // 引用
    if (line.startsWith('> ')) {
      htmlParts.push('<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-4">' + parseInlineMarkdown(line.slice(2)) + '</blockquote>')
      continue
    }
    
    // 标题（已在章节分割时处理，这里处理剩余的）
    if (line.startsWith('### ')) {
      htmlParts.push('<h3 class="text-lg font-semibold mb-2 mt-4">' + parseInlineMarkdown(line.slice(4)) + '</h3>')
      continue
    }
    if (line.startsWith('#### ')) {
      htmlParts.push('<h4 class="text-base font-semibold mb-2 mt-4">' + parseInlineMarkdown(line.slice(5)) + '</h4>')
      continue
    }
    
    // 水平线
    if (line.match(/^[-*_]{3,}$/)) {
      htmlParts.push('<hr class="my-6 border-gray-200">')
      continue
    }
    
    // 图片
    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch && line.trim() === imgMatch[0]) {
      htmlParts.push(`<img src="${imgMatch[2]}" alt="${imgMatch[1]}" class="max-w-full h-auto rounded-lg mb-4">`)
      continue
    }
    
    // 普通段落
    htmlParts.push('<p class="mb-4 leading-relaxed">' + parseInlineMarkdown(line) + '</p>')
  }
  
  flushList()
  
  // 处理代码块结束
  if (inCodeBlock && codeContent.length > 0) {
    htmlParts.push('<pre class="bg-gray-100 p-4 rounded-lg mb-4 overflow-x-auto"><code>' + escapeHtml(codeContent.join('\n')) + '</code></pre>')
  }
  
  return htmlParts.join('\n')
}

// 解析行内 Markdown（加粗、斜体、链接、代码）
function parseInlineMarkdown(text: string): string {
  // 转义 HTML
  text = escapeHtml(text)
  
  // 行内代码
  text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
  
  // 加粗
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  
  // 斜体
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>')
  
  // 链接
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
  
  return text
}

// 主解析函数
export async function parseFile(file: File): Promise<ParsedBook> {
  const fileName = file.name.toLowerCase()
  
  if (fileName.endsWith('.epub')) {
    return parseEpubFile(file)
  } else if (fileName.endsWith('.pdf')) {
    return parsePdfFile(file)
  } else if (fileName.endsWith('.txt')) {
    return parseTxtFile(file)
  } else if (fileName.endsWith('.md')) {
    return parseMdFile(file)
  } else {
    throw new Error('不支持的文件格式，请上传 EPUB、PDF、TXT 或 MD 文件')
  }
}
