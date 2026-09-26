import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests'

/*
 This file includes certification-related API calls
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function getCourseCertifications(
  course_uuid: string,
  org_id: number,
  next: any,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}certifications/course/${course_uuid}?org_id=${org_id}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function getUserCertificates(
  course_uuid: string,
  org_id: number,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}certifications/user/course/${course_uuid}?org_id=${org_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function getCertificateByUuid(
  user_certification_uuid: string,
  org_id: number
) {
  const result = await fetch(
    `${getAPIUrl()}certifications/certificate/${user_certification_uuid}?org_id=${org_id}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
  const res = await getResponseMetadata(result)
  return res
}

export async function getAllUserCertificates(
  org_id: number,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}certifications/user/all?org_id=${org_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
} 