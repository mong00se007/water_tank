import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// Version 22.0 - Stable IDs, solid fill water
console.info("%c WATER-TANK-CARD %c v22.0.0 ", "color: white; background: #0ea5e9; font-weight: 700;", "color: #0ea5e9; background: white; font-weight: 700;");

class WaterTankCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
    };
  }

  static getStubConfig() {
    return {
      entity: "sensor.water_tank_volume",
      temp_entity: "sensor.water_tank_temperature",
      rain_entity: "sensor.rain_total_today",
      inflow_entity: "sensor.rain_rate",
      outflow_entity: "binary_sensor.water_usage",
      roof_size: 100,
      us_units: false,
      warning_threshold: 20,
      low_level_threshold: 10,
      name: "Water Tank",
    };
  }

  static async getConfigElement() {
    await import("./water-tank-card-editor.js");
    return document.createElement("water-tank-card-editor");
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define a volume entity");
    }
    this.config = config;
    // Stable unique ID for SVG defs — computed once, never changes between renders
    this._uid = 'wtc-' + config.entity.replace(/[^a-z0-9]/gi, '').substr(0, 10);
  }

  render() {
    if (!this.hass || !this.config) {
      return html``;
    }

    const stateObj = this.hass.states[this.config.entity];
    const tempObj = this.hass.states[this.config.temp_entity];
    const rainTotalObj = this.hass.states[this.config.rain_entity];
    const inflowRateObj = this.hass.states[this.config.inflow_entity];
    const outflowObj = this.hass.states[this.config.outflow_entity];

    // --- OUTFLOW LOGIC ---
    let isOutflow = false;
    if (outflowObj) {
      const s = String(outflowObj.state).toLowerCase().trim();
      if (s === "on" || s === "true" || s === "active" || s === "open" || parseFloat(s) > 0) {
        isOutflow = true;
      }
      console.debug(`[water-tank-card] outflow "${this.config.outflow_entity}" = "${outflowObj.state}" → ${isOutflow}`);
    } else if (this.config.outflow_entity) {
      console.debug(`[water-tank-card] outflow entity "${this.config.outflow_entity}" NOT FOUND`);
    }

    // --- VOLUME ---
    let percentage = 0;
    if (stateObj && !isNaN(parseFloat(stateObj.state))) {
      let volumeRaw = parseFloat(stateObj.state);
      percentage = volumeRaw;
      if (stateObj.attributes.unit_of_measurement !== "%" && this.config.max_volume) {
        percentage = (volumeRaw / this.config.max_volume) * 100;
      }
      percentage = Math.min(100, Math.max(0, percentage));
    }

    const isUS = this.config.us_units;

    // --- TEMP ---
    let tempC = null;
    let displayTemp = null;
    let displayTempUnit = isUS ? "°F" : "°C";
    if (tempObj && tempObj.state !== "unavailable" && tempObj.state !== "unknown") {
      const rawTemp = parseFloat(tempObj.state);
      if (!isNaN(rawTemp)) {
        const inputUnit = tempObj.attributes.unit_of_measurement || "°C";
        if (inputUnit === "°F") {
          tempC = (rawTemp - 32) * 5 / 9;
          displayTemp = isUS ? rawTemp : tempC;
        } else {
          tempC = rawTemp;
          displayTemp = isUS ? (rawTemp * 9 / 5) + 32 : rawTemp;
        }
      }
    }

    // --- INFLOW ---
    let inflowRate = 0;
    if (inflowRateObj && !isNaN(parseFloat(inflowRateObj.state))) {
      inflowRate = parseFloat(inflowRateObj.state);
    }

    // --- RAIN TOTAL ---
    const rainTotalRaw = (rainTotalObj && !isNaN(parseFloat(rainTotalObj.state))) ? parseFloat(rainTotalObj.state) : 0;
    const roofSize = this.config.roof_size || 100;
    let displayRainTotal = isUS ? (rainTotalRaw * roofSize * 0.264172) : (rainTotalRaw * roofSize);
    let displayRainUnit = isUS ? "gal" : "L";

    // --- THRESHOLDS ---
    const tempThreshold = this.config.warning_threshold || 20;
    const lowLevelThreshold = this.config.low_level_threshold ?? 10;
    const isTempWarning = tempC !== null && tempC > tempThreshold;
    const isLowWarning = percentage <= lowLevelThreshold;

    // --- WATER COLORS (solid, no gradients needed) ---
    let wTop = "#22d3ee";
    let wMid = "#0284c7";
    let wBot = "#0c4a6e";
    if (tempC !== null) {
      if (isTempWarning) {
        wTop = "#fb923c"; wMid = "#ea580c"; wBot = "#7c2d12";
      } else {
        const r = Math.max(0, Math.min(1, tempC / tempThreshold));
        wTop = `rgb(${Math.round(34+217*r)},${Math.round(211-65*r)},${Math.round(238-178*r)})`;
        wMid = `rgb(${Math.round(2+232*r)},${Math.round(132-44*r)},${Math.round(199-187*r)})`;
        wBot = `rgb(${Math.round(12+112*r)},${Math.round(74-29*r)},${Math.round(110-92*r)})`;
      }
    }

    const wp = percentage;
    const u = this._uid; // stable ID

    /* ============ CYLINDER GEOMETRY ============ */
    const cx = 100;
    const rx = 46;
    const ry = 13;
    const topY = 38;
    const botY = 155;
    const bodyH = botY - topY;

    const waterSurfY = botY - (bodyH * wp / 100);
    const waterH = botY - waterSurfY;

    // Inflow pipe: center top
    const pipeInEndX = cx;
    const pipeInY = topY - 20;

    // Outflow pipe: right side near bottom, short
    const pipeOutStartY = botY - 15;
    const pipeOutEndX = cx + rx + 32;
    const pipeOutBendY = botY + 20;

    // Helper: cylinder water body path (from surfY down to botY with bottom ellipse arc)
    const waterPath = (surfY, inset) => {
      const left = cx - rx + inset;
      const right = cx + rx - inset;
      const arcRx = rx - inset;
      const arcRy = ry - 1;
      return `M${left} ${surfY} L${left} ${botY} A${arcRx} ${arcRy} 0 0 0 ${right} ${botY} L${right} ${surfY} Z`;
    };

    return html`
      <ha-card>
        <div class="card-content">
          <div class="header">
            <svg class="header-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z"/>
            </svg>
            <span>${this.config.name || "Water Tank"}</span>
          </div>
          
          <div class="tank-container">
            <svg class="tank-svg" viewBox="0 0 200 200" style="overflow: visible;">
              <defs>
                <!-- Pipe gradient (stable ID, works fine) -->
                <linearGradient id="pg-${u}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#78909c"/>
                  <stop offset="30%" stop-color="#eceff1"/>
                  <stop offset="70%" stop-color="#90a4ae"/>
                  <stop offset="100%" stop-color="#546e7a"/>
                </linearGradient>
                <!-- Cylinder shading -->
                <linearGradient id="cy-${u}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="var(--primary-text-color)" stop-opacity="0.12"/>
                  <stop offset="15%" stop-color="var(--primary-text-color)" stop-opacity="0.04"/>
                  <stop offset="50%" stop-color="var(--primary-text-color)" stop-opacity="0.02"/>
                  <stop offset="85%" stop-color="var(--primary-text-color)" stop-opacity="0.04"/>
                  <stop offset="100%" stop-color="var(--primary-text-color)" stop-opacity="0.14"/>
                </linearGradient>
                <!-- Shadow -->
                <filter id="sh-${u}" x="-15%" y="-10%" width="130%" height="130%">
                  <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.2)"/>
                </filter>
              </defs>

              <!-- ====== INFLOW PIPE (center top) ====== -->
              <rect x="8" y="${pipeInY - 5}" width="${pipeInEndX - 8}" height="10" rx="2" fill="url(#pg-${u})"/>
              <rect x="${pipeInEndX - 5}" y="${pipeInY}" width="10" height="${topY - pipeInY + ry + 2}" rx="2" fill="url(#pg-${u})"/>
              <circle cx="${pipeInEndX}" cy="${pipeInY}" r="7" fill="url(#pg-${u})" stroke="#546e7a" stroke-width="0.8"/>
              <circle cx="${pipeInEndX}" cy="${pipeInY}" r="3" fill="#b0bec5"/>
              <rect x="5" y="${pipeInY - 7}" width="6" height="14" rx="2" fill="#546e7a"/>

              <!-- ====== OUTFLOW PIPE (right, short) ====== -->
              <rect x="${cx + rx - 3}" y="${pipeOutStartY - 5}" width="${pipeOutEndX - cx - rx + 6}" height="10" rx="2" fill="url(#pg-${u})"/>
              <rect x="${pipeOutEndX - 5}" y="${pipeOutStartY}" width="10" height="${pipeOutBendY - pipeOutStartY}" rx="2" fill="url(#pg-${u})"/>
              <circle cx="${pipeOutEndX}" cy="${pipeOutStartY}" r="7" fill="url(#pg-${u})" stroke="#546e7a" stroke-width="0.8"/>
              <circle cx="${pipeOutEndX}" cy="${pipeOutStartY}" r="3" fill="#b0bec5"/>
              <path d="M${pipeOutEndX - 6} ${pipeOutBendY} L${pipeOutEndX - 3} ${pipeOutBendY + 5} L${pipeOutEndX + 3} ${pipeOutBendY + 5} L${pipeOutEndX + 6} ${pipeOutBendY} Z" fill="#546e7a"/>

              <!-- ====== OUTFLOW WATER ====== -->
              ${isOutflow ? html`
              <rect x="${cx + rx}" y="${pipeOutStartY - 2}" width="${pipeOutEndX - cx - rx}" height="4" fill="${wMid}" opacity="0.85"/>
              <line class="outflow-dash-h" x1="${cx + rx}" y1="${pipeOutStartY}" x2="${pipeOutEndX}" y2="${pipeOutStartY}" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="4 6" stroke-linecap="round"/>
              <rect x="${pipeOutEndX - 2}" y="${pipeOutStartY}" width="4" height="${pipeOutBendY - pipeOutStartY + 3}" fill="${wMid}" opacity="0.85"/>
              <line class="outflow-dash-v" x1="${pipeOutEndX}" y1="${pipeOutStartY}" x2="${pipeOutEndX}" y2="${pipeOutBendY + 3}" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="4 6" stroke-linecap="round"/>
              <circle class="drip d1" cx="${pipeOutEndX}" cy="${pipeOutBendY + 9}" r="2.5" fill="${wTop}" opacity="0.8"/>
              <circle class="drip d2" cx="${pipeOutEndX}" cy="${pipeOutBendY + 18}" r="2" fill="${wMid}" opacity="0.6"/>
              <circle class="drip d3" cx="${pipeOutEndX}" cy="${pipeOutBendY + 26}" r="1.5" fill="${wMid}" opacity="0.4"/>
              ` : ""}

              <!-- ====== 3D CYLINDER TANK ====== -->
              <g filter="url(#sh-${u})">
                <!-- Back rim -->
                <path d="M${cx - rx} ${topY} A${rx} ${ry} 0 0 1 ${cx + rx} ${topY}" fill="var(--primary-text-color)" fill-opacity="0.06" stroke="var(--primary-text-color)" stroke-width="1.5" stroke-opacity="0.4"/>
                <!-- Body -->
                <rect x="${cx - rx}" y="${topY}" width="${rx * 2}" height="${bodyH}" fill="url(#cy-${u})"/>
                <rect x="${cx - rx}" y="${topY}" width="5" height="${bodyH}" fill="white" fill-opacity="0.05"/>

                <!-- ====== WATER FILL (solid colors, NO url() gradients) ====== -->
                ${wp > 0 ? html`
                <!-- Layer 1: Deep bottom color (full water height) -->
                <path d="${waterPath(waterSurfY, 2)}" fill="${wBot}"/>

                <!-- Layer 2: Mid color (upper 75% of water) -->
                ${waterH > 8 ? html`
                <path d="${waterPath(waterSurfY, 2)}" fill="${wMid}" opacity="0.6"/>
                ` : ""}

                <!-- Layer 3: Light top band (upper 35% of water) -->
                ${waterH > 15 ? html`
                <rect x="${cx - rx + 3}" y="${waterSurfY}" width="${(rx - 3) * 2}" height="${Math.min(waterH * 0.35, 30)}" fill="${wTop}" opacity="0.35" rx="2"/>
                ` : ""}

                <!-- Specular highlight (left side shine) -->
                <rect x="${cx - rx + 2}" y="${waterSurfY}" width="12" height="${waterH}" fill="white" opacity="0.08" rx="1"/>

                <!-- Caustic light patches -->
                ${waterH > 25 ? html`
                <ellipse cx="${cx - 8}" cy="${waterSurfY + waterH * 0.4}" rx="14" ry="7" fill="white" opacity="0.05"/>
                <ellipse cx="${cx + 15}" cy="${waterSurfY + waterH * 0.65}" rx="10" ry="5" fill="white" opacity="0.04"/>
                ` : ""}
                ` : ""}

                <!-- Walls -->
                <line x1="${cx - rx}" y1="${topY}" x2="${cx - rx}" y2="${botY}" stroke="var(--primary-text-color)" stroke-width="1.8" stroke-opacity="0.45"/>
                <line x1="${cx + rx}" y1="${topY}" x2="${cx + rx}" y2="${botY}" stroke="var(--primary-text-color)" stroke-width="1.8" stroke-opacity="0.45"/>

                <!-- Bottom ellipse -->
                <path d="M${cx - rx} ${botY} A${rx} ${ry} 0 0 0 ${cx + rx} ${botY}" fill="var(--primary-text-color)" fill-opacity="0.08" stroke="var(--primary-text-color)" stroke-width="1.5" stroke-opacity="0.4"/>

                <!-- Water surface ellipse -->
                ${wp > 1 ? html`
                <ellipse class="water-surface" cx="${cx}" cy="${waterSurfY}" rx="${rx - 2}" ry="${ry - 1}" fill="${wTop}" fill-opacity="0.7" stroke="${wTop}" stroke-width="1" stroke-opacity="0.5"/>
                <ellipse cx="${cx - 5}" cy="${waterSurfY - 1}" rx="${rx * 0.4}" ry="${ry * 0.25}" fill="white" opacity="0.18"/>
                ` : ""}

                <!-- Bottom water arc -->
                ${wp > 0 ? html`
                <path d="M${cx - rx + 2} ${botY} A${rx - 2} ${ry - 1} 0 0 0 ${cx + rx - 2} ${botY}" fill="${wBot}" opacity="0.6"/>
                ` : ""}

                <!-- Front rim -->
                <path d="M${cx - rx} ${topY} A${rx} ${ry} 0 0 0 ${cx + rx} ${topY}" fill="none" stroke="var(--primary-text-color)" stroke-width="1.8" stroke-opacity="0.5"/>
                <path d="M${cx - rx + 12} ${topY + ry * 0.55} A${rx - 12} ${ry * 0.35} 0 0 0 ${cx + rx - 12} ${topY + ry * 0.55}" fill="none" stroke="white" stroke-width="0.8" stroke-opacity="0.15"/>

                <!-- Bubbles -->
                ${wp > 8 ? html`
                <circle class="bubble b1" cx="${cx - 16}" cy="${botY - 15}" r="2" fill="white" opacity="0.3"/>
                <circle class="bubble b2" cx="${cx + 12}" cy="${botY - 10}" r="1.5" fill="white" opacity="0.25"/>
                <circle class="bubble b3" cx="${cx + 24}" cy="${botY - 22}" r="2.2" fill="white" opacity="0.2"/>
                <circle class="bubble b4" cx="${cx - 6}" cy="${botY - 8}" r="1.8" fill="white" opacity="0.28"/>
                ` : ""}
              </g>

              <!-- ====== INFLOW STREAM ====== -->
              ${inflowRate > 0 ? html`
              <line class="flow-stream" x1="${pipeInEndX}" y1="${topY + ry + 2}" x2="${pipeInEndX}" y2="${Math.min(waterSurfY - 2, botY - 5)}" stroke="${wTop}" stroke-width="5" stroke-linecap="round" stroke-dasharray="6 8" opacity="0.85"/>
              <circle class="splash s1" cx="${pipeInEndX - 8}" cy="${waterSurfY}" r="2" fill="${wTop}" opacity="0.6"/>
              <circle class="splash s2" cx="${pipeInEndX + 7}" cy="${waterSurfY - 2}" r="1.8" fill="${wTop}" opacity="0.5"/>
              <circle class="splash s3" cx="${pipeInEndX + 10}" cy="${waterSurfY - 1}" r="1.5" fill="${wTop}" opacity="0.5"/>
              ` : ""}

              <!-- Level markers -->
              ${[25, 50, 75].map(lvl => {
                const mY = botY - (bodyH * lvl / 100);
                return html`<line x1="${cx - rx + 3}" y1="${mY}" x2="${cx - rx + 11}" y2="${mY}" stroke="var(--primary-text-color)" stroke-width="0.5" stroke-opacity="0.25"/>`;
              })}
            </svg>

            <!-- Text overlay -->
            <div class="tank-overlay">
              <div class="percentage ${isLowWarning ? 'low' : ''}">${percentage.toFixed(0)}<span class="pct">%</span></div>
              ${displayTemp !== null ? html`
                <div class="temperature ${isTempWarning ? 'warn' : ''}">${displayTemp.toFixed(1)}${displayTempUnit}</div>
              ` : ""}
            </div>

            ${isTempWarning ? html`
              <div class="warning-icon temp-warning">
                <svg viewBox="0 0 40 40" width="30" height="30">
                  <path d="M20 5 L5 35 L35 35 Z" fill="#ef4444" stroke="white" stroke-width="2"/>
                  <text x="20" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="white">!</text>
                </svg>
              </div>
            ` : ""}
            ${isLowWarning ? html`
              <div class="warning-icon low-warning">
                <svg viewBox="0 0 40 40" width="30" height="30">
                  <path d="M20 8 Q 30 20 30 26 A 10 10 0 1 1 10 26 Q 10 20 20 8 Z" fill="#3b82f6" stroke="white" stroke-width="1.5"/>
                  <line x1="8" y1="35" x2="32" y2="10" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round"/>
                </svg>
              </div>
            ` : ""}
          </div>

          <div class="info-bar">
            <div class="stat">
              <div class="stat-icon">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z"/></svg>
              </div>
              <div class="stat-data">
                <span class="label">Today's Inflow</span>
                <span class="value">${displayRainTotal.toFixed(1)} ${displayRainUnit}</span>
              </div>
            </div>
            ${inflowRate > 0 ? html`
            <div class="stat">
              <div class="stat-icon active">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z"/></svg>
              </div>
              <div class="stat-data">
                <span class="label">Rain Rate</span>
                <span class="value">${inflowRate.toFixed(1)} mm/h</span>
              </div>
            </div>
            ` : ""}
          </div>
        </div>
      </ha-card>
    `;
  }

  static getConfigurationElement() {
    return document.createElement("water-tank-card-editor");
  }

  static get styles() {
    return css`
      ha-card {
        padding: 16px;
        background: var(--ha-card-background, var(--card-background-color, rgba(255,255,255,0.05)));
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
      }
      .card-content { display: flex; flex-direction: column; align-items: center; }
      .header {
        display: flex; align-items: center; gap: 8px;
        font-size: 1.15em; font-weight: 600; letter-spacing: 0.02em;
        color: var(--primary-text-color); margin-bottom: 4px;
      }
      .header-icon { color: var(--primary-color, #0ea5e9); flex-shrink: 0; }
      .tank-container {
        position: relative; width: 240px; height: 210px;
        margin-top: 8px; display: flex; justify-content: center;
      }
      .tank-svg { width: 100%; height: 100%; }

      .water-surface { animation: wobble 3s ease-in-out infinite alternate; transform-origin: center; }
      @keyframes wobble { 0%,100% { transform: scaleX(0.97); } 50% { transform: scaleX(1.02); } }

      .bubble { animation: rise 4s ease-in infinite; }
      .bubble.b2 { animation-delay: 1s; animation-duration: 3.5s; }
      .bubble.b3 { animation-delay: 2.2s; animation-duration: 5s; }
      .bubble.b4 { animation-delay: 0.5s; animation-duration: 3s; }
      @keyframes rise { 0% { transform: translateY(0); opacity: 0.3; } 50% { opacity: 0.15; } 100% { transform: translateY(-70px); opacity: 0; } }

      .flow-stream { animation: flowDash 0.7s linear infinite; }
      @keyframes flowDash { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -14; } }

      .outflow-dash-h, .outflow-dash-v { animation: outDash 0.5s linear infinite; }
      @keyframes outDash { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -10; } }

      .splash { animation: splashOut 1.2s ease-out infinite; }
      .splash.s2 { animation-delay: 0.3s; }
      .splash.s3 { animation-delay: 0.15s; }
      @keyframes splashOut { 0% { transform: translate(0,0) scale(1); opacity: 0.7; } 50% { transform: translate(0,-8px) scale(1.3); opacity: 0.3; } 100% { transform: translate(0,-3px) scale(0.4); opacity: 0; } }

      .drip { animation: dripFall 1.4s ease-in infinite; }
      .drip.d2 { animation-delay: 0.5s; }
      .drip.d3 { animation-delay: 1s; }
      @keyframes dripFall { 0% { transform: translateY(0); opacity: 0.8; } 50% { opacity: 0.5; } 100% { transform: translateY(20px); opacity: 0; } }

      .tank-overlay {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%); text-align: center; z-index: 10;
        color: white; pointer-events: none;
        text-shadow: 0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.3);
      }
      .percentage { font-size: 2em; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
      .percentage .pct { font-size: 0.5em; font-weight: 500; opacity: 0.85; vertical-align: super; }
      .percentage.low { color: #fbbf24; }
      .temperature { font-size: 0.9em; margin-top: 4px; font-weight: 500; opacity: 0.9; }
      .temperature.warn { color: #fbbf24; }

      .warning-icon { position: absolute; z-index: 20; animation: pulse 1.5s ease-in-out infinite; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
      .temp-warning { top: 5px; left: 50%; transform: translateX(-50%); }
      .low-warning { bottom: 45px; left: 50%; transform: translateX(-50%); }
      @keyframes pulse { 0%,100% { opacity: 1; transform: translateX(-50%) scale(1); } 50% { opacity: 0.5; transform: translateX(-50%) scale(0.9); } }

      .info-bar { display: flex; justify-content: center; gap: 20px; width: 100%; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(128,128,128,0.15); }
      .stat { display: flex; align-items: center; gap: 8px; }
      .stat-icon { color: var(--secondary-text-color); opacity: 0.5; display: flex; align-items: center; }
      .stat-icon.active { color: #3b82f6; opacity: 1; animation: pulseIcon 2s ease-in-out infinite; }
      @keyframes pulseIcon { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      .stat-data { display: flex; flex-direction: column; }
      .label { font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--secondary-text-color); opacity: 0.7; }
      .value { font-size: 1.05em; font-weight: 600; color: var(--primary-text-color); }
    `;
  }
}

customElements.define("water-tank-card", WaterTankCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "water-tank-card",
  name: "Water Tank Card",
  preview: true,
  description: "A card to visualize water tank volume, temperature and flows with safety warnings.",
});
