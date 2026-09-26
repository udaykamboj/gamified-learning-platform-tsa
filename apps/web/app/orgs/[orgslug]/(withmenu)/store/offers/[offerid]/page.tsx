import { redirect } from 'next/navigation'

// Courses are not sold on StarLab (docs/refactor/03-change-list.md, section H).
// Browser-relative path: the proxy adds the /orgs/{slug} prefix.
export default async function OfferPage() {
  redirect('/dashboard')
}
