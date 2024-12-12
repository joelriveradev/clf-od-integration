import { WatcherService } from './watcher.ts'
import { FTPConfig } from './types.ts'

async function run() {
  const config: FTPConfig = {
    host: '127.0.0.1',
    port: 2121,
    username: 'testuser',
    password: 'password123',
    directory: '850',
  }

  const kv = await Deno.openKv()
  const watcher = new WatcherService(config, kv)

  try {
    await watcher.connect()
    await watcher.start()
  } catch (error) {
    console.error('Error:', error)
    await watcher.stop()
  }
}

run()
