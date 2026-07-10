import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, InputNumber, Popconfirm, Space, Table, Tag } from "antd";
import { apiFetch, ApiError } from "../../lib/api";

interface OperatorFirm {
  id: string;
  name: string;
  slug: string;
  lifecycleStatus: string;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  manualMrr: string | number;
  settings?: { stripeCustomerId?: string | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "green",
  GRACE: "gold",
  SUSPENDED: "red",
  PENDING_DELETION: "volcano",
  DATA_DELETION_PENDING: "volcano",
  LICENSED: "blue"
};

export function OperatorFirmsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editingMrr, setEditingMrr] = useState<Record<string, number>>({});

  const firmsQuery = useQuery({
    queryKey: ["operator", "firms"],
    queryFn: () => apiFetch<{ firms: OperatorFirm[] }>("/api/operator/firms")
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["operator", "firms"] });
  }

  function handleError(error: unknown) {
    message.error(error instanceof ApiError ? error.message : "Action failed");
  }

  const suspendMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/operator/firms/${id}/suspend`, { method: "POST" }),
    onSuccess: invalidate,
    onError: handleError
  });

  const reinstateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/operator/firms/${id}/reinstate`, { method: "POST" }),
    onSuccess: invalidate,
    onError: handleError
  });

  const extendTrialMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/operator/firms/${id}/extend-trial`, {
        method: "POST",
        body: JSON.stringify({ days: 30 })
      }),
    onSuccess: invalidate,
    onError: handleError
  });

  const updateMrrMutation = useMutation({
    mutationFn: ({ id, mrr }: { id: string; mrr: number }) =>
      apiFetch(`/api/operator/firms/${id}/mrr`, {
        method: "PATCH",
        body: JSON.stringify({ mrr })
      }),
    onSuccess: async (_data, variables) => {
      setEditingMrr((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      await invalidate();
    },
    onError: handleError
  });

  const columns = [
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Status",
      dataIndex: "lifecycleStatus",
      key: "lifecycleStatus",
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] ?? "default"}>{status}</Tag>
      )
    },
    {
      title: "Trial ends",
      dataIndex: "trialEndsAt",
      key: "trialEndsAt",
      render: (value: string | null) => (value ? new Date(value).toLocaleDateString() : "—")
    },
    {
      title: "MRR (EGP)",
      dataIndex: "manualMrr",
      key: "manualMrr",
      render: (value: string | number, record: OperatorFirm) => (
        <Space>
          <InputNumber
            min={0}
            onChange={(next) =>
              setEditingMrr((current) => ({ ...current, [record.id]: next ?? 0 }))
            }
            value={editingMrr[record.id] ?? Number(value)}
          />
          <Button
            loading={updateMrrMutation.isPending}
            onClick={() =>
              updateMrrMutation.mutate({
                id: record.id,
                mrr: editingMrr[record.id] ?? Number(value)
              })
            }
            size="small"
          >
            Save
          </Button>
        </Space>
      )
    },
    {
      title: "Stripe customer",
      key: "stripeCustomerId",
      render: (_: unknown, record: OperatorFirm) =>
        record.settings?.stripeCustomerId ?? "—"
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: OperatorFirm) => (
        <Space>
          {record.lifecycleStatus === "SUSPENDED" ? (
            <Popconfirm
              onConfirm={() => reinstateMutation.mutate(record.id)}
              title="Reinstate this firm?"
            >
              <Button loading={reinstateMutation.isPending} size="small">
                Reinstate
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              onConfirm={() => suspendMutation.mutate(record.id)}
              title="Suspend this firm?"
            >
              <Button danger loading={suspendMutation.isPending} size="small">
                Suspend
              </Button>
            </Popconfirm>
          )}
          <Button
            loading={extendTrialMutation.isPending}
            onClick={() => extendTrialMutation.mutate(record.id)}
            size="small"
          >
            Extend trial 30d
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={firmsQuery.data?.firms}
      loading={firmsQuery.isLoading}
      rowKey="id"
    />
  );
}
