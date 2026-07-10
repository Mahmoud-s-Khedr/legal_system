import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row, Skeleton, Statistic } from "antd";
import { apiFetch } from "../../lib/api";

interface OperatorStats {
  activeFirms: number;
  totalFirms: number;
  mrrTotal: number;
  billingMode: string;
}

export function OperatorDashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["operator", "stats"],
    queryFn: () => apiFetch<OperatorStats>("/api/operator/stats")
  });

  if (statsQuery.isLoading) {
    return <Skeleton active />;
  }

  const stats = statsQuery.data;

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card>
          <Statistic title="Active firms" value={stats?.activeFirms ?? 0} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="Total firms" value={stats?.totalFirms ?? 0} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic
            precision={2}
            prefix="EGP"
            title="Monthly recurring revenue (manual)"
            value={stats?.mrrTotal ?? 0}
          />
        </Card>
      </Col>
    </Row>
  );
}
