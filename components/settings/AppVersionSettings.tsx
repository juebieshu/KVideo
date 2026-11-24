"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MIcon, materialIconMap } from "@/components/ui/Icon";

import { Button } from "@/components/ui/Button";
import { APP_VERSION } from "@/lib/app-version";
import type { AppUpdateResponse } from "@/lib/types/app-update";

const LAST_CHECKED_AT_KEY = "kvideo:app-update:last-checked-at";

const DEFAULT_SOURCE = {
  repository: "KuekHaoYang/KVideo",
  branch: "main",
  manifestUrl:
    "https://raw.githubusercontent.com/KuekHaoYang/KVideo/main/app-release.json",
  changelogUrl: "https://github.com/KuekHaoYang/KVideo/blob/main/CHANGELOG.md",
  repositoryUrl: "https://github.com/KuekHaoYang/KVideo",
};

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "未记录";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getStatusLabel(data: AppUpdateResponse | null) {
  switch (data?.status) {
    case "update-available":
      return "发现新版本";

    case "ahead-of-remote":
      return "本地版本较新";

    case "check-failed":
      return "检查失败";

    case "up-to-date":
    default:
      return "已是最新版本";
  }
}

function readLastCheckedAt() {
  try {
    return window.localStorage.getItem(LAST_CHECKED_AT_KEY);
  } catch {
    // 隐私模式或浏览器策略可能导致 localStorage 不可用。
    return null;
  }
}

function saveLastCheckedAt(value: string) {
  try {
    window.localStorage.setItem(LAST_CHECKED_AT_KEY, value);
  } catch {
    // 保存失败不影响版本检查功能。
  }
}

export function AppVersionSettings() {
  const [data, setData] = useState<AppUpdateResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const requestController = useRef<AbortController | null>(null);

  const fetchUpdateInfo = useCallback(async () => {
    // 如果已有请求进行中，先取消旧请求，避免结果相互覆盖。
    requestController.current?.abort();

    const controller = new AbortController();
    requestController.current = controller;

    setIsChecking(true);

    try {
      const response = await fetch("/api/app-update", {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as AppUpdateResponse;

      if (controller.signal.aborted) {
        return;
      }

      setData(payload);
      setHasLoaded(true);

      // 使用接口返回的检查时间；接口没有返回时保留已有记录。
      if (payload.checkedAt) {
        setLastCheckedAt(payload.checkedAt);
        saveLastCheckedAt(payload.checkedAt);
      }
    } catch (error) {
      // 请求被取消时不显示“检查失败”。
      if (controller.signal.aborted) {
        return;
      }

      const checkedAt = new Date().toISOString();

      setHasLoaded(true);
      setLastCheckedAt(checkedAt);
      saveLastCheckedAt(checkedAt);

      setData((previous) => ({
        currentVersion: previous?.currentVersion || "未知",
        currentRelease: previous?.currentRelease || null,
        latestVersion:
          previous?.latestVersion || previous?.currentVersion || "未知",
        latestRelease:
          previous?.latestRelease || previous?.currentRelease || null,
        status: "check-failed",
        updateAvailable: false,
        checkedAt,
        checkedRemotely: false,
        usedRemoteManifest: false,
        source: previous?.source || DEFAULT_SOURCE,
        error: error instanceof Error ? error.message : "未知错误",
      }));
    } finally {
      if (!controller.signal.aborted) {
        setIsChecking(false);

        if (requestController.current === controller) {
          requestController.current = null;
        }
      }
    }
  }, []);

  useEffect(() => {
    // 先恢复上次检查时间，再发起本次检查。
    setLastCheckedAt(readLastCheckedAt());

    void fetchUpdateInfo();

    return () => {
      requestController.current?.abort();
      requestController.current = null;
    };
  }, [fetchUpdateInfo]);

  const handleRefresh = () => {
    void fetchUpdateInfo();
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-4 border-b border-(--sv2-border) pb-3">
        <h2 className="text-[18px] font-semibold text-(--text-color)">
          版本与更新
        </h2>
      </header>

      <section aria-label="版本信息">
        <div className="flex items-center justify-between gap-4 border-b border-(--sv2-border) pb-5">
          <div className="flex min-h-12 min-w-0 flex-1 flex-col justify-center">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="inline-flex min-h-6 items-center gap-1.5 text-[14px] leading-5">
                <span className="shrink-0 text-(--text-color-secondary)">
                  当前版本
                </span>

                <span className="wrap-break-word font-medium text-(--text-color)">
                  {APP_VERSION}
                </span>
              </div>

              <span
                aria-live="polite"
                className="inline-flex h-6 items-center rounded-md bg-(--sv2-surface-2) px-2 text-[12px] leading-5 font-medium text-(--text-color-secondary)">
                {isChecking
                  ? "正在检查"
                  : hasLoaded
                    ? getStatusLabel(data)
                    : "未检查"}
              </span>
            </div>

            {lastCheckedAt && (
              <p className="mt-1 h-5 truncate text-[12px] leading-4 text-(--kv-color-text-tertiary)">
                上次检查：{formatDateLabel(lastCheckedAt)}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="normal"
            className="shrink-0 gap-1.5"
            onClick={handleRefresh}
            disabled={isChecking}>
            <MIcon icon={materialIconMap.RefreshCw} width={13} height={13} className={isChecking ? "animate-spin" : ""} />

            {isChecking ? "检查中" : "检查更新"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-4 text-[13px] leading-5">
          <div className="min-w-0 wrap-break-word">
            <span className="text-(--text-color-secondary)">检查来源：</span>

            <span className="text-(--text-color)">
              {data?.source.repository || DEFAULT_SOURCE.repository}

              <span className="mx-1.5 text-(--text-color-secondary)">·</span>

              {data?.source.branch || DEFAULT_SOURCE.branch}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
            <Link
              href={data?.source.changelogUrl || DEFAULT_SOURCE.changelogUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-(--text-color-secondary) transition-colors hover:text-(--text-color)">
              更新日志
              <MIcon icon={materialIconMap.ExternalLink} width={12} height={12} />
            </Link>

            <Link
              href={data?.source.repositoryUrl || DEFAULT_SOURCE.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-(--text-color-secondary) transition-colors hover:text-(--text-color)">
              GitHub 仓库
              <MIcon icon={materialIconMap.ExternalLink} width={12} height={12} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
