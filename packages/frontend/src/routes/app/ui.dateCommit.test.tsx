import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => (
    <a {...props}>{children}</a>
  )
}));

vi.mock("antd", () => ({
  DatePicker: ({
    id,
    value,
    onChange,
    onBlur,
    disabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired
  }: {
    id?: string;
    value?: { format: (fmt: string) => string } | null;
    onChange?: (value: ReturnType<typeof dayjs> | null) => void;
    onBlur?: () => void;
    disabled?: boolean;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
  }) => (
    <input
      id={id}
      data-testid={id ?? "mock-date-picker"}
      value={value ? value.format("YYYY-MM-DDTHH:mm") : ""}
      onInput={(event) => {
        const nextValue = (event.target as HTMLInputElement).value;
        onChange?.(nextValue ? dayjs(nextValue) : null);
      }}
      onBlur={onBlur}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-required={ariaRequired}
      disabled={disabled}
    />
  ),
  Select: ({
    id,
    value,
    onChange,
    options = []
  }: {
    id?: string;
    value?: string | number;
    onChange?: (value: string) => void;
    options?: Array<{ value: string | number; label: string }>;
  }) => (
    <select
      id={id}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}));

import { Field } from "./ui";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

describe("Field date commit behavior", () => {
  it("commits datetime-local value immediately even with blur commit mode", () => {
    const onChange = vi.fn();

    const view = render(
      <Field
        id="hearing-datetime"
        label="Session datetime"
        value=""
        onChange={onChange}
        type="datetime-local"
        commitMode="blur"
      />
    );

    const input = view.querySelector(
      "[data-testid='hearing-datetime']"
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    act(() => {
      input.value = "2026-04-30T14:05";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("2026-04-30T14:05");
  });

  it("submits the selected datetime without requiring blur", () => {
    const submissions: string[] = [];

    function FormHarness() {
      const [value, setValue] = useState("");

      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submissions.push(value);
          }}
        >
          <Field
            id="task-due-at"
            label="Due date"
            value={value}
            onChange={setValue}
            type="datetime-local"
            commitMode="blur"
          />
          <button type="submit">Submit</button>
        </form>
      );
    }

    const view = render(<FormHarness />);
    const input = view.querySelector(
      "[data-testid='task-due-at']"
    ) as HTMLInputElement;
    const submit = view.querySelector(
      "button[type='submit']"
    ) as HTMLButtonElement;

    act(() => {
      input.value = "2026-05-01T09:10";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    act(() => {
      submit.click();
    });

    expect(submissions).toEqual(["2026-05-01T09:10"]);
  });
});
