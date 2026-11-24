'use client';
import { materialIconMap } from '@/components/ui/icons/icon-map';

import { MIcon as Icon } from '@/components/ui/Icon';
import type { SettingsSectionId } from '@/lib/store/settings-ui-store';
import './icons';

interface SidebarItem {
  id: SettingsSectionId;
  label: string;
  icon: string;
  visible?: boolean;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface SettingsSidebarProps {
  section: SettingsSectionId;
  onSelect: (section: SettingsSectionId) => void;
  canManageUsers: boolean;
  canUsePlayerSettings: boolean;
  canManageSources: boolean;
  canManageData: boolean;
}

function getGroups(props: SettingsSidebarProps): SidebarGroup[] {
  const groups: SidebarGroup[] = [
    {
      label: '账户',
      items: [
        { id: 'account', label: '个人账户', icon: materialIconMap.User },
        { id: 'users', label: '用户管理', icon: materialIconMap.Users, visible: props.canManageUsers },
      ],
    },
    {
      label: '偏好',
      items: [
        { id: 'playback', label: '播放设置', icon: materialIconMap.PlayCircle, visible: props.canUsePlayerSettings },
        { id: 'display', label: '显示与搜索', icon: materialIconMap.Sliders },
      ],
    },
    {
      label: '内容源',
      items: [
        { id: 'public-sources', label: '公共视频源', icon: materialIconMap.Database, visible: props.canManageSources },
        { id: 'personal-sources', label: '个人视频源', icon: materialIconMap.UserPlus },
        { id: 'subscriptions', label: '订阅源', icon: materialIconMap.Rss, visible: props.canManageSources },
      ],
    },
    {
      label: '系统',
      items: [
        { id: 'privacy', label: '隐私与数据', icon: materialIconMap.Shield, visible: props.canManageData },
        { id: 'about', label: '关于', icon: materialIconMap.Info },
      ],
    },
  ];

  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible !== false) }))
    .filter((group) => group.items.length > 0);
}

export function SettingsSidebar(props: SettingsSidebarProps) {
  const groups = getGroups(props);

  return (
    <div className="flex h-full w-full flex-col">
      <nav aria-label="设置导航" className="settings-sidebar-scroll flex-1 overflow-y-auto px-3 pb-4 pt-6">
        {groups.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex > 0 ? 'mt-5' : ''}>
            <p className="px-2 pb-1.5 text-[11px] font-medium text-(--kv-color-text-tertiary)">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = props.section === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => props.onSelect(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`settings-nav-item relative flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? 'bg-(--sv2-accent-soft) font-medium text-(--accent-color)'
                        : 'text-(--text-color-secondary) hover:bg-(--sv2-surface-2) hover:text-(--text-color)'
                    }`}
                  >
                    <Icon icon={item.icon} width={15} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
