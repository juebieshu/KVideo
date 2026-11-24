'use client';

import { createIcon } from './base';
import { materialIconMap } from './icon-map';

export const MediaIcons = {
  Film: createIcon(materialIconMap.Film),
  Play: createIcon(materialIconMap.Play),
  Pause: createIcon(materialIconMap.Pause),
  TV: createIcon(materialIconMap.TV),
  Volume2: createIcon(materialIconMap.Volume2),
  Volume1: createIcon(materialIconMap.Volume1),
  VolumeX: createIcon(materialIconMap.VolumeX),
  Maximize: createIcon(materialIconMap.Maximize),
  Minimize: createIcon(materialIconMap.Minimize),
  WebFullscreen: createIcon(materialIconMap.WebFullscreen),
  WebFullscreenExit: createIcon(materialIconMap.WebFullscreenExit),
  SkipForward: createIcon(materialIconMap.SkipForward),
  FastForward: createIcon(materialIconMap.FastForward),
  Rewind: createIcon(materialIconMap.Rewind),
  SkipBack: createIcon(materialIconMap.SkipBack),
  PictureInPicture: createIcon(materialIconMap.PictureInPicture),
  Airplay: createIcon(materialIconMap.Airplay),
  Cast: createIcon(materialIconMap.Cast),
};
