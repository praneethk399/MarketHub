'use client'

import { AshenPress } from '@/components/shaders/ashen-press/AshenPress'

export function AshenPressSection() {
  return <section className="shader-section" aria-label="Ashen Press — the art book shelf">
    <div className="shader-label-row">
      <p className="section-kicker"><span />THE ASHEN PRESS · TEN CLOTHBOUND VOLUMES</p>
      <p className="landing-hint">Hover to lift · Click to select · Drag to pull a volume.</p>
    </div>
    <div className="shader-frame">
      <AshenPress />
    </div>
  </section>
}
