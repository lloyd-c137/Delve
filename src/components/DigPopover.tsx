import * as Popover from "@radix-ui/react-popover"
import { Sparkles, X, Loader2 } from "lucide-react"
import { cn } from "../lib/utils"
import type { DigResult, SelectionPosition, Language } from "../types"

interface DigPopoverProps {
  position: SelectionPosition
  digResult: DigResult | null
  onOpenChange: (open: boolean) => void
  onDig: () => void
  open: boolean
  isStreaming?: boolean
  language?: Language
}

export function DigPopover({
  position,
  digResult,
  onOpenChange,
  onDig,
  open,
  isStreaming = false,
  language = 'zh',
}: DigPopoverProps) {
  const isEnglish = language === 'en'
  const hasExplanation = digResult?.explanation && digResult.explanation.length > 0

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <div
          className="fixed pointer-events-none"
          style={{
            left: position.x,
            top: position.y,
          }}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cn(
            "z-50 w-80 rounded-lg border bg-white p-4 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          )}
          side="top"
          align="center"
          sideOffset={8}
        >
          {/* 初始状态：显示 Dig 按钮 */}
          {!hasExplanation && !digResult?.loading ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-gray-500">
                {isEnglish ? 'Selected: ' : '选中内容: '}
                <span className="font-medium text-gray-800">"{digResult?.selectedText}"</span>
              </p>
              <button
                onClick={onDig}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md",
                  "bg-gradient-to-r from-orange-400 to-pink-500",
                  "text-white text-sm font-medium",
                  "hover:from-orange-500 hover:to-pink-600",
                  "transition-all duration-200",
                  "shadow-md hover:shadow-lg"
                )}
              >
                <Sparkles className="w-4 h-4" />
                {isEnglish ? 'Dig it' : 'Dig 一下'}
              </button>
            </div>
          ) : /* 流式输出或加载状态：显示内容区域 */
          hasExplanation || isStreaming ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-orange-500 uppercase tracking-wider">
                  {isEnglish ? 'Dig Explanation' : 'Dig 解释'}
                </span>
                <div className="flex items-center gap-2">
                  {isStreaming && (
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                  )}
                  <Popover.Close className="rounded-full p-1 hover:bg-gray-100 transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </Popover.Close>
                </div>
              </div>
              <div className="text-sm text-gray-700 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                {digResult?.explanation}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-orange-500 animate-pulse" />
                )}
              </div>
            </div>
          ) : /* 纯加载状态 */
          (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
              <p className="text-sm text-gray-500">
                {isEnglish ? 'AI is thinking...' : 'AI 正在思考...'}
              </p>
            </div>
          )}
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
