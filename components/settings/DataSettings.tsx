import { Button } from "@/components/ui/Button";

interface DataSettingsProps {
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
}

export function DataSettings({ onExport, onImport, onReset }: DataSettingsProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-4 border-b border-(--sv2-border) pb-3">
        <h2 className="text-[18px] font-semibold text-(--text-color)">隐私与数据</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-(--text-color-secondary)">
          备份或恢复设置，以及清除数据。
        </p>
      </header>

      <section aria-label="数据操作">
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="text-[14px] leading-5 font-medium text-(--text-color)">
              导出设置
            </p>
            <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
              将设置与选定的历史记录保存为文件
            </p>
          </div>
          <Button type="button" variant="normal" color="neutral" onClick={onExport} className="shrink-0">
            导出设置
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-(--sv2-border) py-4">
          <div className="min-w-0">
            <p className="text-[14px] leading-5 font-medium text-(--text-color)">
              导入设置
            </p>
            <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
              从文件或链接恢复设置
            </p>
          </div>
          <Button type="button" variant="normal" color="neutral" onClick={onImport} className="shrink-0">
            导入设置
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="text-[14px] leading-5 font-medium text-(--text-color)">
              清除所有数据
            </p>
            <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
              删除本地设置、历史记录和缓存
            </p>
          </div>
          <Button type="button" variant="normal" color="danger" onClick={onReset} className="shrink-0">
            清除所有数据
          </Button>
        </div>
      </section>
    </div>
  );
}
