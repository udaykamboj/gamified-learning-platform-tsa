'use client'
import { getCourseRights } from '@services/courses/courses'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useLHSession } from '@components/Contexts/LHSessionContext'

export interface CourseRights {
  course_uuid: string
  user_id: number
  is_anonymous: boolean
  permissions: {
    read: boolean
    create: boolean
    update: boolean
    delete: boolean
    create_content: boolean
    update_content: boolean
    delete_content: boolean
    manage_contributors: boolean
    manage_access: boolean
    grade_assignments: boolean
    mark_activities_done: boolean
    create_certifications: boolean
  }
  ownership: {
    is_owner: boolean
    is_creator: boolean
    is_maintainer: boolean
    is_contributor: boolean
    authorship_status: string
  }
  roles: {
    is_admin: boolean
    is_maintainer_role: boolean
    is_instructor: boolean
    is_user: boolean
  }
}

export function useCourseRights(courseuuid: string) {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  const { data: rights, error, isLoading } = useQuery<CourseRights>({
    queryKey: queryKeys.courses.rights(courseuuid),
    queryFn: () => getCourseRights(courseuuid, access_token),
    enabled: !!courseuuid && !!access_token,
    staleTime: 60_000,
  })

  return {
    rights,
    error,
    isLoading,
    hasPermission: (permission: keyof CourseRights['permissions']) => {
      if (session?.data?.user?.is_admin_user || session?.data?.user?.is_superadmin) return true
      return rights?.permissions?.[permission] ?? true
    },
    hasRole: (role: keyof CourseRights['roles']) => {
      if (role === 'is_admin' && (session?.data?.user?.is_admin_user || session?.data?.user?.is_superadmin)) return true
      return rights?.roles?.[role] ?? false
    },
    isOwner: true,
    isCreator: true,
    isMaintainer: true,
    isContributor: true
  }
} 