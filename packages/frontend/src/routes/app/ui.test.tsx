import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../i18n";
import {
  Field,
  FormAlert,
  PageHeader,
  ResponsiveDataList,
  SelectField,
  TablePagination,
  TableWrapper,
  selectLabelFilter
} from "./ui";

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

describe("shared ui fields", () => {
  it("associates input with explicit label and error metadata", () => {
    const view = render(
      <Field
        id="client-email"
        label="Email"
        value=""
        onChange={() => undefined}
        error="Invalid email"
        hint="Use your work email"
      />
    );

    const input = view.querySelector("input#client-email");
    const label = view.querySelector("label[for='client-email']");
    const error = view.querySelector("#client-email-error");
    const hint = view.querySelector("#client-email-hint");

    expect(label?.textContent).toContain("Email");
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(input?.getAttribute("aria-describedby")).toContain(
      "client-email-hint"
    );
    expect(input?.getAttribute("aria-describedby")).toContain(
      "client-email-error"
    );
    expect(error?.textContent).toBe("Invalid email");
    expect(hint?.textContent).toBe("Use your work email");
  });

  it("renders form alert with polite live region", () => {
    const view = render(<FormAlert message="Login failed" />);
    const alert = view.querySelector("[role='alert']");

    expect(alert?.getAttribute("aria-live")).toBe("polite");
    expect(alert?.textContent).toContain("Login failed");
  });

  it("filters select options by visible label and search metadata", () => {
    expect(selectLabelFilter("gov", { label: "Government" })).toBe(true);
    expect(selectLabelFilter("comp", { label: "Company" })).toBe(true);
    expect(selectLabelFilter("xyz", { label: "Company" })).toBe(false);
    expect(
      selectLabelFilter("poa-445", {
        label: "Ahmed",
        searchText: "Ahmed Individual POA-445 01001234567"
      })
    ).toBe(true);
  });

  it("renders select field metadata with searchable combobox", () => {
    const view = render(
      <SelectField
        id="client-type"
        label="Type"
        value=""
        onChange={() => undefined}
        options={[
          { value: "", label: "All" },
          { value: "INDIVIDUAL", label: "Individual" },
          { value: "COMPANY", label: "Company" }
        ]}
        hint="Choose a type"
      />
    );

    const label = view.querySelector("label#client-type-label");
    const hint = view.querySelector("#client-type-hint");
    expect(label?.textContent).toContain("Type");
    expect(hint?.textContent).toContain("Choose a type");

    const selectRoot = view.querySelector(".ant-select");
    const combobox = view.querySelector("input[role='combobox']");
    expect(selectRoot).not.toBeNull();
    expect(combobox).not.toBeNull();
  });

  it("localizes table pagination labels and summary in English", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });

    const view = render(
      <TablePagination
        page={2}
        pageSize={20}
        total={55}
        onPageChange={() => undefined}
        onPageSizeChange={() => undefined}
      />
    );

    expect(view.textContent).toContain("Showing 21 to 40 of 55");
    expect(view.textContent).toContain("Page 2 of 3");
    expect(view.textContent).toContain("Previous");
    expect(view.textContent).toContain("Next");
    expect(
      document.querySelector("[aria-label='Items per page']")
    ).not.toBeNull();
  });

  it("localizes table pagination labels and summary in Arabic", async () => {
    await act(async () => {
      await i18n.changeLanguage("ar");
    });

    const view = render(
      <TablePagination
        page={2}
        pageSize={20}
        total={55}
        onPageChange={() => undefined}
        onPageSizeChange={() => undefined}
      />
    );

    expect(view.textContent).toContain("عرض");
    expect(view.textContent).toContain("من أصل");
    expect(view.textContent).toContain("الصفحة");
    expect(view.textContent).toContain("السابق");
    expect(view.textContent).toContain("التالي");
    expect(
      document.querySelector("[aria-label='عدد العناصر في الصفحة']")
    ).not.toBeNull();
  });

  it("renders page header with sticky action container", () => {
    const view = render(
      <PageHeader
        title="Title"
        description="Description"
        stickyActions
        actions={<button type="button">A1</button>}
      />
    );
    expect(view.querySelector(".lg\\:sticky")).not.toBeNull();
  });

  it("sets table wrapper mobile mode attributes", () => {
    const view = render(
      <TableWrapper mobileMode="cards" breakpoint="md">
        <table>
          <tbody>
            <tr>
              <td>cell</td>
            </tr>
          </tbody>
        </table>
      </TableWrapper>
    );
    const wrapper = view.querySelector(
      "[data-mobile-mode='cards'][data-breakpoint='md']"
    );
    expect(wrapper).not.toBeNull();
  });

  it("renders responsive data list rows", () => {
    const view = render(
      <ResponsiveDataList
        items={[{ id: "1", title: "Case A", status: "Open" }]}
        getItemKey={(item) => item.id}
        fields={[
          { key: "title", label: "Title", render: (item) => item.title },
          { key: "status", label: "Status", render: (item) => item.status }
        ]}
      />
    );
    expect(view.textContent).toContain("Case A");
    expect(view.textContent).toContain("Status");
  });
});
