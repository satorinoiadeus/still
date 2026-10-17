import { SidebarContent } from '@/desktop/components/sidebar/SidebarContent';
import { desktopStyles } from '@/desktop/theme/main';
import { useConfig } from '@/hooks/useConfig';
import { mainSidebarWidthConfigKey } from '@/services/config/config';
import { Allotment, LayoutPriority } from 'allotment';
import classNames from 'classnames';
import React, { useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { Outlet } from 'react-router';
import { SettingsSidebarContent } from '../SettingsSidebarContent/SettingsSidebarContent';
import { calculateElementWidth } from '../../overlay/datePicker/constant';

interface SidebarLayoutOptions {
  setting: boolean;
}

export const SidebarLayout: React.FC<SidebarLayoutOptions> = ({ setting }) => {
  const mainSidebarConfig = useConfig(mainSidebarWidthConfigKey());
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(mainSidebarConfig.value[0] === 0);

  return (
    <div className={desktopStyles.SidebarLayoutContainer}>
      <button className="still-sidebar-toggle" type="button" aria-label="Toggle sidebar" title="Toggle sidebar" aria-expanded={!isSidebarCollapsed}
        onClick={() => setSidebarCollapsed(value => !value)}><PanelLeft size={18} /></button>
      <Allotment
        onVisibleChange={(index, visible) => { if (index === 0) setSidebarCollapsed(!visible); }}
        defaultSizes={mainSidebarConfig.value}
        onChange={mainSidebarConfig.saveIfValid}
        proportionalLayout={false}
      >
        <Allotment.Pane
          visible={!isSidebarCollapsed}
          minSize={calculateElementWidth(desktopStyles.SidebarMinWidth)}
          maxSize={calculateElementWidth(desktopStyles.SidebarMaxWidth)}
          snap
          preferredSize={calculateElementWidth(desktopStyles.SidebarPreferredWidth)}
        >
          {setting ? <SettingsSidebarContent /> : <SidebarContent />}
        </Allotment.Pane>
        <Allotment.Pane
          priority={LayoutPriority.High}
          className={classNames(desktopStyles.SidebarLayoutPaneWrapper, {
            [desktopStyles.SidebarLayoutContentCollapsedPadding]: isSidebarCollapsed,
          })}
        >
          <div className={desktopStyles.SidebarLayoutContent}>
            <Outlet />
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};
