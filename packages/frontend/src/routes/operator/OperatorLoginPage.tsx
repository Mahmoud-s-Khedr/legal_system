import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { App, Button, Card, Form, Input, Typography } from "antd";
import { useOperatorAuthStore } from "../../store/operatorAuthStore";
import { ApiError } from "../../lib/api";

export function OperatorLoginPage() {
  const navigate = useNavigate();
  const login = useOperatorAuthStore((state) => state.login);
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Card className="w-full max-w-sm" title="Operator Login">
        <Typography.Paragraph type="secondary">
          Platform-owner access only.
        </Typography.Paragraph>
        <Form
          layout="vertical"
          onFinish={async (values: { email: string; password: string }) => {
            setSubmitting(true);
            try {
              await login(values);
              await navigate({ to: "/operator/dashboard" });
            } catch (error) {
              const errorMessage =
                error instanceof ApiError ? error.message : "Login failed";
              message.error(errorMessage);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button block htmlType="submit" loading={submitting} type="primary">
            Log in
          </Button>
        </Form>
      </Card>
    </div>
  );
}
