import { createWatcher } from '@/watcher.ts'

async function init() {
  const kv = await Deno.openKv()

  const { start } = createWatcher()
  await start(kv)
}

init()
