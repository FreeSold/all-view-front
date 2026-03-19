import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Col, Row, Segmented, Select, Space, Tooltip, Typography } from 'antd'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { theme } from 'antd'
import { useAuth } from '../auth/AuthContext'
import { getAppData } from '../storage/appStore'
import type { Comic, Video } from '../storage/types'

type Period = 'all' | 'week' | 'month' | 'year'
type TrendPeriod = 'day' | 'week' | 'month' | 'year'
type WorkKind = 'video' | 'comic'
type Work = Pick<Video, 'id' | 'name' | 'playCount' | 'playHistory'> | Pick<Comic, 'id' | 'name' | 'playCount' | 'playHistory'>

const MS_DAY = 24 * 60 * 60 * 1000

function getPlayCountByPeriod(v: Work, period: Period): number {
  if (period === 'all') return v.playCount ?? 0
  const history = v.playHistory ?? []
  if (history.length === 0) return 0
  const now = Date.now()
  const cutoff =
    period === 'week'
      ? now - 7 * MS_DAY
      : period === 'month'
        ? now - 30 * MS_DAY
        : now - 365 * MS_DAY
  return history.filter((t) => t >= cutoff).length
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeekMonday(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  // JS: 0=Sun..6=Sat, we want Monday as week start
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.getTime()
}

function startOfMonth(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d.getTime()
}

function startOfYear(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setMonth(0, 1)
  return d.getTime()
}

function addDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

function addWeeks(ts: number, weeks: number): number {
  return addDays(ts, weeks * 7)
}

function addMonths(ts: number, months: number): number {
  const d = new Date(ts)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

function addYears(ts: number, years: number): number {
  const d = new Date(ts)
  d.setFullYear(d.getFullYear() + years)
  return d.getTime()
}

function fmt2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatLabel(start: number, period: TrendPeriod): string {
  const d = new Date(start)
  if (period === 'day') return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`
  if (period === 'month') return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}`
  if (period === 'year') return `${d.getFullYear()}`
  // week: show range MM-DD~MM-DD (Mon..Sun)
  const end = addDays(start, 6)
  const e = new Date(end)
  return `${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}~${fmt2(e.getMonth() + 1)}-${fmt2(e.getDate())}`
}

function LineTrend({
  points,
  stroke,
  grid,
}: {
  points: number[]
  stroke: string
  grid: string
}) {
  const width = 520
  const height = 180
  const padL = 20
  const padR = 16
  const padT = 14
  const padB = 22

  const max = Math.max(0, ...points)
  if (max <= 0) return null

  const w = width - padL - padR
  const h = height - padT - padB
  const n = points.length
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * w)
  const y = (v: number) => padT + (1 - v / max) * h

  const d = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {/* grid */}
      {[0.25, 0.5, 0.75].map((t) => {
        const yy = padT + t * h
        return <line key={t} x1={padL} x2={width - padR} y1={yy} y2={yy} stroke={grid} strokeWidth="1" />
      })}

      <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" />
      {points.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={stroke} />
      ))}
    </svg>
  )
}

