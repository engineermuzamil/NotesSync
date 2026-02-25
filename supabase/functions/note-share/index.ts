import { createClient } from '@supabase/supabase-js'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
  serve: (handler: (request: Request) => Response | Promise<Response>) => void
}

type NoteType = 'text' | 'checklist' | 'bullets'

interface SharePreviewResponse {
  shareId: string
  token: string
  note: {
    id: string
    type: NoteType
    title: string
    body: string | null
    colorLabel: string | null
    createdAt: string
    updatedAt: string
  }
  analytics: {
    accessCount: number
    copyCount: number
    lastAccessedAt: string | null
    lastCopiedAt: string | null
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const admin = createClient(supabaseUrl, serviceRoleKey)

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  })
}

async function getPublicShare(token: string): Promise<{
  id: string
  note_id: string
  token: string
  access_count: number
  copy_count: number
  last_accessed_at: string | null
  last_copied_at: string | null
} | null> {
  const { data, error } = await admin
    .from('note_shares')
    .select(
      'id, note_id, token, access_count, copy_count, last_accessed_at, last_copied_at'
    )
    .eq('token', token)
    .eq('visibility', 'public')
    .eq('is_revoked', false)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

async function getNoteForShare(noteId: string): Promise<{
  id: string
  type: NoteType
  title: string
  body: string | null
  color_label: string | null
  created_at: string
  updated_at: string
} | null> {
  const { data, error } = await admin
    .from('notes')
    .select('id, type, title, body, color_label, created_at, updated_at')
    .eq('id', noteId)
    .eq('is_deleted', false)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

async function handlePreview(token: string): Promise<Response> {
  const share = await getPublicShare(token)
  if (!share) {
    return jsonResponse(404, { error: 'Shared note not found' })
  }

  const note = await getNoteForShare(share.note_id)
  if (!note) {
    return jsonResponse(404, { error: 'Note not found' })
  }

  const now = new Date().toISOString()
  const { error: accessError } = await admin
    .from('note_shares')
    .update({
      access_count: share.access_count + 1,
      last_accessed_at: now,
      updated_at: now,
    })
    .eq('id', share.id)

  if (accessError) {
    return jsonResponse(500, { error: accessError.message })
  }

  const payload: SharePreviewResponse = {
    shareId: share.id,
    token: share.token,
    note: {
      id: note.id,
      type: note.type,
      title: note.title,
      body: note.body,
      colorLabel: note.color_label,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    },
    analytics: {
      accessCount: share.access_count + 1,
      copyCount: share.copy_count,
      lastAccessedAt: now,
      lastCopiedAt: share.last_copied_at,
    },
  }

  return jsonResponse(200, payload)
}

async function resolveUserIdFromAuthHeader(
  authHeader: string | null
): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const jwt = authHeader.replace('Bearer ', '').trim()
  if (!jwt) {
    return null
  }

  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) {
    return null
  }

  return data.user.id
}

async function handleCopy(
  token: string,
  authHeader: string | null
): Promise<Response> {
  const authenticatedUserId = await resolveUserIdFromAuthHeader(authHeader)
  if (!authenticatedUserId) {
    return jsonResponse(401, { error: 'Unauthorized' })
  }

  const share = await getPublicShare(token)
  if (!share) {
    return jsonResponse(404, { error: 'Shared note not found' })
  }

  const now = new Date().toISOString()

  const { error: copyError } = await admin
    .from('note_shares')
    .update({
      copy_count: share.copy_count + 1,
      last_copied_at: now,
      updated_at: now,
    })
    .eq('id', share.id)

  if (copyError) {
    return jsonResponse(500, { error: copyError.message })
  }

  return jsonResponse(200, {
    copiedAt: now,
    analytics: {
      accessCount: share.access_count,
      copyCount: share.copy_count + 1,
      lastAccessedAt: share.last_accessed_at,
      lastCopiedAt: now,
    },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token')?.trim() ?? ''

  if (!token) {
    return jsonResponse(400, { error: 'Missing token' })
  }

  if (request.method === 'GET') {
    return handlePreview(token)
  }

  if (request.method === 'POST') {
    return handleCopy(token, request.headers.get('authorization'))
  }

  return jsonResponse(405, { error: 'Method not allowed' })
})
