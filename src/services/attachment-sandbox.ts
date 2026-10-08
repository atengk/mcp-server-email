/**
 * 附件受管沙箱存储服务，提供目录隔离、文件名净化与防路径穿越校验
 *
 * @author Ateng
 * @since 2026-10-08
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 获取当前受管附件沙箱的物理根目录
 *
 * 优先使用环境变量 MCP_ATTACHMENT_DIR，未配置时回退至系统临时目录下的独立隔离沙箱。
 *
 * @returns 沙箱根目录物理绝对路径
 */
export function getAttachmentSandboxDir(): string {
  const customDir = process.env.MCP_ATTACHMENT_DIR;
  if (customDir && customDir.trim().length > 0) {
    return path.resolve(customDir.trim());
  }
  return path.resolve(os.tmpdir(), "mcp-email-attachments");
}

/**
 * 严格净化原始附件文件名，剔除路径分隔符与危险字符
 *
 * @param rawName 原始附件文件名
 * @returns 净化后的安全纯文件名
 * @throws Error 当文件名包含恶意路径逃逸特征时
 */
export function sanitizeFileName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") {
    return `attachment-${Date.now()}`;
  }

  // 1. 深度检测显式路径穿越标记与空字节逃逸
  if (rawName.includes("..") || rawName.includes("\0")) {
    throw new Error(`拒绝处理：检测到非法路径穿越文件名 "${rawName}"`);
  }

  // 2. 剥离可能存在的路径前缀，仅保留基名（兼容正反斜杠）
  const normalized = rawName.replace(/\\/g, "/");
  let cleanName = path.posix.basename(normalized);

  // 3. 过滤系统保留控制字符与危险字符
  cleanName = cleanName.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_").trim();

  // 4. 若过滤后文件名为空或仅有点号，回退安全默认名称
  if (!cleanName || cleanName === "." || cleanName === "..") {
    cleanName = `attachment-${Date.now()}`;
  }

  return cleanName;
}

/**
 * 将附件二进制数据保存至受管沙箱物理目录
 *
 * @param rawFileName 原始文件名
 * @param content 二进制内容 Buffer 或 Uint8Array
 * @param customSandboxDir 可选的自定义沙箱目录（供测试与特定场景注入）
 * @returns 落盘结果信息，包含物理绝对路径与 file:/// 直达 URI
 * @throws Error 当目标路径试图越界逃逸沙箱根目录时
 */
export async function saveAttachmentToSandbox(
  rawFileName: string,
  content: Buffer | Uint8Array,
  customSandboxDir?: string
): Promise<{ filePath: string; fileUrl: string; filename: string; size: number }> {
  // 1. 解析沙箱绝对根路径并确保目录存在
  const sandboxDir = path.resolve(customSandboxDir || getAttachmentSandboxDir());
  await fs.mkdir(sandboxDir, { recursive: true });

  // 2. 净化文件名
  const safeFileName = sanitizeFileName(rawFileName);

  // 3. 构建物理目标路径并进行沙箱边界双重校验
  const targetPath = path.resolve(sandboxDir, safeFileName);
  const relative = path.relative(sandboxDir, targetPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`安全防御触发：目标路径 "${targetPath}" 越界逃逸沙箱根目录 "${sandboxDir}"`);
  }

  // 4. 二进制写入落盘
  await fs.writeFile(targetPath, content);

  // 5. 生成标准 file:/// 协议直达链接
  const fileUrl = pathToFileURL(targetPath).toString();

  return {
    filePath: targetPath,
    fileUrl,
    filename: safeFileName,
    size: content.byteLength,
  };
}
