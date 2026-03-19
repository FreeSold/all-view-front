import {
  FolderOpenOutlined,
  InboxOutlined,
  PictureOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Image,
  Input,
  List,
  Popover,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePhotoFolder } from '../context/PhotoFolderContext'
import { usePhotoStateContext } from '../context/PhotoStateContext'
import type { PhotoImage } from '../storage/photoTypes'

function ThumbImage({
  img,
  size = 140,
  loadThumb,
}: {
  img: PhotoImage & { displayName?: string }
  size?: number
  loadThumb: (relPath: string | undefined) => Promise<string>
}) {
  const [src, setSrc] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    loadThumb(img.thumbRelPath).then((url) => {
      if (!cancelled && url) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [img.thumbRelPath, loadThumb])
  return (
    <div style={{ width: size, height: size, overflow: 'hidden', background: '#f0f0f0' }}>
      {src ? (
        <Image
          src={src}
          alt={img.displayName ?? img.originalName}
          style={{ width: size, height: size, objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PictureOutlined style={{ fontSize: 24, color: '#999' }} />
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  const b = Number(bytes ?? 0)
  const kb = 1024
  const mb = kb * 1024
  const gb = mb * 1024
  if (b >= gb) return `${(b / gb).toFixed(2)} GB`
  if (b >= mb) return `${(b / mb).toFixed(2)} MB`
  if (b >= kb) return `${(b / kb).toFixed(2)} KB`
  return `${b} B`
}

export default function PhotoManagementPage() {
  const photoFolder = usePhotoFolder()
  const {
    fs,
    derived,
    logLines,
    pickRoot,
    setUi,
    setFilters,
    clearFilters,
    setSortRules,
    addUserTag,
    removeUserTag,
    getTagSuggestions,
    importFiles,
    isSupported,
    repo,
  } = usePhotoStateContext()

  const [importOpen, setImportOpen] = useState(false)
  const [importFilesList, setImportFilesList] = useState<File[]>([])
  const [importing, setImporting] = useState(false)
  const [hoverPreview, setHoverPreview] = useState<{
    x: number
    y: number
    thumbUrl: string
    meta: string
  } | null>(null)
  const thumbCache = useRef<Map<string, string>>(new Map())
  const lastTreeRef = useRef<string>('')

  useEffect(() => {
    const tree = derived.folderTree
    const treeStr = JSON.stringify(tree)
    if (treeStr !== lastTreeRef.current) {
      lastTreeRef.current = treeStr
      photoFolder?.setFolderTree(tree)
    }
    photoFolder?.setActiveFolderId(derived.activeFolderId)
  }, [derived.folderTree, derived.activeFolderId, photoFolder?.setFolderTree, photoFolder?.setActiveFolderId])

  useEffect(() => {
    if (photoFolder?.activeFolderId && photoFolder.activeFolderId !== derived.activeFolderId) {
      setUi({ activeFolderId: photoFolder.activeFolderId })
    }
  }, [photoFolder?.activeFolderId, derived.activeFolderId, setUi])

  const effectiveViewMode = useMemo(() => {
    const mode = derived.viewMode
    if (mode !== 'auto') return mode
    return 'grid'
  }, [derived.viewMode])

  const loadThumb = useCallback(
    async (relPath: string | undefined) => {
      if (!relPath || !fs.rootHandle) return ''
      if (thumbCache.current.has(relPath)) return thumbCache.current.get(relPath)!
      try {
        const url = await repo.readBlobUrl(relPath)
        thumbCache.current.set(relPath, url)
        return url
      } catch {
        return ''
      }
    },
    [fs.rootHandle, repo]
  )

  const handlePickFiles = useCallback(async () => {
    if (!isSupported) return
    try {
      const files = await repo.pickImageFiles()
      setImportFilesList((prev) => {
        const seen = new Set(prev.map((f: File) => `${f.name}:${f.size}:${f.lastModified}`))
        const added = files.filter(
          (f: File) => !seen.has(`${f.name}:${f.size}:${f.lastModified}`)
        )
        return [...prev, ...added]
      })
    } catch {
      message.error('选择文件失败')
    }
  }, [isSupported, repo])

  const handlePickFolder = useCallback(async () => {
    if (!isSupported) return
    try {
      const files = await repo.pickImageFolderRecursive()
      setImportFilesList((prev) => {
        const seen = new Set(prev.map((f: File) => `${f.name}:${f.size}:${f.lastModified}`))
        const added = files.filter(
          (f: File) => !seen.has(`${f.name}:${f.size}:${f.lastModified}`)
        )
        return [...prev, ...added]
      })
    } catch {
      message.error('选择文件夹失败')
    }
  }, [isSupported, repo])

  const handleStartImport = useCallback(async () => {
    if (!importFilesList.length) return
    setImporting(true)
    try {
      await importFiles(importFilesList)
      setImportFilesList([])
      setImportOpen(false)
      message.success(`已导入 ${importFilesList.length} 个文件`)
    } catch (e) {
      message.error(String(e))
    } finally {
      setImporting(false)
    }
  }, [importFilesList, importFiles])

  if (!isSupported) {
    return (
      <Alert
        type="warning"
        message="当前浏览器不支持 File System Access API"
        description="请使用 Chrome 或 Edge 浏览器打开此页面，以使用图片管理功能。"
        showIcon
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space wrap>
          <Typography.Text strong>
            {fs.rootHandle
              ? `数据目录：${fs.rootName}`
              : '未选择数据目录（需要授权）'}
          </Typography.Text>
          <Button type="primary" icon={<FolderOpenOutlined />} onClick={pickRoot}>
            选择数据目录
          </Button>
          <Button
            icon={<PlusOutlined />}
            disabled={!fs.rootHandle}
            onClick={() => {
              setImportFilesList([])
              setImportOpen(true)
            }}
          >
            导入图片
          </Button>
        </Space>
        <Space>
          <Select
            value={derived.viewMode as 'auto' | 'grid' | 'list'}
            onChange={(v) => setUi({ viewMode: v as 'auto' | 'grid' | 'list' })}
            options={[
              { value: 'auto', label: '自动' },
              { value: 'grid', label: '缩略图' },
              { value: 'list', label: '列表' },
            ]}
            style={{ width: 100 }}
          />
        </Space>
      </div>

      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        <Col xs={24} lg={16}>
          <Card
            size="small"
            title={
              <Space>
                <span>{derived.results.length} 张</span>
                {derived.hasActiveFilters && (
                  <Button size="small" onClick={clearFilters}>
                    清空筛选
                  </Button>
                )}
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ overflow: 'auto', maxHeight: 600 }}>
              {derived.results.length === 0 ? (
                <Empty description="暂无图片" />
              ) : effectiveViewMode === 'list' ? (
                <List
                  size="small"
                  dataSource={derived.results}
                  renderItem={(img: (typeof derived.results)[0]) => (
                    <List.Item
                      onMouseEnter={() => {
                        loadThumb(img.thumbRelPath).then((url) => {
                          if (url)
                            setHoverPreview({
                              x: 0,
                              y: 0,
                              thumbUrl: url,
                              meta: `${img.displayName}\n${img.libraryRelPath}`,
                            })
                        })
                      }}
                      onMouseLeave={() => setHoverPreview(null)}
                    >
                      <List.Item.Meta
                        avatar={<ThumbImage img={img} size={48} loadThumb={loadThumb} />}
                        title={img.displayName ?? img.originalName}
                        description={
                          <Space>
                            <span>{img.ext?.toUpperCase() ?? '?'}</span>
                            <span>{formatBytes(img.sizeBytes)}</span>
                            <span>
                              {img.width ?? 0}×{img.height ?? 0}
                            </span>
                            {(img.autoTags ?? []).concat(img.userTags ?? []).slice(0, 3).map((t: string) => (
                              <Tag key={t} closable onClose={() => removeUserTag(img.id, t)}>
                                {t}
                              </Tag>
                            ))}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Row gutter={[12, 12]}>
                  {derived.results.map((img: (typeof derived.results)[0]) => (
                    <Col key={img.id} xs={12} sm={8} md={6} lg={6}>
                      <Card
                        size="small"
                        hoverable
                        cover={<ThumbImage img={img} size={160} loadThumb={loadThumb} />}
                        actions={[]}
                      >
                        <Card.Meta
                          title={
                            <Typography.Text style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {img.displayName ?? img.originalName}
                            </Typography.Text>
                          }
                          description={
                            <Space orientation="vertical" size={0}>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {img.ext?.toUpperCase()} · {formatBytes(img.sizeBytes)}
                              </Typography.Text>
                              <Space wrap size={[4, 4]}>
                                {(img.autoTags ?? []).map((t: string) => (
                                  <Tag key={t}>{t}</Tag>
                                ))}
                                {(img.userTags ?? []).map((t: string) => (
                                  <Tag
                                    key={t}
                                    color="blue"
                                    closable
                                    onClose={() => removeUserTag(img.id, t)}
                                  >
                                    {t}
                                  </Tag>
                                ))}
                              </Space>
                              <TagInput
                                imageId={img.id}
                                onAdd={addUserTag}
                                onSuggest={getTagSuggestions}
                              />
                            </Space>
                          }
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" title="筛选 & 排序" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Typography.Text type="secondary">格式</Typography.Text>
                <div style={{ marginTop: 4 }}>
                  {derived.filterOptions.formats.map((o: { id: string; label: string; count: number }) => (
                    <Tag
                      key={o.id}
                      style={{ marginBottom: 4, cursor: 'pointer' }}
                      color={
                        (derived.activeFilters ?? {}).formats?.includes(o.id) ? 'blue' : 'default'
                      }
                      onClick={() => {
                          const cur = (derived.activeFilters ?? {}).formats ?? []
                        const next = cur.includes(o.id)
                          ? cur.filter((x: string) => x !== o.id)
                          : [...cur, o.id]
                        setFilters({ formats: next })
                      }}
                    >
                      {o.label} ({o.count})
                    </Tag>
                  ))}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">大小</Typography.Text>
                <div style={{ marginTop: 4 }}>
                  {derived.filterOptions.sizes.map((o: { id: string; label: string; count: number }) => (
                    <Tag
                      key={o.id}
                      style={{ marginBottom: 4, cursor: 'pointer' }}
                      color={
                        (derived.activeFilters ?? {}).sizes?.includes(o.id) ? 'blue' : 'default'
                      }
                      onClick={() => {
                          const cur = (derived.activeFilters ?? {}).sizes ?? []
                        const next = cur.includes(o.id)
                          ? cur.filter((x: string) => x !== o.id)
                          : [...cur, o.id]
                        setFilters({ sizes: next })
                      }}
                    >
                      {o.label} ({o.count})
                    </Tag>
                  ))}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">方向</Typography.Text>
                <div style={{ marginTop: 4 }}>
                  {derived.filterOptions.orient.map((o: { id: string; label: string; count: number }) => (
                    <Tag
                      key={o.id}
                      style={{ marginBottom: 4, cursor: 'pointer' }}
                      color={
                        (derived.activeFilters ?? {}).orient?.includes(o.id) ? 'blue' : 'default'
                      }
                      onClick={() => {
                          const cur = (derived.activeFilters ?? {}).orient ?? []
                        const next = cur.includes(o.id)
                          ? cur.filter((x: string) => x !== o.id)
                          : [...cur, o.id]
                        setFilters({ orient: next })
                      }}
                    >
                      {o.label} ({o.count})
                    </Tag>
                  ))}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">标签</Typography.Text>
                <div style={{ marginTop: 4 }}>
                  {derived.filterOptions.tags.slice(0, 20).map((o: { name: string; count: number }) => (
                    <Tag
                      key={o.name}
                      style={{ marginBottom: 4, cursor: 'pointer' }}
                      color={
                        (derived.activeFilters ?? {}).tags?.includes(o.name) ? 'blue' : 'default'
                      }
                      onClick={() => {
                          const cur = (derived.activeFilters ?? {}).tags ?? []
                        const next = cur.includes(o.name)
                          ? cur.filter((x: string) => x !== o.name)
                          : [...cur, o.name]
                        setFilters({ tags: next })
                      }}
                    >
                      {o.name} ({o.count})
                    </Tag>
                  ))}
                </div>
              </div>
            </Space>
          </Card>

          <Card size="small" title="排序规则">
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
              {derived.sortRules.map((r: { id: string; label: string }, i: number) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{r.label}</span>
                  <Space>
                    <Button
                      size="small"
                      disabled={i === 0}
                      onClick={() => {
                        const ids = derived.sortRules.map((x: { id: string }) => x.id)
                        ;[ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!]
                        setSortRules(ids)
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      size="small"
                      disabled={i === derived.sortRules.length - 1}
                      onClick={() => {
                        const ids = derived.sortRules.map((x: { id: string }) => x.id)
                        ;[ids[i], ids[i + 1]] = [ids[i + 1]!, ids[i]!]
                        setSortRules(ids)
                      }}
                    >
                      ↓
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        const next = derived.sortRules
                          .map((x: { id: string }) => x.id)
                          .filter((_: string, j: number) => j !== i)
                        setSortRules(next.length ? next : ['importedAtDesc'])
                      }}
                    >
                      ×
                    </Button>
                  </Space>
                </div>
              ))}
              <Select
                placeholder="添加排序规则"
                style={{ width: '100%' }}
                allowClear
                options={[
                  { id: 'importedAtDesc', label: '导入时间（新→旧）' },
                  { id: 'importedAtAsc', label: '导入时间（旧→新）' },
                  { id: 'sizeDesc', label: '文件大小（大→小）' },
                  { id: 'sizeAsc', label: '文件大小（小→大）' },
                  { id: 'nameAsc', label: '文件名（A→Z）' },
                  { id: 'nameDesc', label: '文件名（Z→A）' },
                  { id: 'extAsc', label: '格式（A→Z）' },
                ]
                  .filter(
                    (o: { id: string; label: string }) =>
                      !derived.sortRules.some((r: { id: string }) => r.id === o.id)
                  )
                  .map((o) => ({ value: o.id, label: o.label }))}
                onChange={(v) => {
                  if (v) setSortRules([...derived.sortRules.map((x) => x.id), v])
                }}
              />
            </Space>
          </Card>

          <Card size="small" title="日志" style={{ marginTop: 16 }}>
            <pre
              style={{
                maxHeight: 120,
                overflow: 'auto',
                fontSize: 11,
                margin: 0,
              }}
            >
              {logLines.length ? logLines.join('\n') : '—'}
            </pre>
          </Card>
        </Col>
      </Row>

      {/* Import Modal */}
      {importOpen && (
        <Card
          title="导入图片"
          extra={
            <Button onClick={() => setImportOpen(false)}>关闭</Button>
          }
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            width: '90%',
            maxWidth: 700,
            maxHeight: '80vh',
            overflow: 'auto',
          }}
        >
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Space>
              <Button icon={<InboxOutlined />} onClick={handlePickFiles}>
                选择图片文件
              </Button>
              <Button onClick={handlePickFolder}>选择文件夹</Button>
              <Button
                type="primary"
                loading={importing}
                disabled={!importFilesList.length}
                onClick={handleStartImport}
              >
                开始导入 ({importFilesList.length})
              </Button>
            </Space>
            <Typography.Text type="secondary">
              {importFilesList.length
                ? `已选 ${importFilesList.length} 个文件`
                : '尚未选择文件'}
            </Typography.Text>
            <div
              style={{
                maxHeight: 300,
                overflow: 'auto',
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                padding: 8,
              }}
            >
              {importFilesList.length === 0 ? (
                <Empty description="选择文件或文件夹以预览" />
              ) : (
                <List
                  size="small"
                  dataSource={importFilesList.slice(0, 100)}
                  renderItem={(f: File) => (
                    <List.Item>
                      {f.name} — {formatBytes(f.size)}
                    </List.Item>
                  )}
                />
              )}
              {importFilesList.length > 100 && (
                <Typography.Text type="secondary">
                  共 {importFilesList.length} 个，仅预览前 100 个
                </Typography.Text>
              )}
            </div>
          </Space>
        </Card>
      )}

      {hoverPreview && (
        <Popover
          open={!!hoverPreview}
          content={
            <div>
              <img
                src={hoverPreview.thumbUrl}
                alt=""
                style={{ maxWidth: 300, maxHeight: 300 }}
              />
              <pre style={{ margin: 0, fontSize: 11 }}>{hoverPreview.meta}</pre>
            </div>
          }
        >
          <div
            style={{
              position: 'fixed',
              left: hoverPreview.x,
              top: hoverPreview.y,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          />
        </Popover>
      )}
    </div>
  )
}

function TagInput({
  imageId,
  onAdd,
  onSuggest,
}: {
  imageId: string
  onAdd: (id: string, tag: string) => void
  onSuggest: (q: string) => string[]
}) {
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggest, setShowSuggest] = useState(false)

  useEffect(() => {
    const q = value.trim().replace(/^#/, '')
    if (!q) {
      setSuggestions([])
      return
    }
    setSuggestions(onSuggest(value))
  }, [value, onSuggest])

  return (
    <div style={{ marginTop: 4 }}>
      <Input
        size="small"
        placeholder="# 输入标签，回车添加"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const tag = value.trim()
            if (tag) {
              onAdd(imageId, tag)
              setValue('')
            }
          }
        }}
        onFocus={() => setShowSuggest(true)}
        onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
      />
      {showSuggest && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 10,
            maxHeight: 150,
            overflow: 'auto',
          }}
        >
          {suggestions.map((s) => (
            <div
              key={s}
              style={{ padding: '4px 8px', cursor: 'pointer' }}
              onMouseDown={() => {
                onAdd(imageId, s)
                setValue('')
                setShowSuggest(false)
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
