import 'jsr:@std/dotenv/load'

import { Client } from 'npm:basic-ftp'
import { useEDIAction } from '@/useEDI.ts'
import { FTPConfig } from '@/types.ts'
import { Order } from '@/lib/supabase/types/tables.ts'
import { saveFile, saveOrder } from '@/lib/supabase/actions.ts'

type WatcherState = {
  isRunning: boolean
}

const interval = Number(Deno.env.get('WATCHER_INTERVAL')!)

const createFTPClient = (config: FTPConfig) => {
  const client = new Client()

  return {
    connect: async () => {
      await client.access({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password
      })
      await client.cd(config.directory)
      console.log('Connected to FTP server')
      return client
    },
    disconnect: () => client.close()
  }
}

const downloadFile = async (client: Client, dest: string): Promise<string> => {
  const tmpPath = await Deno.makeTempFile()
  await client.downloadTo(tmpPath, dest)

  const content = await Deno.readTextFile(tmpPath)
  await Deno.remove(tmpPath)

  return content
}

const uploadAckFile = async ({
  client,
  name,
  file
}: {
  order: Order
  client: Client
  name: string
  file: Blob
}) => {
  console.log('Uploading 997 file:', file)

  // Convert Blob to ArrayBuffer
  const buffer = await file.arrayBuffer()

  // Create a temporary directory and file path
  const tmpPath = await Deno.makeTempDir()
  const filename = `997_${name}`
  const filePath = `${tmpPath}/${filename}`

  try {
    // Write the file to the temp directory
    await Deno.writeFile(filePath, new Uint8Array(buffer))
    await client.cd('/IN')

    // Upload the file to the FTP server
    await client.uploadFrom(filePath, `${filename}`)
    console.log(`File uploaded to FTP: ${await client.pwd()}/${filename}`)
  } catch (error) {
    console.error('Error uploading file:', error)
  } finally {
    await Deno.remove(tmpPath, { recursive: true })
    await client.cd('/OUT')
    await client.rename(name, `_${name}`) // Mark the file as processed
  }
}

export async function dispatchToFlowSync(order: Order) {
  console.log('Creating Shopify order:', order.customer_id)

  const flowsyncUrl = Deno.env.get('FLOWSYNC_API_URL')!

  type FlowSyncResponse = {
    status: 'success' | 'error'
    message: string
  }

  try {
    const res = await fetch(`${flowsyncUrl}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    })

    const { status, message }: FlowSyncResponse = await res.json()

    if (status === 'error') {
      console.error('Failed to create Shopify order:', message)
    }

    console.log(message)
  } catch (error) {
    console.error('Error creating Shopify order:', error)
  }
}

const processEDIFile = async (
  filename: string,
  content: string,
  kv: Deno.Kv
) => {
  console.log('Processing EDI file:', filename)
  const { parse, validate, createAck } = useEDIAction()

  try {
    // 1. Read the 850
    const { po, json } = await parse(content)

    if (!po) return

    // 2. Validate the 850
    const result = await validate(json[0])

    if (!result.valid) {
      console.log('File failed validation')
      return
    }

    // 3. Acknowledge the 850
    const ack = await createAck(json[0])

    // 4. Create the 997 and 850 blobs for storage
    const edi_997_blob = new Blob([ack], { type: 'text/plain' })
    const edi_850_blob = new Blob([content], { type: 'text/plain' })

    // 5. Save the order and EDI files
    const order = await saveOrder(po)

    await saveFile(edi_850_blob, filename, '850')
    await saveFile(edi_997_blob, `997_${filename}`, '997')

    return {
      ack: edi_997_blob,
      order
    }
  } catch (error) {
    console.error(`Error processing EDI file. ${error}`)
  }
}

export const createWatcher = () => {
  const ftpClient = createFTPClient({
    host: '127.0.0.1',
    port: 2121,
    username: 'testuser',
    password: 'password123',
    directory: 'OUT'
  })

  const state: WatcherState = {
    isRunning: false
  }

  const processFiles = async (client: Client, kv: Deno.Kv) => {
    const files = await client.list()

    for (const { name } of files) {
      // Skip files that have already been processed
      if (name.startsWith('.') || name.startsWith('_')) {
        continue
      }

      // Download the 850
      const content = await downloadFile(client, name)

      // Process the 850 and create the 997
      const result = await processEDIFile(name, content, kv)

      // Upload the 997 and create the Shopify order
      if (result) {
        const { ack, order } = result

        if (order) {
          await dispatchToFlowSync(order)
          await uploadAckFile({
            client,
            order,
            name,
            file: ack
          })
        }
      }
    }
  }

  const start = async (kv: Deno.Kv) => {
    state.isRunning = true
    const client = await ftpClient.connect()

    console.info('Watcher service running.')

    while (state.isRunning) {
      try {
        await processFiles(client, kv)

        // Delay before checking for new files
        await new Promise((resolve) => {
          setTimeout(resolve, interval)
        })
      } catch (_error) {
        console.error('Failed to start watcher')
      }
    }

    ftpClient.disconnect()
  }

  const stop = () => {
    state.isRunning = false
  }

  return {
    start,
    stop
  }
}
