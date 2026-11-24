'use client';

import { createIcon } from './base';
import { materialIconMap } from './icon-map';

export const NavigationIcons = {
  Search: createIcon(materialIconMap.Search),
  ChevronLeft: createIcon(materialIconMap.ChevronLeft),
  ChevronRight: createIcon(materialIconMap.ChevronRight),
  ChevronDown: createIcon(materialIconMap.ChevronDown),
  ChevronUp: createIcon(materialIconMap.ChevronUp),
  List: createIcon(materialIconMap.List),
  ArrowUpDown: createIcon(materialIconMap.ArrowUpDown),
  Layers: createIcon(materialIconMap.Layers),
};
