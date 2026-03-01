/// <reference types="vite/client" />

declare module '*.typ?raw' {
  const source: string
  export default source
}
