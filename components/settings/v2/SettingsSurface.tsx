"use client";
import { materialIconMap } from '@/components/ui/icons/icon-map';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MIcon as Icon } from "@/components/ui/Icon";
import { useSettingsPage } from "@/lib/hooks/useSettingsPage";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { hasResolvedPermission } from "@/lib/auth/permissions";
import {
  useSettingsUiStore,
  type SettingsSectionId,
} from "@/lib/store/settings-ui-store";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { AddSourceModal } from "@/components/settings/AddSourceModal";
import { AppVersionSettings } from "@/components/settings/AppVersionSettings";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { DataSettings } from "@/components/settings/DataSettings";
import { DisplaySettings } from "@/components/settings/DisplaySettings";
import { ExportModal } from "@/components/settings/ExportModal";
import { ImportModal } from "@/components/settings/ImportModal";
import { PlayerSettings } from "@/components/settings/PlayerSettings";
import { PremiumSourceSettings } from "@/components/settings/PremiumSourceSettings";
import { SourceSettings } from "@/components/settings/SourceSettings";
import { UserSourceSettings } from "@/components/settings/UserSourceSettings";
import { UserDanmakuSettings } from "@/components/settings/UserDanmakuSettings";
import { SubscriptionImportTab } from "@/components/settings/import/SubscriptionImportTab";
import { SettingsCurrentAccount } from "./SettingsCurrentAccount";
import { SettingsSidebar } from "./SettingsSidebar";
import "./icons";

