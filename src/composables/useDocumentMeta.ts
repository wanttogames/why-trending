import { onBeforeUnmount, watchEffect, type MaybeRefOrGetter, toValue } from 'vue'

export const useDocumentMeta = (title: MaybeRefOrGetter<string>, description: MaybeRefOrGetter<string>): void => {
  const originalTitle = document.title
  const setMeta = (property: string, content: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"], meta[name="${property}"]`)
    if (!element) {
      element = document.createElement('meta')
      element.setAttribute(property.startsWith('og:') ? 'property' : 'name', property)
      document.head.appendChild(element)
    }
    element.content = content
  }
  const stop = watchEffect(() => {
    document.title = toValue(title)
    setMeta('description', toValue(description))
    setMeta('og:title', toValue(title))
    setMeta('og:description', toValue(description))
    setMeta('og:url', window.location.href)
  })
  onBeforeUnmount(() => { stop(); document.title = originalTitle })
}
