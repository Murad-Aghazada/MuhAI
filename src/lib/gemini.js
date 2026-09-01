/* ============================================================
   Gemini client with RAG.
   Flow: fetch KB (Firebase RTDB) -> retrieve top docs ->
   ground a Gemini 2.5 Flash prompt -> return answer + sources.
   ============================================================ */
import { fetchKnowledgeBase, seedKnowledgeBase } from './firebase.js'
import { KNOWLEDGE_DOCS, retrieve } from './ragKnowledge.js'

// NOTE: For a production app this key belongs on a server. Exposed here
// per the demo brief so the in-browser assistant works out of the box.
const GEMINI_API_KEY = 'REDACTED_ROTATED_KEY'
const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

let kbCache = null

/** Load the knowledge base from Firebase, seeding it the first time. */
async function getKnowledge() {
  if (kbCache) return kbCache
  // Try to seed (no-op if already present or rules are read-only)
  seedKnowledgeBase(KNOWLEDGE_DOCS).catch(() => {})
  const remote = await fetchKnowledgeBase()
  kbCache = remote && Object.keys(remote).length ? remote : KNOWLEDGE_DOCS
  return kbCache
}

function buildSystemPrompt(lang, contextDocs, business) {
  const langName = lang === 'en' ? 'English' : 'Turkish'
  const docBlock = contextDocs
    .map((d, i) => `[${i + 1}] ${d.title}\n${d.content}`)
    .join('\n\n')

  const bizBlock = business
    ? `\nİŞLETME VERİSİ (bu ay):\n- Gelir: ${business.revenue}\n- Gider: ${business.expense}\n- Net kâr: ${business.profit}\n- Tahakkuk eden vergi: ${business.tax}\n- Bekleyen fatura sayısı: ${business.pendingInvoices}`
    : ''

  return `Sen Muhai'sin — Türk KOBİ'leri için yapay zeka destekli muhasebe ve finans asistanısın.
Görevin, kullanıcının finans, muhasebe, vergi, SGK ve bordro sorularını net, doğru ve pratik biçimde yanıtlamak.

KURALLAR:
- Yanıtını ${langName} dilinde ver.
- Aşağıdaki BİLGİ TABANI'nı temel al. Bilgi oradaysa ona dayan, uydurma.
- Kısa ve uygulanabilir ol; gerekiyorsa madde işaretleri kullan.
- Sayısal oranları verirken bilgi tabanındaki değerleri kullan.
- Resmi/yasal işlemler için "mali müşavirinize danışın" notunu uygun yerde ekle.
- Markdown başlık (#) kullanma; sade metin ve "-" madde işaretleri yeterli.

BİLGİ TABANI:
${docBlock || '(ilgili belge bulunamadı — genel muhasebe bilgini kullan)'}
${bizBlock}`
}

/**
 * Ask the assistant.
 * @param {string} message - user question
 * @param {Array<{role,text}>} history - prior turns
 * @param {string} lang - 'tr' | 'en'
 * @param {object|null} business - optional business summary for grounding
 * @returns {Promise<{text:string, sources:Array<{id,title}>}>}
 */
export async function askAssistant(message, history = [], lang = 'tr', business = null) {
  const kb = await getKnowledge()
  const docs = retrieve(message, kb, 3)
  const system = buildSystemPrompt(lang, docs, business)

  const contents = [
    ...history.slice(-6).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      topP: 0.95,
    },
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ''

  return {
    text: text.trim(),
    sources: docs.map((d) => ({ id: d.id, title: d.title })),
  }
}
