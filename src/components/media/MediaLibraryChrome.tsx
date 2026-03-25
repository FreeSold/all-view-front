import { CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons'
import { Button, Card, Space, Tag, Typography } from 'antd'
import type { CSSProperties, ReactNode } from 'react'

type SelectAllToggleButtonProps = {
  /** 当前筛选结果总数（为 0 时禁用） */
  total: number
  /** 当前已选数量 */
  selectedCount: number
  onToggle: () => void
}

/**
 * 全选切换按钮：全部已选时高亮（primary）且再次点击取消全选；
 * 否则点击选中所有当前结果。三个媒体管理页共用。
 */
export function SelectAllToggleButton({ total, selectedCount, onToggle }: SelectAllToggleButtonProps) {
  const allSelected = total > 0 && selectedCount === total
  return (
    <Button
      size="small"
      type={allSelected ? 'primary' : 'default'}
      disabled={total === 0}
      onClick={onToggle}
    >
      全选
    </Button>
  )
}

const FILTER_TAG: CSSProperties = {
  fontSize: 11,
  lineHeight: '18px',
  marginInlineEnd: 0,
  padding: '0 5px',
}

type MediaFilterSortCardProps = {
  filterExpanded: boolean
  onFilterExpandedChange: (next: boolean) => void
  hasActiveFilters: boolean
  /** 列表模式：放在卡片标题行右侧 */
  extra?: ReactNode
  children: ReactNode
}

/** 与图片管理一致的「筛选与排序」外层卡片（展开区域由 children 提供） */
export function MediaFilterSortCard({
  filterExpanded,
  onFilterExpandedChange,
  hasActiveFilters,
  extra,
  children,
}: MediaFilterSortCardProps) {
  const title = (
    <Space wrap align="center" size={6}>
      <Typography.Text strong style={{ fontSize: 13, lineHeight: '22px' }}>
        筛选与排序
      </Typography.Text>
      <Button
        type="link"
        size="small"
        onClick={() => onFilterExpandedChange(!filterExpanded)}
        style={{
          padding: '0 4px',
          height: 22,
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {filterExpanded ? (
          <>
            折叠
            <CaretUpOutlined style={{ fontSize: 10 }} />
          </>
        ) : (
          <>
            展开
            <CaretDownOutlined style={{ fontSize: 10 }} />
          </>
        )}
      </Button>
      {hasActiveFilters ? (
        <Tag color="processing" style={{ ...FILTER_TAG, cursor: 'default' }}>
          筛选已启用
        </Tag>
      ) : null}
    </Space>
  )

  return (
    <Card
      size="small"
      title={title}
      extra={extra}
      style={{ marginBottom: 8 }}
      styles={{
        body: {
          paddingBlock: filterExpanded ? 6 : 0,
          paddingInline: 12,
        },
        header: {
          flexWrap: 'wrap',
          alignItems: 'center',
          rowGap: 4,
          minHeight: 36,
          paddingBlock: 6,
        },
      }}
    >
      {filterExpanded ? children : null}
    </Card>
  )
}

type MediaResultsCardProps = {
  title: ReactNode
  extra?: ReactNode
  children: ReactNode
}

/** 与图片管理一致的「条数 + 视图/分页」内容卡片 */
export function MediaResultsCard({ title, extra, children }: MediaResultsCardProps) {
  return (
    <Card
      size="small"
      title={title}
      extra={extra}
      style={{ flex: 1, minHeight: 0 }}
      styles={{
        header: {
          flexWrap: 'wrap',
          alignItems: 'center',
          rowGap: 4,
          minHeight: 36,
          paddingBlock: 6,
        },
      }}
    >
      {children}
    </Card>
  )
}
