export const toLowerCaseKeys = <T>(obj: T): T => {
  if (Array.isArray(obj)) {
    return obj.map(toLowerCaseKeys) as unknown as T
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const lowerKey = key.toLowerCase()
      acc[lowerKey] = toLowerCaseKeys((obj as any)[key])
      return acc
    }, {} as { [key: string]: any }) as T
  }
  return obj
}
