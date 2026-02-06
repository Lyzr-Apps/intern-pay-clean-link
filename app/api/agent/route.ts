import { NextRequest, NextResponse } from 'next/server'
import parseLLMJson from '@/lib/jsonParser'

const LYZR_API_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/'
const LYZR_API_KEY = process.env.LYZR_API_KEY || ''

// Retry configuration
const MAX_RETRIES = 3
const BASE_DELAY = 1000 // 1 second
const MAX_DELAY = 10000 // 10 seconds

// Types
interface NormalizedAgentResponse {
  status: 'success' | 'error'
  result: Record<string, any>
  message?: string
  metadata?: {
    agent_name?: string
    timestamp?: string
    [key: string]: any
  }
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  const delay = BASE_DELAY * Math.pow(2, attempt)
  const jitter = Math.random() * 1000 // Add random jitter to avoid thundering herd
  return Math.min(delay + jitter, MAX_DELAY)
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function normalizeResponse(parsed: any): NormalizedAgentResponse {
  if (!parsed) {
    return {
      status: 'error',
      result: {},
      message: 'Empty response from agent',
    }
  }

  if (typeof parsed === 'string') {
    return {
      status: 'success',
      result: { text: parsed },
      message: parsed,
    }
  }

  if (typeof parsed !== 'object') {
    return {
      status: 'success',
      result: { value: parsed },
      message: String(parsed),
    }
  }

  if ('status' in parsed && 'result' in parsed) {
    return {
      status: parsed.status === 'error' ? 'error' : 'success',
      result: parsed.result || {},
      message: parsed.message,
      metadata: parsed.metadata,
    }
  }

  if ('status' in parsed) {
    const { status, message, metadata, ...rest } = parsed
    return {
      status: status === 'error' ? 'error' : 'success',
      result: Object.keys(rest).length > 0 ? rest : {},
      message,
      metadata,
    }
  }

  if ('result' in parsed) {
    return {
      status: 'success',
      result: parsed.result,
      message: parsed.message,
      metadata: parsed.metadata,
    }
  }

  if ('message' in parsed && typeof parsed.message === 'string') {
    return {
      status: 'success',
      result: { text: parsed.message },
      message: parsed.message,
    }
  }

  if ('response' in parsed) {
    return normalizeResponse(parsed.response)
  }

  return {
    status: 'success',
    result: parsed,
    message: undefined,
    metadata: undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, agent_id, user_id, session_id, assets } = body

    if (!message || !agent_id) {
      return NextResponse.json(
        {
          success: false,
          response: {
            status: 'error',
            result: {},
            message: 'message and agent_id are required',
          },
          error: 'message and agent_id are required',
        },
        { status: 400 }
      )
    }

    if (!LYZR_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          response: {
            status: 'error',
            result: {},
            message: 'LYZR_API_KEY not configured',
          },
          error: 'LYZR_API_KEY not configured on server',
        },
        { status: 500 }
      )
    }

    const finalUserId = user_id || `user-${generateUUID()}`
    const finalSessionId = session_id || `${agent_id}-${generateUUID().substring(0, 12)}`

    const payload: Record<string, any> = {
      message,
      agent_id,
      user_id: finalUserId,
      session_id: finalSessionId,
    }

    if (assets && assets.length > 0) {
      payload.assets = assets
    }

    // Retry logic with exponential backoff for 429 errors
    let lastError: any = null
    let lastResponse: Response | null = null
    let rawText = ''

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(LYZR_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': LYZR_API_KEY,
          },
          body: JSON.stringify(payload),
        })

        rawText = await response.text()
        lastResponse = response

        // Success case
        if (response.ok) {
          const parsed = parseLLMJson(rawText)

          if (parsed?.success === false && parsed?.error) {
            return NextResponse.json({
              success: false,
              response: {
                status: 'error',
                result: {},
                message: parsed.error,
              },
              error: parsed.error,
              raw_response: rawText,
            })
          }

          const normalized = normalizeResponse(parsed)

          return NextResponse.json({
            success: true,
            response: normalized,
            agent_id,
            user_id: finalUserId,
            session_id: finalSessionId,
            timestamp: new Date().toISOString(),
            raw_response: rawText,
            retry_attempt: attempt > 0 ? attempt : undefined,
          })
        }

        // Rate limit error - retry with exponential backoff
        if (response.status === 429) {
          if (attempt < MAX_RETRIES) {
            const delay = getRetryDelay(attempt)
            console.log(`Rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`)
            await sleep(delay)
            continue
          }
          // Max retries exceeded for 429
          lastError = {
            status: 429,
            message: 'Rate limit exceeded. Please try again in a few moments.',
            rawText,
          }
          break
        }

        // Other errors - don't retry
        lastError = {
          status: response.status,
          rawText,
        }
        break
      } catch (error) {
        lastError = error
        if (attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt)
          console.log(`Network error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`)
          await sleep(delay)
          continue
        }
        break
      }
    }

    // Handle final error after retries
    if (lastResponse && !lastResponse.ok) {
      let errorMsg = lastError?.message || `API returned status ${lastResponse.status}`

      if (lastResponse.status === 429) {
        errorMsg = 'Too many requests. The service is currently busy. Please wait a moment and try again.'
      } else {
        try {
          const errorData = parseLLMJson(rawText) || JSON.parse(rawText)
          errorMsg = errorData?.error || errorData?.message || errorMsg
        } catch {}
      }

      return NextResponse.json(
        {
          success: false,
          response: {
            status: 'error',
            result: {},
            message: errorMsg,
          },
          error: errorMsg,
          raw_response: rawText,
          retry_attempts: MAX_RETRIES,
        },
        { status: lastResponse.status }
      )
    }

    // Network or other error
    throw lastError || new Error('Unknown error occurred')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      {
        success: false,
        response: {
          status: 'error',
          result: {},
          message: errorMsg,
        },
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}
