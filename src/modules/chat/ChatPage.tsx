import { useMemo, useRef, useState, useEffect } from 'react'
import { Avatar, Button, Input, Select, makeStyles, Text, tokens, Badge } from '@fluentui/react-components'
import { SendRegular, ChatRegular, ArrowLeftRegular } from '@fluentui/react-icons'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { ROLE_LABELS } from '../../types/roles'
import type { Role } from '../../types/roles'
import type { ChatMessage, StudentGuardian, User } from '../../types'
import { formatDate, genId, initials, relativeDay } from '../../utils/helpers'

const useStyles = makeStyles({
  root: { display: 'flex', height: 'calc(100vh - 140px)', gap: 0, background: 'var(--superficie)', borderRadius: '14px', border: '1px solid var(--borde)', overflow: 'hidden', '@media (max-width: 700px)': { flexDirection: 'column', height: 'auto', minHeight: '70vh' } },
  sidebar: { width: '320px', borderRight: '1px solid var(--borde)', display: 'flex', flexDirection: 'column', flexShrink: 0, '@media (max-width: 700px)': { width: '100%', display: 'none' } },
  sidebarShow: { '@media (max-width: 700px)': { display: 'flex' } },
  childBar: { padding: '10px 14px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', gap: '8px' },
  sidebarHdr: { padding: '12px 14px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', gap: '8px' },
  contactList: { flex: 1, overflowY: 'auto' },
  contact: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #eef1f5', ':hover': { background: tokens.colorNeutralBackground2 } },
  contactActive: { background: `${tokens.colorBrandBackground2} !important` },
  contactName: { fontWeight: 600, fontSize: '14px' },
  contactPreview: { fontSize: '12px', color: 'var(--texto-suave)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' },
  chatPanel: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, '@media (max-width: 700px)': { display: 'none' } },
  chatShow: { '@media (max-width: 700px)': { display: 'flex' } },
  chatHdr: { padding: '12px 16px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', gap: '10px' },
  chatHdrInfo: { display: 'flex', flexDirection: 'column' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  bubble: { maxWidth: '72%', padding: '10px 14px', borderRadius: '14px', lineHeight: 1.45, fontSize: '13.5px', wordBreak: 'break-word' },
  bubbleMine: { alignSelf: 'flex-end', background: '#0095C8', color: '#fff', borderBottomRightRadius: '4px' },
  bubbleOther: { alignSelf: 'flex-start', background: '#f0f2f5', color: 'var(--texto)', borderBottomLeftRadius: '4px' },
  msgTime: { fontSize: '10px', marginTop: '3px', opacity: 0.7 },
  inputBar: { padding: '10px 14px', borderTop: '1px solid var(--borde)', display: 'flex', gap: '8px', alignItems: 'center' },
  emptyChat: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: 'var(--texto-suave)' },
  mobileBack: { '@media (min-width: 701px)': { display: 'none' } },
  unreadDot: { width: '8px', height: '8px', borderRadius: '50%', background: tokens.colorPaletteRedForeground1, flexShrink: 0 },
})

interface ContactSummary {
  id: string
  displayName: string
  email: string
  role: Role
  lastMessage?: string
  lastTime?: string
  unread: number
}

const ROLE_COLORS: Record<Role, string> = { docente: '#0095C8', estudiante: '#C8102E', padre: '#15803D', admin: '#6B21A8' }

function getContactId(a: string, b: string) { return a < b ? `${a}-${b}` : `${b}-${a}` }