export function DashboardPage() {
  const { token } = theme.useToken()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('week')
  const [expanded, setExpanded] = useState(false)
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('week')
  const [topKind, setTopKind] = useState<WorkKind>('video')
  const [trendKind, setTrendKind] = useState<WorkKind>('video')

  // Keep cards visually consistent whether data exists or not.
  // Chosen to match Top30 "has data" layout height.
  const CARD_BODY_MIN_HEIGHT = 340

  const top30ByPlayCount = useMemo(() => {
    const list = topKind === 'video' ? getAppData().videos : getAppData().comics
    const withCount = list
      .map((v) => ({ video: v, count: getPlayCountByPeriod(v, period) }))
      .filter((x) => x.count > 0)
    const sorted = withCount.sort((a, b) => b.count - a.count)
    return sorted.slice(0, 30)
  }, [period, topKind])

  const maxPlayCount = useMemo(
    () => Math.max(1, ...top30ByPlayCount.map((x) => x.count)),
    [top30ByPlayCount],
  )

  const displayList = expanded ? top30ByPlayCount : top30ByPlayCount.slice(0, 10)

  const trend = useMemo(() => {
    const list = trendKind === 'video' ? getAppData().videos : getAppData().comics
    const allHistory = list.flatMap((v) => (v.playHistory ?? []).filter((t) => typeof t === 'number' && Number.isFinite(t)))
      .sort((a, b) => a - b)

    const now = Date.now()
    const currentStart =
      trendPeriod === 'day'
        ? startOfDay(now)
        : trendPeriod === 'week'
          ? startOfWeekMonday(now)
          : trendPeriod === 'month'
            ? startOfMonth(now)
            : startOfYear(now)

    const add =
      trendPeriod === 'day'
        ? (t: number, n: number) => addDays(t, n)
        : trendPeriod === 'week'
          ? (t: number, n: number) => addWeeks(t, n)
          : trendPeriod === 'month'
            ? (t: number, n: number) => addMonths(t, n)
            : (t: number, n: number) => addYears(t, n)

    const buckets = Array.from({ length: 7 }, (_, i) => add(currentStart, i - 6))
    const ends = buckets.map((s) => add(s, 1))
    const labels = buckets.map((s) => formatLabel(s, trendPeriod))
    const counts = new Array<number>(7).fill(0)

    if (allHistory.length > 0) {
      // Count via a pointer walk (history is sorted asc)
      let idx = 0
      while (idx < allHistory.length && allHistory[idx] < buckets[0]) idx++
      for (let bi = 0; bi < 7; bi++) {
        const end = ends[bi]
        let c = 0
        while (idx < allHistory.length && allHistory[idx] < end) {
          c++
          idx++
        }
        counts[bi] = c
      }
    }

    // 即使近 7 个周期都为 0，也要展示趋势模块（仅不画曲线）
    return { labels, counts }
  }, [trendPeriod, trendKind])

  return (
    <div>
      <Space style={{ width: '100%', marginBottom: 16 }} orientation="vertical" size={4}>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          欢迎回来，<Typography.Text strong>{user!.username}</Typography.Text>（{user!.role}）
        </Typography.Paragraph>
      </Space>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card
            variant="outlined"
            styles={{
              body: {
                minHeight: CARD_BODY_MIN_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
              },
            }}
            title={
              <Space>
                <span>作品播放次数 Top 30</span>
                <Segmented
                  size="small"
                  value={period}
                  onChange={(v) => setPeriod(v as Period)}
                  className="top30-period-segmented"
                  style={
                    {
                      // CSS var for selected item background (theme-aware)
                      ['--top30-seg-selected-bg' as never]: token.colorPrimary,
                    } as React.CSSProperties
                  }
                  options={[
                    { label: '全部', value: 'all' },
                    { label: '周', value: 'week' },
                    { label: '月', value: 'month' },
                    { label: '年', value: 'year' },
                  ]}
                />
              </Space>
            }
            extra={
              <Space size={8}>
                <Select<WorkKind>
                  size="small"
                  value={topKind}
                  onChange={setTopKind}
                  options={[
                    { label: '视频', value: 'video' },
                    { label: '漫画', value: 'comic' },
                  ]}
                  style={{ width: 96 }}
                />
                {top30ByPlayCount.length > 10 && (
                  <Typography.Link
                    onClick={() => setExpanded((e) => !e)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {expanded ? (
                      <>
                        <UpOutlined /> 收起
                      </>
                    ) : (
                      <>
                        <DownOutlined /> 展开全部
                      </>
                    )}
                  </Typography.Link>
                )}
              </Space>
            }
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {top30ByPlayCount.length === 0 ? (
                <Typography.Text type="secondary">暂无作品数据</Typography.Text>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {displayList.map(({ video: v, count }, i) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 10em minmax(120px, 2fr) 80px',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <Typography.Text type="secondary">#{i + 1}</Typography.Text>
                      <Tooltip title={v.name}>
                        <Typography.Link
                          onClick={() =>
                            navigate(`/app/${topKind === 'video' ? 'videos' : 'comics'}?q=${encodeURIComponent(v.name)}`)
                          }
                          style={{
                            width: '10em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                        >
                          {v.name}
                        </Typography.Link>
                      </Tooltip>
                      <div
                        style={{
                          height: 24,
                          background: token.colorFillQuaternary || '#f0f0f0',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${(100 * (count / maxPlayCount)).toFixed(1)}%`,
                            minWidth: 4,
                            background: token.colorPrimary,
                            borderRadius: 4,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <Typography.Text strong>{count.toLocaleString()}</Typography.Text>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            variant="outlined"
            styles={{
              body: {
                minHeight: CARD_BODY_MIN_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
              },
            }}
            title={
              <Space>
                <span>作品观看趋势</span>
                <Segmented
                  size="small"
                  value={trendPeriod}
                  onChange={(v) => setTrendPeriod(v as TrendPeriod)}
                  className="top30-period-segmented"
                  style={
                    {
                      ['--top30-seg-selected-bg' as never]: token.colorPrimary,
                    } as React.CSSProperties
                  }
                  options={[
                    { label: '日', value: 'day' },
                    { label: '周', value: 'week' },
                    { label: '月', value: 'month' },
                    { label: '年', value: 'year' },
                  ]}
                />
              </Space>
            }
            extra={
              <Select<WorkKind>
                size="small"
                value={trendKind}
                onChange={setTrendKind}
                options={[
                  { label: '视频', value: 'video' },
                  { label: '漫画', value: 'comic' },
                ]}
                style={{ width: 96 }}
              />
            }
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <LineTrend
                points={trend.counts}
                stroke={token.colorPrimary}
                grid={token.colorBorderSecondary}
              />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 8,
                marginTop: 'auto',
                fontSize: 12,
                color: token.colorTextSecondary,
              }}
            >
              {trend.labels.map((lab, i) => (
                <div key={lab + i} style={{ textAlign: 'center' }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lab}</div>
                  <div style={{ color: token.colorText, fontWeight: 600 }}>{trend.counts[i]}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
