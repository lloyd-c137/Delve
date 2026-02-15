import type { Language } from "../types"

const SILICON_FLOW_API_KEY = import.meta.env.VITE_SILICON_FLOW_API_KEY || ""
const API_URL = "https://api.siliconflow.cn/v1/chat/completions"
const MODEL = "THUDM/glm-4-9b-chat"

export interface StreamCallbacks {
  onChunk: (chunk: string) => void
  onComplete: () => void
  onError: (error: Error) => void
}

// 根据语言获取系统提示词
function getSystemPrompt(language: Language): string {
  if (language === 'en') {
    return "You are a reading assistant. Explain words or sentences concisely in 50-100 words."
  }
  return "你是阅读助手，简洁解释词语或句子含义，50-100字。"
}

// 根据语言构建用户提示词
function buildPrompt(selectedText: string, context: string, language: Language): string {
  // 限制上下文长度，提高响应速度
  const truncatedContext = context.length > 200 
    ? context.substring(0, 100) + '...' + context.substring(context.length - 100)
    : context
  
  if (language === 'en') {
    return `Explain the meaning of "${selectedText}". Context: ${truncatedContext}`
  }
  return `解释"${selectedText}"的含义。上下文：${truncatedContext}`
}

export async function explainTextStream(
  selectedText: string, 
  context: string,
  language: Language,
  callbacks: StreamCallbacks
): Promise<void> {
  if (!SILICON_FLOW_API_KEY) {
    callbacks.onError(new Error("请设置 VITE_SILICON_FLOW_API_KEY 环境变量"))
    return
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SILICON_FLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: getSystemPrompt(language)
          },
          {
            role: "user",
            content: buildPrompt(selectedText, context, language)
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API请求失败: ${response.status}`)
    }

    if (!response.body) {
      throw new Error("响应体为空")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.trim() === '') continue
        if (line.trim() === 'data: [DONE]') {
          callbacks.onComplete()
          return
        }

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const content = data.choices?.[0]?.delta?.content
            if (content) {
              callbacks.onChunk(content)
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    callbacks.onComplete()
  } catch (error) {
    console.error("AI解释失败:", error)
    callbacks.onError(error instanceof Error ? error : new Error("未知错误"))
  }
}

// 保持向后兼容的非流式方法
export async function explainText(
  selectedText: string, 
  context: string, 
  language: Language = 'zh'
): Promise<string> {
  if (!SILICON_FLOW_API_KEY) {
    throw new Error("请设置 VITE_SILICON_FLOW_API_KEY 环境变量")
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SILICON_FLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: getSystemPrompt(language)
          },
          {
            role: "user",
            content: buildPrompt(selectedText, context, language)
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API请求失败: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || "无法获取解释"
  } catch (error) {
    console.error("AI解释失败:", error)
    throw error
  }
}
