import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { template as reportReady } from "@/lib/email-templates/report-ready";

describe("email display branding", () => {
  it("renders the platform logo and compact password-recovery typography", async () => {
    const html = await render(<RecoveryEmail siteName="Platform name" confirmationUrl="https://example.com/reset" logoSrc="data:image/png;base64,YWJj" />);
    expect(html).toContain("data:image/png;base64,YWJj");
    expect(html).toContain("Platform name");
    expect(html).toContain("font-size:18px");
    expect(html).not.toContain("font-size:22px");
  });
  it("keeps white-label organisation emails name-only when no safe private logo is supplied", async () => {
    const Component = reportReady.component;
    const html = await render(<Component siteName="Organisation name" logoSrc={null} />);
    expect(html).toContain("Organisation name");
    expect(html).not.toContain("<img");
  });
});