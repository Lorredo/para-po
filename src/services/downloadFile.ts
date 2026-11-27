/**
 * Saves data as a file on the user's device (Downloads on Android, Files on
 * iPhone). Nothing is uploaded anywhere.
 */
export function downloadJson(
  filename: string,
  data: unknown,
  doc: Document = document,
): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = doc.createElement('a')
  link.href = url
  link.download = filename
  doc.body.append(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before freeing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
