import React from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'

interface CurlCommandDialogProps {
  portalId: string
  apiKey: string
  dispatchId: string
}

const CurlCommandDialog = ({ portalId, apiKey, dispatchId }: CurlCommandDialogProps) => {
  const curlCommand = `curl -X 'POST' \\
  'http://127.0.0.1:8000/import' \\
  -H 'X-API-Key: ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "runner": "clickhouse",
    "portal_id": "${portalId}",
    "dispatch_id": "${dispatchId}",
    "source_table": "your_source_table",
    "destination_table": "your_destination_table",
    "source_credentials": {},
    "destination_credentials": {}
  }'`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(curlCommand)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="ml-4">
          View API Command
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>API Command</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
            <code className="text-sm">{curlCommand}</code>
          </pre>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={copyToClipboard}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CurlCommandDialog