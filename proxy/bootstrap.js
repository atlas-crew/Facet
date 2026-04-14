import { applyEnvFile } from './envFile.js'

const envPath = './.env'

applyEnvFile(envPath, process.env, { override: true })

await import('./server.js')
