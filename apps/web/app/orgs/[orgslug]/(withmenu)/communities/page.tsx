import { redirect } from 'next/navigation'

const CommunitiesPage = async () => {
  // Q&A lives under each course and lesson (docs/refactor/03-change-list.md,
  // section A), so there is no platform-wide community list. Browser-relative
  // path: the proxy adds the /orgs/{slug} prefix.
  redirect('/dashboard')
}

export default CommunitiesPage
