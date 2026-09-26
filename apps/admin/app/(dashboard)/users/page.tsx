import { redirect } from 'next/navigation'

export default function UsersRedirect() {
  redirect('/dash/users/settings/users')
}
