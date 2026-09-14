import { redirect } from 'next/navigation'

const CommunitiesPage = async () => {
  // Discussions live inside each course (docs/refactor/02-discussions.md), so
  // there is no platform-wide community list for students. Browser-relative
  // path: the proxy adds the /orgs/{slug} prefix.
  redirect('/dashboard')
}

export default CommunitiesPage
