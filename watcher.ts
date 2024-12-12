// ftpWatcher.ts
import { Client } from 'npm:basic-ftp'
import { OrderDogParser } from './parser.ts'
import { FTPConfig } from './types.ts'

export class WatcherService {
  private ftp: Client
  private parser: OrderDogParser
  private kv: Deno.Kv
  private processedFiles: Set<string>
  private isRunning: boolean

  constructor(private config: FTPConfig, kv: Deno.Kv) {
    this.ftp = new Client()
    this.parser = new OrderDogParser()
    this.kv = kv
    this.processedFiles = new Set()
    this.isRunning = false
  }

  async connect(): Promise<void> {
    try {
      await this.ftp.access({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
      })

      await this.ftp.cd(this.config.directory)
      console.log('Connected to FTP server')
    } catch (error) {
      console.error('FTP connection error:', error)
      throw error
    }
  }

  async start(pollInterval = 7000): Promise<void> {
    this.isRunning = true

    while (this.isRunning) {
      try {
        // List files in the directory
        const files = await this.ftp.list()

        // Process new files
        for (const { name } of files) {
          // Skip already processed files and files starting with "_"
          if (this.processedFiles.has(name) || name.startsWith('_')) {
            continue
          }

          await this.processFile(name)
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      } catch (error) {
        console.error('Error in watch loop:', error)

        // Try to reconnect
        try {
          await this.connect()
        } catch (reconnectError) {
          console.error('Reconnection failed:', reconnectError)
        }
      }
    }
  }

  private async processFile(filename: string): Promise<void> {
    console.log(`Processing file: ${filename}`)

    try {
      // Get EDI file
      const tmpPath = await Deno.makeTempFile()
      await this.ftp.downloadTo(tmpPath, filename)

      // Parse EDI file
      const file = await Deno.readTextFile(tmpPath)
      const PO = await this.parser.parseEDI(file)

      console.log('received purchase order:', PO)

      // Store PO in KV
      await this.kv.set(['orders', PO.header.poNumber], PO)

      // Rename file to mark as processed
      await this.ftp.rename(filename, `_${filename}`)

      // Add to processed set
      this.processedFiles.add(filename)
      await Deno.remove(tmpPath)

      console.log(`Successfully processed ${filename}.`)
    } catch (error) {
      console.error(`Error processing file ${filename}:`, error)

      // Could add retry logic here
      // Could move file to error directory
      // Could store error in KV
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.ftp.close()
  }
}
