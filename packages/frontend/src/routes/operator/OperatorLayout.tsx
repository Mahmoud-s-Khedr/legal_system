import { useEffect } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button, Layout, Spin, Typography } from "antd";
import { useOperatorAuthStore } from "../../store/operatorAuthStore";

const { Header, Content } = Layout;

export function OperatorLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { operator, isBootstrapped, bootstrap, logout } = useOperatorAuthStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (isBootstrapped && !operator && pathname !== "/operator/login") {
      void navigate({ to: "/operator/login" });
    }
  }, [isBootstrapped, operator, pathname, navigate]);

  if (!isBootstrapped) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!operator) {
    return <Outlet />;
  }

  return (
    <Layout className="min-h-screen">
      <Header className="flex items-center justify-between bg-slate-900 px-6">
        <div className="flex items-center gap-6">
          <Typography.Text className="text-lg font-semibold text-white">
            ELMS Operator
          </Typography.Text>
          <Link
            className="text-slate-300 hover:text-white"
            to="/operator/dashboard"
          >
            Dashboard
          </Link>
          <Link className="text-slate-300 hover:text-white" to="/operator/firms">
            Firms
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Typography.Text className="text-slate-300">
            {operator.displayName}
          </Typography.Text>
          <Button
            onClick={() => {
              void logout().then(() => navigate({ to: "/operator/login" }));
            }}
          >
            Log out
          </Button>
        </div>
      </Header>
      <Content className="bg-slate-50 p-6">
        <Outlet />
      </Content>
    </Layout>
  );
}