export function ChatPage() {
  const styles = useStyles()
  const { user, role, users, teachers, students } = useApp()
  const guardiansCol = useCollection<StudentGuardian>(dataService.getGuardians)
  const msgCol = useCollection<ChatMessage>(dataService.getMessages, dataService.saveMessage)

  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [parentChildId, setParentChildId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgCol.items, selected])

  // Hijos del padre (por guardians)
  const parentChildren = useMemo(() => {
    if (role !== 'padre' || !user) return []
    return guardiansCol.items
      .filter((g) => g.email?.toLowerCase() === user.email?.toLowerCase())
      .map((g) => ({ studentId: g.studentId, studentName: students.find((s) => s.id === g.studentId)?.fullName ?? g.studentId }))
      .filter((c, i, a) => a.findIndex((x) => x.studentId === c.studentId) === i)
  }, [role, user, guardiansCol.items, students])

  const contacts: ContactSummary[] = useMemo(() => {
    if (!user) return []
    const contactsMap = new Map<string, User>()

    const addByIds = (ids: string[]) => ids.forEach((id) => { const u = users.find((x) => x.id === id); if (u && u.id !== user.id) contactsMap.set(u.id, u) })

    if (role === 'admin') {
      for (const u of users) if (u.id !== user.id) contactsMap.set(u.id, u)
    } else if (role === 'docente') {
      addByIds(users.filter((u) => u.roles.includes('admin')).map((u) => u.id))
      if (user.teacherId) {
        const teacher = teachers.find((t) => t.id === user.teacherId)
        if (teacher) {
          for (const s of students.filter((st) => teacher.grades.includes(st.gradeId))) {
            const su = users.find((u) => u.studentId === s.id)
            if (su) contactsMap.set(su.id, su)
          }
        }
      }
      for (const u of users) if (u.roles.includes('padre')) contactsMap.set(u.id, u)
    } else if (role === 'estudiante') {
      addByIds(users.filter((u) => u.roles.includes('admin')).map((u) => u.id))
      if (user.studentId) {
        const student = students.find((s) => s.id === user.studentId)
        if (student) {
          for (const t of teachers.filter((t2) => t2.grades.includes(student.gradeId))) {
            const tu = users.find((u) => u.teacherId === t.id)
            if (tu) contactsMap.set(tu.id, tu)
          }
        }
      }
    } else if (role === 'padre') {
      addByIds(users.filter((u) => u.roles.includes('admin')).map((u) => u.id))
      if (parentChildId) {
        const child = students.find((s) => s.id === parentChildId)
        if (child) {
          for (const t of teachers.filter((t2) => t2.grades.includes(child.gradeId))) {
            const tu = users.find((u) => u.teacherId === t.id)
            if (tu) contactsMap.set(tu.id, tu)
          }
        }
      } else {
        for (const u of users) if (u.roles.includes('docente')) contactsMap.set(u.id, u)
      }
    }

    return [...contactsMap.values()].map((u) => {
      const pair = getContactId(user!.id, u.id)
      const msgs = msgCol.items.filter((m) => getContactId(m.senderId, m.receiverId) === pair)
      const unread = msgs.filter((m) => m.receiverId === user!.id && !m.read).length
      const last = msgs[msgs.length - 1]
      return { id: u.id, displayName: u.displayName, email: u.email, role: (u.roles[0] as Role) || 'docente', lastMessage: last?.content, lastTime: last?.timestamp, unread }
    }).sort((a, b) => (b.lastTime || '').localeCompare(a.lastTime || ''))
  }, [users, role, user, teachers, students, parentChildId, msgCol.items])

  const activeMsgs = useMemo(() => {
    if (!selected || !user) return []
    const pair = getContactId(user.id, selected)
    return msgCol.items.filter((m) => getContactId(m.senderId, m.receiverId) === pair).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }, [msgCol.items, selected, user])

  const selectedContact = contacts.find((c) => c.id === selected)

  const send = async () => {
    if (!draft.trim() || !selected || !user) return
    const contact = contacts.find((c) => c.id === selected)
    await msgCol.save({
      id: genId('msg'), senderId: user.id, senderName: user.displayName, senderRole: role ?? 'docente',
      receiverId: selected, receiverName: contact?.displayName ?? selected,
      content: draft.trim(), timestamp: new Date().toISOString(), read: false,
    })
    setDraft('')
  }

  const openContact = (userId: string) => {
    setSelected(userId)
    for (const m of msgCol.items) {
      if (m.receiverId === user!.id && m.senderId === userId && !m.read) {
        void msgCol.save({ ...m, read: true })
      }
    }
  }

  const sidebar = (
    <div className={`${styles.sidebar} ${!selected ? styles.sidebarShow : ''}`}>
      <div className={styles.sidebarHdr}><ChatRegular style={{ fontSize: 18 }} /><Text weight="semibold" size={400}>Mensajes</Text></div>
      {role === 'padre' && parentChildren.length > 0 && (
        <div className={styles.childBar}>
          <Badge appearance="tint" size="small" style={{ background: ROLE_COLORS.padre, color: '#fff' }}>Hijo</Badge>
          <Select size="small" value={parentChildId} onChange={(_, d) => { setParentChildId(d.value); setSelected(null) }} style={{ flex: 1 }}>
            <option value="">Todos los docentes</option>
            {parentChildren.map((c) => <option key={c.studentId} value={c.studentId}>{c.studentName}</option>)}
          </Select>
        </div>
      )}
      <div className={styles.contactList}>
        {contacts.map((c) => (
          <div key={c.id} className={`${styles.contact} ${selected === c.id ? styles.contactActive : ''}`} onClick={() => openContact(c.id)}>
            <Avatar name={c.displayName} initials={initials(c.displayName)} color="colorful" size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={styles.contactName}>{c.displayName}</span>
                <Badge appearance="tint" size="extra-small" style={{ background: ROLE_COLORS[c.role], color: '#fff', fontSize: '9px' }}>{ROLE_LABELS[c.role]}</Badge>
              </div>
              {c.lastMessage && <div className={styles.contactPreview}>{c.lastMessage}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {c.unread > 0 && <span className={styles.unreadDot} />}
              {c.lastTime && <Text size={200} style={{ color: 'var(--texto-suave)', fontSize: '10px' }}>{relativeDay(c.lastTime)}</Text>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.root}>
      {sidebar}
      <div className={`${styles.chatPanel} ${selected ? styles.chatShow : ''}`}>
        {selectedContact ? (
          <>
            <div className={styles.chatHdr}>
              <Button appearance="subtle" size="small" icon={<ArrowLeftRegular />} className={styles.mobileBack} onClick={() => setSelected(null)} />
              <Avatar name={selectedContact.displayName} initials={initials(selectedContact.displayName)} color="colorful" size={32} />
              <div className={styles.chatHdrInfo}>
                <Text weight="semibold" block>{selectedContact.displayName}</Text>
                <Badge appearance="tint" size="extra-small" style={{ background: ROLE_COLORS[selectedContact.role], color: '#fff', fontSize: '10px' }}>{ROLE_LABELS[selectedContact.role]}</Badge>
              </div>
            </div>
            <div className={styles.messages}>
              {activeMsgs.map((m) => {
                const isMine = m.senderId === (user?.id ?? '')
                return (
                  <div key={m.id} className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
                    {m.content}
                    <div className={styles.msgTime}>
                      {formatDate(m.timestamp)} {new Date(m.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div className={styles.inputBar}>
              <Input placeholder="Escriba un mensaje…" value={draft} onChange={(_, d) => setDraft(d.value)} style={{ flex: 1 }} onKeyUp={(e) => { if (e.key === 'Enter') void send() }} />
              <Button appearance="primary" icon={<SendRegular />} onClick={() => void send()} disabled={!draft.trim()}>Enviar</Button>
            </div>
          </>
        ) : (
          <div className={styles.emptyChat}>
            <ChatRegular style={{ fontSize: '40px', opacity: 0.3 }} />
            <Text size={400} weight="semibold">Seleccione una conversación</Text>
            <Text size={300} style={{ color: 'var(--texto-suave)' }}>Elija un contacto de la lista para ver el historial de mensajes.</Text>
          </div>
        )}
      </div>
    </div>
  )
}
