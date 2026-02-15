import JSZip from "jszip"

export interface ParsedEpub {
  title: string
  author: string
  chapters: Chapter[]
  toc: TocItem[]
  cover?: string
  images: Map<string, string> // 存储图片路径到 Blob URL 的映射
  opfDir: string // OPF 文件所在目录
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

interface EpubManifest {
  id: string
  href: string
  "media-type": string
  properties?: string
}

interface EpubSpineItem {
  idref: string
}

// 生成默认封面 SVG
function generateDefaultCover(title: string): string {
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
    <text x="150" y="220" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="rgba(255,255,255,0.8)" text-anchor="middle">EPUB</text>
  </svg>`
  
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

// 尝试从 EPUB 中提取封面
async function extractCover(
  zip: JSZip,
  opfDir: string,
  manifestItems: EpubManifest[],
  opfDoc: Document
): Promise<string | undefined> {
  // 1. 查找 manifest 中带有 cover-image 属性的项
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
      return URL.createObjectURL(blob)
    }
  }
  
  // 2. 查找 OPF metadata 中的 cover 元数据
  const coverMeta = opfDoc.querySelector('meta[name="cover"]')
  if (coverMeta) {
    const coverId = coverMeta.getAttribute('content')
    if (coverId) {
      const coverManifestItem = manifestItems.find(item => item.id === coverId)
      if (coverManifestItem) {
        const coverPath = opfDir + coverManifestItem.href
        const coverFile = zip.file(coverPath)
        if (coverFile) {
          const blob = await coverFile.async("blob")
          return URL.createObjectURL(blob)
        }
      }
    }
  }
  
  // 3. 查找常见的封面文件名
  const commonCoverNames = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.gif']
  for (const coverName of commonCoverNames) {
    const coverPath = opfDir + coverName
    const coverFile = zip.file(coverPath)
    if (coverFile) {
      const blob = await coverFile.async("blob")
      return URL.createObjectURL(blob)
    }
  }
  
  return undefined
}

// 提取所有图片并创建 Blob URL 映射
async function extractImages(
  zip: JSZip,
  opfDir: string,
  manifestItems: EpubManifest[]
): Promise<Map<string, string>> {
  const images = new Map<string, string>()
  
  // 查找所有图片类型的文件
  const imageItems = manifestItems.filter(item => 
    item["media-type"].startsWith('image/') ||
    item.href.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp)$/i)
  )
  
  console.log(`Found ${imageItems.length} images in manifest`)
  
  for (const item of imageItems) {
    // 确保路径正确拼接
    const imagePath = opfDir ? opfDir + item.href : item.href
    console.log(`Trying to extract image: ${imagePath} (href: ${item.href})`)
    
    const imageFile = zip.file(imagePath)
    if (imageFile) {
      try {
        const blob = await imageFile.async("blob")
        const blobUrl = URL.createObjectURL(blob)
        
        // 存储多种路径形式的映射，以便匹配
        images.set(item.href, blobUrl)
        images.set(imagePath, blobUrl)
        
        // 存储纯文件名（不含目录）
        const fileName = item.href.split('/').pop()
        if (fileName) {
          images.set(fileName, blobUrl)
          console.log(`  -> Stored as: ${fileName}`)
        }
        
        // 存储带 ./ 的相对路径
        images.set('./' + item.href, blobUrl)
        
        console.log(`  -> Successfully extracted: ${item.href}`)
      } catch (e) {
        console.warn(`Failed to extract image: ${imagePath}`, e)
      }
    } else {
      console.warn(`  -> Image file not found in zip: ${imagePath}`)
    }
  }
  
  console.log(`Total images stored: ${images.size}`)
  return images
}

// 处理 HTML 内容中的图片路径
function processImagePaths(
  html: string,
  images: Map<string, string>,
  chapterHref: string,
  opfDir: string
): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  
  // 获取章节所在目录
  const chapterDir = chapterHref.includes('/') 
    ? chapterHref.substring(0, chapterHref.lastIndexOf('/') + 1)
    : ''
  
  console.log(`Processing images for chapter: ${chapterHref}`)
  console.log(`  chapterDir: ${chapterDir}`)
  console.log(`  opfDir: ${opfDir}`)
  console.log(`  Available images:`, Array.from(images.keys()))
  
  // 处理所有 img 标签
  doc.querySelectorAll('img').forEach((img, index) => {
    const src = img.getAttribute('src')
    if (src) {
      console.log(`  Processing img ${index}: src="${src}"`)
      
      // 如果已经是 blob URL，跳过
      if (src.startsWith('blob:')) {
        console.log(`    -> Already blob URL, skipping`)
        return
      }
      
      // 尝试多种路径形式查找图片
      const possiblePaths: string[] = []
      
      // 原始路径
      possiblePaths.push(src)
      
      // 移除 ./ 和 ../ 的路径
      const cleanSrc = src.replace(/^\.\.?\//, '')
      if (cleanSrc !== src) {
        possiblePaths.push(cleanSrc)
      }
      
      // 纯文件名
      const fileName = src.split('/').pop()
      if (fileName && fileName !== src) {
        possiblePaths.push(fileName)
      }
      
      // 带章节目录的组合
      if (chapterDir) {
        possiblePaths.push(chapterDir + src)
        possiblePaths.push(chapterDir + cleanSrc)
      }
      
      // 带 opfDir 的组合
      if (opfDir) {
        possiblePaths.push(opfDir + src)
        possiblePaths.push(opfDir + cleanSrc)
        if (chapterDir) {
          possiblePaths.push(opfDir + chapterDir + src)
          possiblePaths.push(opfDir + chapterDir + cleanSrc)
        }
      }
      
      console.log(`    -> Trying paths:`, possiblePaths)
      
      for (const path of possiblePaths) {
        const blobUrl = images.get(path)
        if (blobUrl) {
          console.log(`    -> Found match: ${path} -> blob URL`)
          img.setAttribute('src', blobUrl)
          return
        }
      }
      
      console.warn(`    -> No match found for: ${src}`)
    }
  })
  
  // 处理背景图片（style 属性）
  doc.querySelectorAll('[style*="background"], [style*="background-image"]').forEach(el => {
    const style = el.getAttribute('style')
    if (style) {
      const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/)
      if (urlMatch) {
        const src = urlMatch[1]
        
        // 如果已经是 blob URL，跳过
        if (src.startsWith('blob:')) return
        
        const possiblePaths = [
          src,
          src.replace(/^\.\.?\//, ''),
          src.split('/').pop() || src,
        ]
        
        if (chapterDir) {
          possiblePaths.push(chapterDir + src)
          possiblePaths.push(chapterDir + src.replace(/^\.\.?\//, ''))
        }
        
        if (opfDir) {
          possiblePaths.push(opfDir + src)
          possiblePaths.push(opfDir + src.replace(/^\.\.?\//, ''))
        }
        
        for (const path of possiblePaths) {
          const blobUrl = images.get(path)
          if (blobUrl) {
            const newStyle = style.replace(urlMatch[1], blobUrl)
            el.setAttribute('style', newStyle)
            break
          }
        }
      }
    }
  })
  
  return doc.body.innerHTML
}

export async function parseEpubFile(file: File): Promise<ParsedEpub> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // 找到 container.xml 来确定 OPF 文件位置
    const containerXml = await zip.file("META-INF/container.xml")?.async("text")
    if (!containerXml) {
      throw new Error("无效的 EPUB 文件：缺少 container.xml")
    }

    // 解析 container.xml 获取 OPF 文件路径
    const opfPathMatch = containerXml.match(/full-path="([^"]+)"/)
    if (!opfPathMatch) {
      throw new Error("无法找到 OPF 文件路径")
    }
    const opfPath = opfPathMatch[1]
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf("/") + 1) || ""
    
    console.log(`OPF path: ${opfPath}, opfDir: ${opfDir}`)

    // 读取 OPF 文件
    const opfContent = await zip.file(opfPath)?.async("text")
    if (!opfContent) {
      throw new Error("无法读取 OPF 文件")
    }

    // 解析 OPF 内容
    const parser = new DOMParser()
    const opfDoc = parser.parseFromString(opfContent, "application/xml")

    // 获取书名和作者
    const titleElement = opfDoc.querySelector("metadata > title, metadata > dc\\:title")
    const title = titleElement?.textContent || "未命名书籍"
    
    const authorElement = opfDoc.querySelector("metadata > creator, metadata > dc\\:creator")
    const author = authorElement?.textContent || "未知作者"

    // 获取 manifest
    const manifestItems: EpubManifest[] = []
    const manifestElements = opfDoc.querySelectorAll("manifest > item")
    manifestElements.forEach((item) => {
      manifestItems.push({
        id: item.getAttribute("id") || "",
        href: item.getAttribute("href") || "",
        "media-type": item.getAttribute("media-type") || "",
        properties: item.getAttribute("properties") || undefined,
      })
    })

    // 获取 spine（阅读顺序）
    const spineItems: EpubSpineItem[] = []
    const spineElements = opfDoc.querySelectorAll("spine > itemref")
    spineElements.forEach((item) => {
      spineItems.push({
        idref: item.getAttribute("idref") || "",
      })
    })

    // 先提取所有图片
    const images = await extractImages(zip, opfDir, manifestItems)

    // 解析章节
    const chapters: Chapter[] = []

    for (let i = 0; i < spineItems.length; i++) {
      const spineItem = spineItems[i]
      const manifestItem = manifestItems.find((item) => item.id === spineItem.idref)

      if (manifestItem && manifestItem.href) {
        const chapterPath = opfDir ? opfDir + manifestItem.href : manifestItem.href
        const chapterContent = await zip.file(chapterPath)?.async("text")

        if (chapterContent) {
          // 清理 HTML 内容
          let cleanedContent = cleanHtmlContent(chapterContent)
          
          // 处理图片路径
          cleanedContent = processImagePaths(cleanedContent, images, manifestItem.href, opfDir)
          
          // 提取标题
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = cleanedContent
          const h1 = tempDiv.querySelector("h1")
          const h2 = tempDiv.querySelector("h2")
          const chapterTitle = h1?.textContent || h2?.textContent || `章节 ${i + 1}`

          chapters.push({
            id: spineItem.idref,
            href: manifestItem.href,
            title: chapterTitle,
            content: cleanedContent,
            order: i,
          })
        }
      }
    }

    if (chapters.length === 0) {
      throw new Error("无法从 EPUB 中提取内容，请检查文件是否有效")
    }

    // 获取目录
    const toc = await parseToc(zip, opfDir, manifestItems, chapters)
    
    // 获取封面
    let cover = await extractCover(zip, opfDir, manifestItems, opfDoc)
    
    // 如果没有封面，生成默认封面
    if (!cover) {
      cover = generateDefaultCover(title)
    }

    return {
      title,
      author,
      chapters,
      toc,
      cover,
      images,
      opfDir,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error("解析 EPUB 失败")
  }
}

// 清理 HTML 内容，保留格式但移除脚本
function cleanHtmlContent(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  
  // 移除脚本和样式标签，但保留 class 和 id
  doc.querySelectorAll("script, style, link[rel='stylesheet']").forEach((el) => el.remove())
  
  // 获取 body 内容
  const body = doc.querySelector("body")
  if (!body) return html
  
  // 保留原始 HTML 结构
  return body.innerHTML
}

// 解析目录
async function parseToc(
  zip: JSZip,
  opfDir: string,
  manifestItems: EpubManifest[],
  chapters: Chapter[]
): Promise<TocItem[]> {
  const tocItems: TocItem[] = []
  
  // 查找 NCX 或 NAV 文件
  const ncxItem = manifestItems.find(item => 
    item["media-type"] === "application/x-dtbncx+xml" ||
    item.href.endsWith(".ncx")
  )
  
  const navItem = manifestItems.find(item =>
    item["media-type"] === "application/xhtml+xml" &&
    (item.href.includes("nav") || item.href.includes("toc"))
  )
  
  if (ncxItem) {
    // 解析 NCX 格式目录
    const ncxPath = opfDir ? opfDir + ncxItem.href : ncxItem.href
    const ncxContent = await zip.file(ncxPath)?.async("text")
    if (ncxContent) {
      const parser = new DOMParser()
      const ncxDoc = parser.parseFromString(ncxContent, "application/xml")
      const navPoints = ncxDoc.querySelectorAll("navMap > navPoint")
      
      navPoints.forEach((navPoint, index) => {
        const textEl = navPoint.querySelector("navLabel > text")
        const contentEl = navPoint.querySelector("content")
        const title = textEl?.textContent || `章节 ${index + 1}`
        const href = contentEl?.getAttribute("src") || ""
        
        tocItems.push({
          id: navPoint.getAttribute("id") || `toc-${index}`,
          title,
          href,
          level: 0,
        })
      })
    }
  } else if (navItem) {
    // 解析 NAV 格式目录
    const navPath = opfDir ? opfDir + navItem.href : navItem.href
    const navContent = await zip.file(navPath)?.async("text")
    if (navContent) {
      const parser = new DOMParser()
      const navDoc = parser.parseFromString(navContent, "text/html")
      const tocNav = navDoc.querySelector("nav[epub\\:type='toc'], nav.toc")
      
      if (tocNav) {
        const links = tocNav.querySelectorAll("li > a, li > span")
        links.forEach((link, index) => {
          const title = link.textContent || `章节 ${index + 1}`
          const href = link.getAttribute("href") || ""
          
          tocItems.push({
            id: `toc-${index}`,
            title,
            href,
            level: 0,
          })
        })
      }
    }
  }
  
  // 如果没有找到目录，使用章节列表
  if (tocItems.length === 0) {
    chapters.forEach((chapter) => {
      tocItems.push({
        id: chapter.id,
        title: chapter.title,
        href: chapter.href,
        level: 0,
      })
    })
  }
  
  return tocItems
}

// 根据 href 查找章节
export function findChapterByHref(chapters: Chapter[], href: string): Chapter | undefined {
  // 处理带锚点的 href
  const cleanHref = href.split('#')[0]
  return chapters.find(ch => ch.href === cleanHref || ch.href.endsWith(cleanHref))
}
