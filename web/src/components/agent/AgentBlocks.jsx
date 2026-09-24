/* ============================================================
   Blocks → React.

   The server-side twin of this is `report_pdf._block_html`. Both read
   the schema in `agent_blocks.py`, and neither parses the other's
   output — that is the whole reason an answer carries structure
   beside its prose instead of markdown that each end has to guess at.

   Seven types and a deliberate fall-through: an unknown block renders
   nothing rather than throwing. A model that invents an eighth type
   should cost a chart, not the message it is inside.
   ============================================================ */
import AgentChart from './AgentChart.jsx'

/* `**bold**` inline, on text that React has already escaped for us. */
function Inline({ text = '' }) {
  return (
    <>
      {String(text)
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, index) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={index}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={index}>{part}</span>
          ),
        )}
    </>
  )
}

/* Plain prose: paragraphs and bullet lists, the way the model writes them. */
export function Prose({ text = '' }) {
  const blocks = []
  let list = null

  const flush = () => {
    if (list) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {list.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ul>,
      )
      list = null
    }
  }

  for (const raw of String(text).split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    if (/^[-*•]\s+/.test(line)) {
      list = list || []
      list.push(line.replace(/^[-*•]\s+/, ''))
    } else {
      flush()
      blocks.push(
        <p key={`p-${blocks.length}`}>
          <Inline text={line} />
        </p>,
      )
    }
  }
  flush()
  return <>{blocks}</>
}

function Kpis({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="agent-kpis">
      {items.map((item, index) => (
        <div className="agent-kpi" key={index}>
          <span className="agent-kpi__label">{item.label}</span>
          <span className="agent-kpi__value tnum">{item.value}</span>
          {item.delta ? (
            <span className={`agent-kpi__delta is-${item.tone || 'neutral'}`}>{item.delta}</span>
          ) : null}
          {item.hint ? <span className="agent-kpi__hint">{item.hint}</span> : null}
        </div>
      ))}
    </div>
  )
}

function Table({ title, columns = [], rows = [], align = [], total }) {
  if (!columns.length) return null
  const at = (index) => (align[index] === 'right' ? 'right' : 'left')
  return (
    <div className="agent-table-wrap">
      {title ? <div className="agent-block__title">{title}</div> : null}
      {/* Its own scroller. A wide table inside a message must scroll itself;
          the thread never scrolls sideways (N15). */}
      <div className="tbl-scroll">
        <table className="agent-table">
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index} className={at(index)}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={`${at(ci)}${at(ci) === 'right' ? ' tnum' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {total ? (
            <tfoot>
              <tr>
                {total.map((cell, index) => (
                  <td key={index} className={`${at(index)}${at(index) === 'right' ? ' tnum' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}

function Callout({ tone = 'neutral', title, text }) {
  return (
    <div className={`agent-callout is-${tone}`}>
      {title ? <strong>{title}</strong> : null}
      <Inline text={text} />
    </div>
  )
}

export function AgentBlock({ block }) {
  switch (block?.type) {
    case 'heading':
      return block.level === 3 ? (
        <h4 className="agent-h3">{block.text}</h4>
      ) : (
        <h3 className="agent-h2">{block.text}</h3>
      )
    case 'text':
      return <Prose text={block.text} />
    case 'kpi':
      return <Kpis items={block.items} />
    case 'chart':
      return <AgentChart block={block} />
    case 'table':
      return <Table {...block} />
    case 'callout':
      return <Callout {...block} />
    case 'list':
      return block.ordered ? (
        <ol className="agent-list">
          {(block.items || []).map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="agent-list">
          {(block.items || []).map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      )
    default:
      return null
  }
}

export default function AgentBlocks({ blocks = [] }) {
  if (!blocks.length) return null
  return (
    <div className="agent-blocks">
      {blocks.map((block, index) => (
        <AgentBlock key={index} block={block} />
      ))}
    </div>
  )
}