interface SettingsSurfaceProps {
  variant: "modal" | "page";
  onClose?: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SettingsSurface({ variant, onClose }: SettingsSurfaceProps) {
  const settings = useSettingsPage();
  const { section, setSection } = useSettingsUiStore();
  const session = useAuthSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectSection = (nextSection: SettingsSectionId) => {
    setSection(nextSection);
    setMobileNavOpen(false);
  };

  const canManageUsers = session?.role === "super_admin";
  const canUsePlayerSettings = session
    ? hasResolvedPermission(
        session.role,
        "player_settings",
        session.customPermissions,
      )
    : true;
  const canManageSources = session
    ? hasResolvedPermission(
        session.role,
        "source_management",
        session.customPermissions,
      )
    : true;
  const canManageData = session
    ? hasResolvedPermission(
        session.role,
        "data_management",
        session.customPermissions,
      )
    : true;
  const canUseDanmakuApi = session
    ? hasResolvedPermission(
        session.role,
        "danmaku_api",
        session.customPermissions,
      )
    : true;

  const visibleSections = useMemo(() => {
    const sections: SettingsSectionId[] = [
      "account",
      "display",
      "personal-sources",
      "about",
    ];
    if (canManageUsers) sections.push("users");
    if (canUsePlayerSettings) sections.push("playback");
    if (canManageSources) sections.push("public-sources", "subscriptions");
    if (canManageData) sections.push("privacy");
    return sections;
  }, [canManageUsers, canManageSources, canManageData, canUsePlayerSettings]);

  useEffect(() => {
    if (!visibleSections.includes(section)) {
      setSection(visibleSections[0] || "account");
    }
  }, [section, setSection, visibleSections]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [section]);

  useEffect(() => {
    if (variant !== "modal") return;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [variant]);

  const sidebar = (
    <SettingsSidebar
      section={section}
      onSelect={selectSection}
      canManageUsers={canManageUsers}
      canUsePlayerSettings={canUsePlayerSettings}
      canManageSources={canManageSources}
      canManageData={canManageData}
    />
  );

  return (
    <div
      ref={dialogRef}
      data-settings-theme=""
      tabIndex={-1}
      role={variant === "modal" ? "dialog" : undefined}
      aria-modal={variant === "modal" ? true : undefined}
      aria-labelledby="settings-title"
      className={`settings-v2 settings-shell relative flex w-full overflow-hidden bg-[var(--sv2-bg)] outline-none ${
        variant === "modal"
          ? "h-full md:h-[min(700px,90vh)] md:w-[min(1100px,94vw)] md:rounded-[12px] md:border md:border-[var(--sv2-border)] md:shadow-2xl"
          : "h-[100dvh]"
      }`}>
      <aside className="hidden w-[208px] shrink-0 border-r border-[var(--sv2-border)] bg-[var(--sv2-surface)] md:flex">
        {sidebar}
      </aside>

      {mobileNavOpen && (
        <div className="absolute inset-0 z-30 flex md:hidden">
          <button
            type="button"
            aria-label="关闭设置导航"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 h-full w-[min(280px,85vw)] border-r border-[var(--sv2-border)] bg-[var(--sv2-surface)] shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {variant === "page" && (
          <Link
            href="/"
            className="absolute top-2 right-2 inline-flex items-center rounded-md border border-(--sv2-border) px-3 py-1.5 text-sm text-[var(--text-color-secondary)] transition-colors hover:text-[var(--text-color)]">
            返回播放页
          </Link>
        )}
        {variant === "modal" && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="settings-toolbar-button absolute top-2 right-2 flex items-center justify-center rounded-md text-(--text-color-secondary) transition-colors hover:bg-[var(--sv2-surface-2)] hover:text-[var(--text-color)]">
            <Icon icon={materialIconMap.X} width={16} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="settings-content-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-12 md:px-7 md:pb-7">
          <div className="mx-auto w-full max-w-170 space-y-4">
            {section === "account" && <SettingsCurrentAccount />}

            {section === "users" && (
              <AccountSettings
                showSession={false}
                title="用户管理"
                description="管理成员、注册准入与角色权限。"
              />
            )}

            {section === "playback" && (
              <PlayerSettings
                fullscreenType={settings.fullscreenType}
                onFullscreenTypeChange={settings.handleFullscreenTypeChange}
                seekStepSeconds={settings.seekStepSeconds}
                onSeekStepSecondsChange={settings.handleSeekStepSecondsChange}
                videoTogetherEnabled={settings.videoTogetherEnabled}
                onVideoTogetherEnabledChange={
                  settings.handleVideoTogetherEnabledChange
                }
                danmakuOpacity={settings.danmakuOpacity}
                onDanmakuOpacityChange={settings.handleDanmakuOpacityChange}
                danmakuFontSize={settings.danmakuFontSize}
                onDanmakuFontSizeChange={settings.handleDanmakuFontSizeChange}
                danmakuDisplayArea={settings.danmakuDisplayArea}
                onDanmakuDisplayAreaChange={
                  settings.handleDanmakuDisplayAreaChange
                }
                danmakuApiManager={
                  <UserDanmakuSettings
                    systemApiUrl={settings.danmakuApiUrl}
                    onSystemApiUrlChange={settings.handleDanmakuApiUrlChange}
                    showSystemApi={canUseDanmakuApi}
                  />
                }
              />
            )}

            {section === "display" && (
              <DisplaySettings
                realtimeLatency={settings.realtimeLatency}
                searchDisplayMode={settings.searchDisplayMode}
                rememberScrollPosition={settings.rememberScrollPosition}
                onRealtimeLatencyChange={settings.handleRealtimeLatencyChange}
                onSearchDisplayModeChange={
                  settings.handleSearchDisplayModeChange
                }
                onRememberScrollPositionChange={
                  settings.handleRememberScrollPositionChange
                }
                locale={settings.locale}
                onLocaleChange={settings.handleLocaleChange}
                blockedCategories={settings.blockedCategories}
                onBlockedCategoriesChange={
                  settings.handleBlockedCategoriesChange
                }
                sortBy={settings.sortBy}
                onSortChange={settings.handleSortChange}
              />
            )}

            {section === "public-sources" && (
              <PublicSourcesPanel settings={settings} />
            )}

            {section === "personal-sources" && <UserSourceSettings />}

            {section === "subscriptions" && (
              <SubscriptionImportTab
                subscriptions={settings.subscriptions}
                onAdd={settings.handleAddSubscription}
                onRemove={settings.handleRemoveSubscription}
                onRefresh={settings.handleRefreshSubscription}
              />
            )}

            {section === "privacy" && (
              <DataSettings
                onExport={() => settings.setIsExportModalOpen(true)}
                onImport={() => settings.setIsImportModalOpen(true)}
                onReset={() => settings.setIsResetDialogOpen(true)}
              />
            )}

            {section === "about" && <AppVersionSettings />}
          </div>
        </div>
      </div>

      <AddSourceModal
        isOpen={settings.isAddModalOpen}
        onClose={() => {
          settings.setIsAddModalOpen(false);
          settings.setEditingSource(null);
        }}
        onAdd={settings.handleAddSource}
        existingIds={settings.sources.map((source) => source.id)}
        initialValues={settings.editingSource}
      />

      <AddSourceModal
        isOpen={settings.isPremiumAddModalOpen}
        onClose={() => {
          settings.setIsPremiumAddModalOpen(false);
          settings.setEditingPremiumSource(null);
        }}
        onAdd={settings.handleAddPremiumSource}
        existingIds={settings.premiumSources.map((source) => source.id)}
        initialValues={settings.editingPremiumSource}
      />

      <ExportModal
        isOpen={settings.isExportModalOpen}
        onClose={() => settings.setIsExportModalOpen(false)}
        onExport={settings.handleExport}
      />

      <ImportModal
        isOpen={settings.isImportModalOpen}
        onClose={() => settings.setIsImportModalOpen(false)}
        onImportFile={settings.handleImportFile}
        onImportLink={settings.handleImportLink}
        subscriptions={settings.subscriptions}
        onAddSubscription={settings.handleAddSubscription}
        onRemoveSubscription={settings.handleRemoveSubscription}
        onRefreshSubscription={settings.handleRefreshSubscription}
      />

      <ConfirmDialog
        isOpen={settings.isRestoreDefaultsDialogOpen}
        title="恢复默认源"
        message="这将重置所有视频源为默认配置。自定义源将被删除。是否继续？"
        confirmText="恢复"
        cancelText="取消"
        variant="danger"
        dangerous
        onConfirm={settings.handleRestoreDefaults}
        onCancel={() => settings.setIsRestoreDefaultsDialogOpen(false)}
      />

      <ConfirmDialog
        isOpen={settings.isPremiumRestoreDialogOpen}
        title="恢复默认高级源"
        message="这将重置所有高级源为默认配置。自定义源将被删除。是否继续？"
        confirmText="恢复"
        cancelText="取消"
        variant="danger"
        dangerous
        onConfirm={settings.handleRestorePremiumDefaults}
        onCancel={() => settings.setIsPremiumRestoreDialogOpen(false)}
      />

      <ConfirmDialog
        isOpen={settings.isResetDialogOpen}
        title="清除所有数据"
        message="这将删除所有设置、历史记录、Cookie 和缓存。此操作不可撤销。是否继续？"
        confirmText="清除"
        cancelText="取消"
        onConfirm={settings.handleResetAll}
        onCancel={() => settings.setIsResetDialogOpen(false)}
        dangerous
      />
    </div>
  );
}

function PublicSourcesPanel({
  settings,
}: {
  settings: ReturnType<typeof useSettingsPage>;
}) {
  const [tab, setTab] = useState<"normal" | "premium">("normal");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-1 border-b border-(--sv2-border)">
        <button
          type="button"
          onClick={() => setTab("normal")}
          aria-pressed={tab === "normal"}
          className={`-mb-px inline-flex cursor-pointer items-center rounded-t-[6px] border-b-2 px-3 pb-2 pt-1.5 text-sm transition-colors ${
            tab === "normal"
              ? "border-(--accent-color) font-medium text-(--text-color)"
              : "border-transparent text-(--text-color-secondary) hover:text-(--text-color)"
          }`}>
          普通源
        </button>
        <button
          type="button"
          onClick={() => setTab("premium")}
          aria-pressed={tab === "premium"}
          className={`-mb-px inline-flex cursor-pointer items-center rounded-t-[6px] border-b-2 px-3 pb-2 pt-1.5 text-sm transition-colors ${
            tab === "premium"
              ? "border-(--accent-color) font-medium text-(--text-color)"
              : "border-transparent text-(--text-color-secondary) hover:text-(--text-color)"
          }`}>
          高级源
        </button>
      </div>

      <div className="pt-4">

      {tab === "normal" ? (
        <SourceSettings
          sources={settings.sources}
          onSourcesChange={settings.handleSourcesChange}
          onRestoreDefaults={() =>
            settings.setIsRestoreDefaultsDialogOpen(true)
          }
          onAddSource={() => {
            settings.setEditingSource(null);
            settings.setIsAddModalOpen(true);
          }}
          onEditSource={settings.handleEditSource}
        />
      ) : (
        <PremiumSourceSettings
          sources={settings.premiumSources}
          onSourcesChange={settings.handlePremiumSourcesChange}
          onRestoreDefaults={() => settings.setIsPremiumRestoreDialogOpen(true)}
          onAddSource={() => {
            settings.setEditingPremiumSource(null);
            settings.setIsPremiumAddModalOpen(true);
          }}
          onEditSource={settings.handleEditPremiumSource}
        />
      )}
      </div>
    </div>
  );
}
