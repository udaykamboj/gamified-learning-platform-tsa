import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServerSession } from '@/lib/auth/server'
import { getPlayground } from '@services/playgrounds/playgrounds'
import PlaygroundViewClient from './view'

type PageParams = Promise<{ orgslug: string; playgrounduuid: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { playgrounduuid } = await params
  try {
    const pg = await getPlayground(playgrounduuid)
    return {
      title: pg.name,
      description: pg.description || `Interactive playground: ${pg.name}`,
    }
  } catch {
    return { title: 'Playground' }
  }
}

export default async function PlaygroundViewPage({ params }: { params: PageParams }) {
  const { orgslug, playgrounduuid } = await params
  const session = await getServerSession()
  const access_token = session?.tokens?.access_token

  let playground
  try {
    playground = await getPlayground(playgrounduuid, access_token ?? undefined)
  } catch {
    notFound()
  }

  // The API decides who can open it (owner, people it's shared with, or
  // anyone with the link); only the owner and shared editors can edit.
  return (
    <PlaygroundViewClient
      playground={playground}
      orgslug={orgslug}
      canEdit={playground.my_role === 'owner' || playground.my_role === 'editor'}
    />
  )
}
