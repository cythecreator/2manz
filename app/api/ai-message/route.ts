import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { users } = await req.json()

    const userDescriptions = users.map((u: any) =>
      `- ${u.name}, ${u.age}, from ${u.location || 'unknown location'}. ${u.bio ? `Bio: ${u.bio}` : ''} ${u.fav_date_place ? `Loves: ${u.fav_date_place}` : ''}`
    ).join('\n')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `You're helping write a fun, casual opening message for a group chat between 4 people who just matched on a double-date app called "2 Manz". Keep it short (1-2 sentences), playful, and natural — not cringe. Here are the people:\n\n${userDescriptions}\n\nWrite ONE opening message (no quotes, no explanation, just the message itself).`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ message: text.trim() })
  } catch (error) {
    console.error('AI message error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
