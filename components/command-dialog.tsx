import React, { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@supabase/supabase-js'

interface CommandDialogProps {
  portalId: string
  apiKey: string
  dispatchId: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CommandDialog = ({ portalId, apiKey, dispatchId }: CommandDialogProps) => {
  const [sourceTable, setSourceTable] = useState('your_source_table')
  const [destTable, setDestTable] = useState('your_destination_table')
  const [destCreds, setDestCreds] = useState({})
  const [hostUrl, setHostUrl] = useState('')

  useEffect(() => {
    const fetchHostUrl = async () => {
      const { data, error } = await supabase
        .from('portals')
        .select('lambda_url')
        .eq('id', portalId)
        .single()

      if (error) {
        console.error('Error fetching host URL:', error)
        return
      }

      if (data) {
        setHostUrl(data.lambda_url)
      }
    }

    fetchHostUrl()
  }, [portalId])

  const curlCommand = `curl -X 'POST' \\
  '${hostUrl}dispatch' \\
  -H 'X-API-Key: ${apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "runner": "clickhouse",
    "portal_id": "${portalId}",
    "dispatch_id": "${dispatchId}",
    "source_table": "${sourceTable}",
    "destination_table": "${destTable}",
    "source_credentials": {},
    "destination_credentials": ${JSON.stringify(destCreds, null, 2)}
  }'`

  const fetchCommand = `const response = await fetch('${hostUrl}dispatch', {
  method: 'POST',
  headers: {
    'X-API-Key': '${apiKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    runner: 'clickhouse',
    portal_id: '${portalId}',
    dispatch_id: '${dispatchId}',
    source_table: '${sourceTable}',
    destination_table: '${destTable}',
    source_credentials: {},
    destination_credentials: ${JSON.stringify(destCreds, null, 2)}
  })
})`

  const copyToClipboard = (command: string) => {
    navigator.clipboard.writeText(command)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="ml-4">
          View API Command
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>API Command</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="curl" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="curl">Curl</TabsTrigger>
            <TabsTrigger value="fetch">Fetch</TabsTrigger>
          </TabsList>
          
          <TabsContent value="curl" className="relative">
            <div className="relative">
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
                <code className="text-sm">{curlCommand}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(curlCommand)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="fetch">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sourceTable">Source Table</Label>
                  <Input
                    id="sourceTable"
                    value={sourceTable}
                    onChange={(e) => setSourceTable(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destTable">Destination Table</Label>
                  <Input
                    id="destTable"
                    value={destTable}
                    onChange={(e) => setDestTable(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="relative">
                <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
                  <code className="text-sm">{fetchCommand}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(fetchCommand)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default CommandDialog