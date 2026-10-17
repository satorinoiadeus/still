import React, { useState } from 'react';
import { readAppearance, saveAppearance, densityOptions, accentOptions, StillAppearance } from './appearance';
export const AppearanceControls = () => {
  const [value, setValue] = useState(readAppearance);
  const change = (patch: Partial<StillAppearance>) => {
    const next = { ...value, ...patch }; saveAppearance(next); setValue(next);
  };
  return <section className="still-appearance" aria-label="Still appearance">
    <h2>Make room for your way of working.</h2>
    <p>Choose a little more space, or keep things close.</p>
    <fieldset><legend>Task spacing</legend><div>{densityOptions.map(density =>
      <button type="button" key={density} aria-pressed={value.density === density} onClick={() => change({ density })}>{density === 'comfortable' ? 'Comfortable' : 'Compact'}</button>
    )}</div></fieldset>
    <fieldset><legend>Accent color</legend><div>{accentOptions.map(accent =>
      <button type="button" key={accent} aria-pressed={value.accent === accent} onClick={() => change({ accent })}>{accent[0].toUpperCase() + accent.slice(1)}</button>
    )}</div></fieldset>
    <p>Still is built on HamsterBase Tasks. <a href="https://github.com/satorinoiadeus/still" target="_blank" rel="noreferrer">Source · AGPL-3.0</a></p>
  </section>;
};
