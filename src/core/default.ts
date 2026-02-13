import { tryo } from './tryo'

const defaultInstance = tryo()

export const run = defaultInstance.run
export const runOrThrow = defaultInstance.runOrThrow
export const orThrow = defaultInstance.orThrow
export const all = defaultInstance.all
export const allOrThrow = defaultInstance.allOrThrow
