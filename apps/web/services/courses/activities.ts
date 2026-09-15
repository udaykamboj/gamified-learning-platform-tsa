import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  getResponseMetadata,
} from '@services/utils/ts/requests'

/**
 * Upload a hosted-video activity with real upload progress (XHR — fetch can't
 * report upload progress). Resolves with the created activity JSON. Used by the
 * background-upload flow so the modal can close immediately.
 */
export function createVideoActivityWithProgress(
  file: File,
  data: any,
  chapter_id: any,
  access_token: string,
  onProgress: (_percent: number) => void
): Promise<any> {
  const formData = new FormData()
  formData.append('chapter_id', chapter_id)
  formData.append('name', data.name)
  formData.append('video_file', file)
  if (data.details) {
    formData.append(
      'details',
      JSON.stringify({
        startTime: data.details.startTime || 0,
        endTime: data.details.endTime || null,
        autoplay: data.details.autoplay || false,
        muted: data.details.muted || false,
      })
    )
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${getAPIUrl()}activities/video`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Authorization', `Bearer ${access_token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({})
        }
      } else if (xhr.status === 413) {
        reject(new Error('The file is too large to upload.'))
      } else {
        let detail: string | undefined
        try {
          detail = JSON.parse(xhr.responseText)?.detail
        } catch {
          /* non-JSON error body */
        }
        reject(new Error(detail || `Upload failed (HTTP ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))
    xhr.send(formData)
  })
}

export async function getActivity(
  activity_uuid: any,
  next: any,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}activities/${activity_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token)
  )
  const res = await result.json()
  return res
}

export async function getActivityWithAuthHeader(
  activity_uuid: any,
  next: any,
  access_token: string | null | undefined
) {
  const result = await fetch(
    `${getAPIUrl()}activities/activity_${activity_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token || undefined)
  )
  const res = await result.json()
  return res
}

export async function updateActivity(
  data: any,
  activity_uuid: string,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}activities/${activity_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  const res = await getResponseMetadata(result)
  return res
}

export interface CaptionsConfigPayload {
  enabled: boolean
  source_language: string
  languages: { code: string; label?: string }[]
}

export async function getUrlPreview(url: string) {
  const result = await fetch(
    `${getAPIUrl()}utils/link-preview?url=${encodeURIComponent(url)}`,
    RequestBodyWithAuthHeader('GET', null, null, undefined)
  )
  const res = await result.json()
  return res
}

