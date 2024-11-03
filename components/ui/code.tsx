import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"

interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
  code: string
  language?: string
  title?: string
  showLineNumbers?: boolean
}

export function Code({
  code,
  language,
  title,
  showLineNumbers = false,
  className,
  ...props
}: CodeProps) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const copyToClipboard = React.useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
  }, [code])

  return (
    <div className="relative w-full">
      {title && (
        <div className="absolute top-0 left-0 right-12 h-9 rounded-t-lg border-b bg-muted px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{title}</span>
          </div>
        </div>
      )}
      <div className="absolute right-4 top-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={copyToClipboard}
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <pre
        className={cn(
          "mb-4 mt-6 overflow-x-auto rounded-lg border bg-muted px-4 py-4",
          title && "pt-12",
          className
        )}
        {...props}
      >
        <code className={cn("relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm", 
          language && `language-${language}`
        )}>
          {showLineNumbers ? (
            code.split('\n').map((line, i) => (
              <span key={i} className="block">
                <span className="inline-block w-8 text-muted-foreground">{i + 1}</span>
                {line}
              </span>
            ))
          ) : (
            code
          )}
        </code>
      </pre>
    </div>
  )
} 