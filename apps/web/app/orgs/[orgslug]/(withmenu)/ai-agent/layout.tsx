import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Astra AI companion',
  description: 'Ask Astra about AI concepts, prompts and honest use of AI.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
