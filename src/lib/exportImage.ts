import { toPng } from 'html-to-image'

/** Capture a DOM node (chart + stats) as a PNG download. */
export async function downloadElementPng(
  el: HTMLElement,
  filename = 'dfc-拉力曲线.png',
): Promise<void> {
  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--panel')
      .trim() || '#f4f6f8',
  })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
