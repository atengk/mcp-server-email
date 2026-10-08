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
 * @param uid 可选的邮件 UID 标识，用于按邮件分层子目录隔离防同名覆盖
 * @returns 落盘结果信息，包含物理绝对路径与 file:/// 直达 URI
 * @throws Error 当目标路径试图越界逃逸沙箱根目录时
 */
export async function saveAttachmentToSandbox(
  rawFileName: string,
  content: Buffer | Uint8Array,
  customSandboxDir?: string,
  uid?: number | string
): Promise<{ filePath: string; fileUrl: string; filename: string; size: number }> {
  // 1. 解析沙箱绝对根路径并确保目录存在
  const sandboxDir = path.resolve(customSandboxDir || getAttachmentSandboxDir());
  const targetDir = uid !== undefined ? path.join(sandboxDir, String(uid)) : sandboxDir;
  await fs.mkdir(targetDir, { recursive: true });

  // 2. 净化文件名
  const safeFileName = sanitizeFileName(rawFileName);

  // 3. 构建物理目标路径并进行沙箱边界双重校验
  const targetPath = path.resolve(targetDir, safeFileName);
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

/**
 * 校验待外发本地附件路径的安全性，防止敏感文件外发泄露
 *
 * 严格限制仅允许读取受管沙箱目录 (MCP_ATTACHMENT_DIR) 或当前工作区目录下的文件，
 * 严禁越界读取操作系统敏感文件（如 /etc/passwd、id_rsa）及环境变量配置文件 (.env*)。
 *
 * @param candidatePath 候选本地文件路径
 * @returns 规整后的绝对物理路径
 * @throws Error 当路径非法、不存在或超出安全白名单范围时
 */
export function validateOutboundAttachmentPath(candidatePath: string): string {
  if (!candidatePath || typeof candidatePath !== "string") {
    throw new Error("附件路径必须为有效的非空字符串");
  }

  // 1. 拦截空字节注入
  if (candidatePath.includes("\0")) {
    throw new Error("非法附件路径：检测到空字节注入");
  }

  const resolvedPath = path.resolve(candidatePath);
  const baseName = path.basename(resolvedPath).toLowerCase();

  // 2. 严格拦截关键敏感凭据与配置文件
  if (
    baseName.startsWith(".env") ||
    baseName === "id_rsa" ||
    baseName === "id_ed25519" ||
    baseName.endsWith(".pem") ||
    baseName.endsWith(".key") ||
    baseName === "shadow" ||
    baseName === "passwd" ||
    baseName === "sam" ||
    baseName === "system"
  ) {
    throw new Error(`安全拦截：严禁外发系统关键敏感凭据文件 "${baseName}"`);
  }

  // 3. 白名单根目录校验：受管沙箱目录或当前运行工作区目录
  const sandboxDir = getAttachmentSandboxDir();
  const cwdDir = process.cwd();

  const relSandbox = path.relative(sandboxDir, resolvedPath);
  const inSandbox = !relSandbox.startsWith("..") && !path.isAbsolute(relSandbox);

  const relCwd = path.relative(cwdDir, resolvedPath);
  const inCwd = !relCwd.startsWith("..") && !path.isAbsolute(relCwd);

  if (!inSandbox && !inCwd) {
    throw new Error(
      `安全拦截：待外发附件路径 "${candidatePath}" 超出允许的安全目录边界（仅允许当前工作区或沙箱附件目录）`
    );
  }

  return resolvedPath;
}
