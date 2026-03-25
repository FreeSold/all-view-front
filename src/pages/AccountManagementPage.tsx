import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { mockDb, type Account, type AccountStatus } from '../mock/db'

type AccountFormValues = {
  username: string
  displayName: string
  roleId: string
  status: AccountStatus
}

export function AccountManagementPage() {
  const { message } = App.useApp()
  const roles = mockDb.listRoles()
  const [rows, setRows] = useState<Account[]>(() => mockDb.listAccounts())
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form] = Form.useForm<AccountFormValues>()

  const roleOptions = useMemo(
    () => roles.map((r) => ({ label: `${r.name}（${r.code}）`, value: r.id })),
    [roles],
  )

  const roleNameById = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.name]))
    return (id: string) => map.get(id) || id
  }, [roles])

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            账号管理
          </Typography.Title>
          <Typography.Text type="secondary">Demo：可新增 / 编辑 / 删除</Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null)
            form.setFieldsValue({
              username: '',
              displayName: '',
              roleId: roles[0]?.id || 'r_operator',
              status: 'active',
            })
            setOpen(true)
          }}
        >
          新建账号
        </Button>
      </Space>

      <Table
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 8 }}
        columns={[
          { title: '账号', dataIndex: 'username', width: 140 },
          { title: '显示名', dataIndex: 'displayName', width: 160 },
          {
            title: '角色',
            dataIndex: 'roleId',
            render: (v: string) => <Tag>{roleNameById(v)}</Tag>,
            width: 140,
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            render: (v: AccountStatus) =>
              v === 'active' ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
          },
          { title: '创建时间', dataIndex: 'createdAt' },
          {
            title: '操作',
            key: 'actions',
            width: 200,
            render: (_: unknown, record: Account) => (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(record)
                    form.setFieldsValue({
                      username: record.username,
                      displayName: record.displayName,
                      roleId: record.roleId,
                      status: record.status,
                    })
                    setOpen(true)
                  }}
                >
                  编辑
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    Modal.confirm({
                      title: '确认删除？',
                      content: `将删除账号：${record.username}`,
                      okText: '删除',
                      okButtonProps: { danger: true },
                      cancelText: '取消',
                      onOk: () => {
                        mockDb.deleteAccount(record.id)
                        setRows(mockDb.listAccounts())
                        message.success('已删除')
                      },
                    })
                  }}
                >
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title={editing ? '编辑账号' : '新建账号'}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        onCancel={() => setOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields()
            if (editing) {
              mockDb.updateAccount(editing.id, values)
              message.success('已保存')
            } else {
              mockDb.createAccount(values)
              message.success('已创建')
            }
            setRows(mockDb.listAccounts())
            setOpen(false)
          } catch (e) {
            if (e instanceof Error) message.error(e.message)
          }
        }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label="账号"
            name="username"
            rules={[
              { required: true, message: '请输入账号' },
              { min: 2, max: 32, message: '长度 2-32' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '仅支持字母/数字/下划线' },
            ]}
          >
            <Input placeholder="例如 admin_01" disabled={editing?.username === 'admin'} />
          </Form.Item>
          <Form.Item label="显示名" name="displayName" rules={[{ required: true, message: '请输入显示名' }]}>
            <Input placeholder="例如 张三" />
          </Form.Item>
          <Form.Item label="角色" name="roleId" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { label: '启用', value: 'active' },
                { label: '禁用', value: 'disabled' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
