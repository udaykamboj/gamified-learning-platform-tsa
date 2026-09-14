import { redirect } from 'next/navigation'

// Boards are not part of the student learning experience
// (docs/refactor/03-change-list.md, section B). The admin tool at /dash/boards
// is kept. Browser-relative path: the proxy adds the /orgs/{slug} prefix.
export default async function BoardsPage() {
  redirect('/dashboard')
}
