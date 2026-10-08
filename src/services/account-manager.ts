/**
 * 多账户连接池与动态路由调度管理器
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { config } from "../config/index.js";
import type {
  AccountProfile,
  ConnectionVerifyReport,
  SanitizedAccountProfile,
} from "../types/index.js";
import { ImapService } from "./imap.service.js";
import { SmtpService } from "./smtp.service.js";

/**
 * 账户管理与路由调度核心服务
 */
export class AccountManager {
  private readonly accounts = new Map<string, AccountProfile>();
  private readonly defaultAccountId: string;
  private readonly smtpPool = new Map<string, SmtpService>();
  private readonly imapPool = new Map<string, ImapService>();

  /**
   * 构造账户管理器实例
   *
   * @param accountList 预加载的账户画像列表，缺省为 config.accounts
   * @param defaultId 默认账户标识，缺省为 config.defaultAccountId
   */
  constructor(
    accountList: AccountProfile[] = config.accounts,
    defaultId: string = config.defaultAccountId
  ) {
    accountList.forEach((acc) => {
      this.accounts.set(acc.id, acc);
    });
    this.defaultAccountId = defaultId;
  }

  /**
   * 列出所有已配置的账户脱敏元数据（隐藏密码与授权码）
   *
   * @returns 脱敏账户画像列表
   */
  listAccounts(): SanitizedAccountProfile[] {
    const result: SanitizedAccountProfile[] = [];

    for (const [id, acc] of this.accounts.entries()) {
      result.push({
        id,
        name: acc.name,
        email: acc.email || acc.smtp?.user || acc.imap?.user,
        isDefault: id === this.defaultAccountId,
        smtp: acc.smtp
          ? {
              host: acc.smtp.host,
              port: acc.smtp.port,
              secure: acc.smtp.secure,
              user: acc.smtp.user,
              from: acc.smtp.from,
            }
          : undefined,
        imap: acc.imap
          ? {
              host: acc.imap.host,
              port: acc.imap.port,
              secure: acc.imap.secure,
              user: acc.imap.user,
            }
          : undefined,
      });
    }

    return result;
  }

  /**
   * 获取指定的账户画像，缺省时自动回退至默认账户
   *
   * @param accountId 可选的账户标识
   * @returns 目标账户完整画像
   * @throws Error 当未找到指定或默认账户配置时
   */
  getAccount(accountId?: string): AccountProfile {
    const targetId = accountId || this.defaultAccountId;
    const account = this.accounts.get(targetId);

    if (!account) {
      if (accountId) {
        throw new Error(
          `未找到指定标识为 "${accountId}" 的邮箱账户配置，请通过 list_accounts 查看可用画像`
        );
      }
      throw new Error(
        `未找到默认邮箱账户配置 (defaultId: "${this.defaultAccountId}")，请检查配置`
      );
    }

    return account;
  }

  /**
   * 根据账户标识路由并获取缓存的 SMTP 服务实例
   *
   * @param accountId 可选账户标识
   * @returns SMTP 服务实例
   */
  getSmtpService(accountId?: string): SmtpService {
    const account = this.getAccount(accountId);
    if (!account.smtp) {
      throw new Error(`账户 "${account.id}" 未配置 SMTP 外发服务参数`);
    }

    let service = this.smtpPool.get(account.id);
    if (!service) {
      service = new SmtpService(account.smtp);
      this.smtpPool.set(account.id, service);
    }

    return service;
  }

  /**
   * 根据账户标识路由并获取缓存的 IMAP 服务实例
   *
   * @param accountId 可选账户标识
   * @returns IMAP 服务实例
   */
  getImapService(accountId?: string): ImapService {
    const account = this.getAccount(accountId);
    if (!account.imap) {
      throw new Error(`账户 "${account.id}" 未配置 IMAP 查收服务参数`);
    }

    let service = this.imapPool.get(account.id);
    if (!service) {
      service = new ImapService(account.imap);
      this.imapPool.set(account.id, service);
    }

    return service;
  }

  /**
   * 对指定或默认账户执行网络连通性与认证体检
   *
   * @param accountId 可选账户标识
   * @returns 综合体检诊断报告
   */
  async verifyConnection(accountId?: string): Promise<ConnectionVerifyReport> {
    const account = this.getAccount(accountId);

    // 1. SMTP 协议握手与认证体检
    const smtpResult: ConnectionVerifyReport["smtp"] = {
      configured: Boolean(account.smtp),
      success: false,
      host: account.smtp?.host,
      port: account.smtp?.port,
    };

    if (account.smtp) {
      try {
        const smtpClient = this.getSmtpService(account.id);
        await smtpClient.verifyConnection();
        smtpResult.success = true;
      } catch (err: unknown) {
        smtpResult.error = err instanceof Error ? err.message : String(err);
      }
    }

    // 2. IMAP 协议握手与认证体检
    const imapResult: ConnectionVerifyReport["imap"] = {
      configured: Boolean(account.imap),
      success: false,
      host: account.imap?.host,
      port: account.imap?.port,
    };

    if (account.imap) {
      try {
        const imapClient = this.getImapService(account.id);
        await imapClient.verifyConnection();
        imapResult.success = true;
      } catch (err: unknown) {
        imapResult.error = err instanceof Error ? err.message : String(err);
      }
    }

    // 3. 综合判断体检结果
    const overallSuccess =
      (!smtpResult.configured || smtpResult.success) &&
      (!imapResult.configured || imapResult.success) &&
      (smtpResult.configured || imapResult.configured);

    return {
      account: account.id,
      smtp: smtpResult,
      imap: imapResult,
      overallSuccess,
    };
  }
}

export const accountManager = new AccountManager();
