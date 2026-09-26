import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getServerSession } from '@/lib/auth/server'
import PlaygroundsClient from './playgrounds'
import { getOrgPlaygrounds } from '@services/playgrounds/playgrounds'

type PageParams = Promise<{ orgslug: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { orgslug } = await params
  const org = await getOrganizationContextInfo(orgslug, { revalidate: 120, tags: ['organizations'] })
  return {
    title: `My playgrounds — ${org?.name || 'Organization'}`,
    description: 'Your AI playgrounds and the ones shared with you',
  }
}

export default async function PlaygroundsPage({ params }: { params: PageParams }) {
  const { orgslug } = await params
  const session = await getServerSession()
  const access_token = session?.tokens?.access_token

  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })

  let initialPlaygrounds: any[] = []
  try {
    if (org?.id) {
      initialPlaygrounds = await getOrgPlaygrounds(org.id, access_token ?? undefined)
    }
  } catch (error) {
    console.error('Error fetching playgrounds:', error)
  }

  return (
    <PlaygroundsClient
      orgslug={orgslug}
      org_id={org?.id || 0}
      initialPlaygrounds={initialPlaygrounds}
    />
  )
}
