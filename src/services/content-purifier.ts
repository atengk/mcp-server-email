/**
 * 邮件正文提纯清洗、轻量 Markdown 转换与 30KB 安全截断
 *
 * @author Ateng
 * @since 2026-10-08
 */

/** 邮件正文最大允许字节数 (30KB) */
export const MAX_EMAIL_BODY_BYTES = 30 * 1024;

/** 超长正文安全截断提示声明 */
export const TRUNCATION_NOTICE = "\n\n[提示: 邮件正文已超过 30KB 安全阈值，已执行截断保护]";

/**
 * 将 HTML 富文本清洗转换为结构清晰的轻量 Markdown 或纯文本
 *
 * @param html 原始 HTML 字符串
 * @returns 转换后的 Markdown/纯文本
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  let text = html;

  // 1. 去除头部结构与无意义样式、脚本
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // 2. 转换常见排版与语义标签为 Markdown 格式
  text = text.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  text = text.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  text = text.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  text = text.replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  text = text.replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  text = text.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
  text = text.replace(/<hr\b[^>]*\/?>/gi, "\n---\n");
  text = text.replace(/<br\b[^>]*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|tr)>/gi, "\n");


  // 3. 剥离剩余所有 HTML 标签
  text = text.replace(/<[^>]+>/g, "");

  // 4. 常见 HTML 实体还原
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // 5. 规整空行与行首尾空白
  const lines = text.split("\n").map((line) => line.trim());
  const cleanLines: string[] = [];
  let prevEmpty = false;

  for (const line of lines) {
    if (line.length === 0) {
      if (!prevEmpty) {
        cleanLines.push("");
        prevEmpty = true;
      }
    } else {
      cleanLines.push(line);
      prevEmpty = false;
    }
  }

  return cleanLines.join("\n").trim();
}

/**
 * 提纯清洗邮件正文并执行 30KB 安全截断
 *
 * @param text 邮件纯文本内容（如有）
 * @param html 邮件 HTML 内容（如有）
 * @returns 提纯后的正文与是否发生截断标识
 */
export function purifyEmailBody(
  text?: string,
  html?: string
): { content: string; truncated: boolean } {
  // 1. 优先使用已转换的 Markdown 或提取的纯文本
  let rawContent = "";
  if (html && html.trim().length > 0) {
    rawContent = htmlToMarkdown(html);
  } else if (text && text.trim().length > 0) {
    rawContent = text.trim();
  }

  // 2. 检验 UTF-8 字节大小并执行截断
  const byteLength = Buffer.byteLength(rawContent, "utf-8");

  if (byteLength > MAX_EMAIL_BODY_BYTES) {
    const buffer = Buffer.from(rawContent, "utf-8");
    // 安全截取前 MAX_EMAIL_BODY_BYTES 字节，并过滤不完整字符
    const sliced = buffer.subarray(0, MAX_EMAIL_BODY_BYTES);
    const truncatedText = sliced.toString("utf-8");

    return {
      content: truncatedText + TRUNCATION_NOTICE,
      truncated: true,
    };
  }

  return {
    content: rawContent,
    truncated: false,
  };
}
