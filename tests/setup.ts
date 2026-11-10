// jsdom's Blob/File lack arrayBuffer()/stream(); browsers have them. Use Node's standard ones.
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'

globalThis.Blob = NodeBlob as unknown as typeof Blob
globalThis.File = NodeFile as unknown as typeof File
