/**
 * 正文提纯、Markdown 转换与 30KB 安全截断单元测试
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { describe, expect, it } from "vitest";
import {
  MAX_EMAIL_BODY_BYTES,
  purifyEmailBody,
} from "../src/services/content-purifier.js";

describe("Content Purifier & 30KB Truncation", () => {
  it("应成功过滤冗余 CSS 样式与脚本，并将 HTML 转换为干净易读的 Markdown 文本", () => {
    const rawHtml = `
      <html>
        <head>
          <style>
            .banner { color: blue; font-family: Arial; }
            #nav { display: none; }
          </style>
          <script>console.log("tracking script");</script>
        </head>
        <body>
          <h1>项目周报 (2026-Q4)</h1>
          <p>各位同事好：</p>
          <p>本周核心进展如下：</p>
          <ul>
            <li>完成 <b>架构设计</b> 与接口定义</li>
            <li>访问 <a href="https://example.com/docs">技术文档</a> 查阅详情</li>
          </ul>
          <hr />
          <div>感谢大家的辛勤付出！</div>
        </body>
      </html>
    `;

    const { content, truncated } = purifyEmailBody(undefined, rawHtml);

    expect(truncated).toBe(false);
    expect(content).not.toContain("<style>");
    expect(content).not.toContain("console.log");
    expect(content).not.toContain("<html>");
    expect(content).toContain("# 项目周报 (2026-Q4)");
    expect(content).toContain("**架构设计**");
    expect(content).toContain("[技术文档](https://example.com/docs)");
    expect(content).toContain("- 完成");
  });

  it("当邮件正文超过 30KB 安全阈值时应执行截断并追加截断声明", () => {
    // 生成超过 35KB 的纯文本内容
    const longChunk = "这是一段非常冗长的技术规范说明正文内容。".repeat(1200); // ~48KB
    expect(Buffer.byteLength(longChunk, "utf-8")).toBeGreaterThan(MAX_EMAIL_BODY_BYTES);

    const { content, truncated } = purifyEmailBody(longChunk);

    expect(truncated).toBe(true);
    expect(content).toContain("[提示: 邮件正文已超过 30KB 安全阈值，已执行截断保护]");
    // 截断后的字节数应受到严格控制
    const baseContent = content.replace("\n\n[提示: 邮件正文已超过 30KB 安全阈值，已执行截断保护]", "");
    expect(Buffer.byteLength(baseContent, "utf-8")).toBeLessThanOrEqual(MAX_EMAIL_BODY_BYTES);
  });

  it("正文未超长时不应追加截断声明", () => {
    const normalText = "这是一封正常长度的工作邮件，内容简明扼要。";
    const { content, truncated } = purifyEmailBody(normalText);

    expect(truncated).toBe(false);
    expect(content).toBe(normalText);
    expect(content).not.toContain("截断保护");
  });
});
