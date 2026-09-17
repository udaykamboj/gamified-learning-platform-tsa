import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Learning journey',
  description: 'The ordered milestones of the curriculum.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
