import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// Version 21.0 - 3D Cylinder Tank
console.info("%c WATER-TANK-CARD %c v21.0.0 ", "color: white; background: #0ea5e9; font-weight: 700;", "color: #0ea5e9; background: white; font-weight: 700;");

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
    }

    // --- VOLUME LOGIC ---
    let percentage = 0;
    if (stateObj && !isNaN(parseFloat(stateObj.state))) {
      let volumeRaw = parseFloat(stateObj.state);
      percentage = volumeRaw;
      if (stateObj.attributes.unit_of_measurement !== "%" && this.config.max_volume) {
        percentage = (volumeRaw / this.config.max_volume) * 100;
      }
      percentage = Math.min(100, Math.max(0, percentage));
    }

    // --- UNITS ---
    const isUS = this.config.us_units;

    // --- TEMP LOGIC ---
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

    // --- INFLOW LOGIC ---
    let inflowRate = 0;
    if (inflowRateObj && !isNaN(parseFloat(inflowRateObj.state))) {
      inflowRate = parseFloat(inflowRateObj.state);
    }

    // --- RAIN TOTAL ---
    const rainTotalRaw = (rainTotalObj && !isNaN(parseFloat(rainTotalObj.state))) ? parseFloat(rainTotalObj.state) : 0;
    const roofSize = this.config.roof_size || 100;
    let displayRainTotal = isUS ? (rainTotalRaw * roofSize * 0.264172) : (rainTotalRaw * roofSize);
    let displayRainUnit = isUS ? "gal" : "L";

    // --- VISUALS ---
    const tempThreshold = this.config.warning_threshold || 20;
    const lowLevelThreshold = this.config.low_level_threshold ?? 10;

    const isTempWarning = tempC !== null && tempC > tempThreshold;
    const isLowWarning = percentage <= lowLevelThreshold;

    // Water colors — vivid blues, shift warm with temperature
    let wTop = "#22d3ee";
    let wMid = "#0284c7";
    let wBot = "#0c4a6e";
    if (tempC !== null) {
      if (isTempWarning) {
        wTop = "#fb923c";
        wMid = "#ea580c";
        wBot = "#7c2d12";
      } else {
        const r = Math.max(0, Math.min(1, tempC / tempThreshold));
        wTop = `rgb(${Math.round(34 + 217 * r)}, ${Math.round(211 - 65 * r)}, ${Math.round(238 - 178 * r)})`;
        wMid = `rgb(${Math.round(2 + 232 * r)}, ${Math.round(132 - 44 * r)}, ${Math.round(199 - 187 * r)})`;
        wBot = `rgb(${Math.round(12 + 112 * r)}, ${Math.round(74 - 29 * r)}, ${Math.round(110 - 92 * r)})`;
      }
    }

    const wp = percentage; // water percent

    /* ============ CYLINDER GEOMETRY ============ */
    const cx = 100;       // center X
    const rx = 48;        // horizontal radius of ellipse
    const ry = 14;        // vertical radius (perspective depth)
    const topY = 38;      // Y of top ellipse center
    const botY = 158;     // Y of bottom ellipse center
    const bodyH = botY - topY; // height of the cylinder body

    // Water surface Y position
    const waterSurfY = botY - (bodyH * wp / 100);
    // Water body spans from waterSurfY down to botY

    // Inflow pipe: comes from left, bends down into tank top
    const pipeInEndX = cx - 15;
    const pipeInY = topY - 18;

    // Outflow pipe: exits right side of tank near bottom, goes right then down
    const pipeOutStartY = botY - 18;
    const pipeOutEndX = 188;
    const pipeOutBendY = botY + 30;

    // Unique ID prefix for SVG defs
    const u = Math.random().toString(36).substr(2, 6);

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
                <!-- Water body gradient (top to bottom) -->
                <linearGradient id="wg-${u}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="${wTop}" stop-opacity="0.9"/>
                  <stop offset="50%" stop-color="${wMid}" stop-opacity="0.95"/>
                  <stop offset="100%" stop-color="${wBot}" stop-opacity="1"/>
                </linearGradient>

                <!-- Water surface ellipse gradient (lighter, translucent) -->
                <radialGradient id="wsurf-${u}" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="${wTop}" stop-opacity="0.95"/>
                  <stop offset="100%" stop-color="${wMid}" stop-opacity="0.85"/>
                </radialGradient>

                <!-- Specular highlight on water body (left side shine) -->
                <linearGradient id="whl-${u}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="white" stop-opacity="0.18"/>
                  <stop offset="20%" stop-color="white" stop-opacity="0.05"/>
                  <stop offset="100%" stop-color="white" stop-opacity="0"/>
                </linearGradient>

                <!-- Tank body gradient (metallic cylinder) -->
                <linearGradient id="cyl-${u}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="var(--primary-text-color)" stop-opacity="0.12"/>
                  <stop offset="15%" stop-color="var(--primary-text-color)" stop-opacity="0.04"/>
                  <stop offset="50%" stop-color="var(--primary-text-color)" stop-opacity="0.02"/>
                  <stop offset="85%" stop-color="var(--primary-text-color)" stop-opacity="0.04"/>
                  <stop offset="100%" stop-color="var(--primary-text-color)" stop-opacity="0.14"/>
                </linearGradient>

                <!-- Pipe gradient -->
                <linearGradient id="pg-${u}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#78909c"/>
                  <stop offset="30%" stop-color="#eceff1"/>
                  <stop offset="70%" stop-color="#90a4ae"/>
                  <stop offset="100%" stop-color="#546e7a"/>
                </linearGradient>

                <!-- Tank shadow -->
                <filter id="ts-${u}" x="-15%" y="-10%" width="130%" height="130%">
                  <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.2)"/>
                </filter>

                <!-- Clip: cylinder body (between the two ellipses) -->
                <clipPath id="cylClip-${u}">
                  <rect x="${cx - rx}" y="${topY}" width="${rx * 2}" height="${bodyH}"/>
                </clipPath>
              </defs>

              <!-- ====== INFLOW PIPE ====== -->
              <!-- Horizontal -->
              <rect x="8" y="${pipeInY - 5}" width="${pipeInEndX - 8}" height="10" rx="2" fill="url(#pg-${u})"/>
              <!-- Vertical -->
              <rect x="${pipeInEndX - 5}" y="${pipeInY}" width="10" height="${topY - pipeInY + ry}" rx="2" fill="url(#pg-${u})"/>
              <!-- Elbow -->
              <circle cx="${pipeInEndX}" cy="${pipeInY}" r="7" fill="url(#pg-${u})" stroke="#546e7a" stroke-width="0.8"/>
              <circle cx="${pipeInEndX}" cy="${pipeInY}" r="3" fill="#b0bec5"/>
              <!-- End cap -->
              <rect x="5" y="${pipeInY - 7}" width="6" height="14" rx="2" fill="#546e7a"/>

              <!-- ====== OUTFLOW PIPE ====== -->
              <!-- Horizontal from tank -->
              <rect x="${cx + rx - 3}" y="${pipeOutStartY - 5}" width="${pipeOutEndX - cx - rx + 8}" height="10" rx="2" fill="url(#pg-${u})"/>
              <!-- Vertical down -->
              <rect x="${pipeOutEndX - 5}" y="${pipeOutStartY}" width="10" height="${pipeOutBendY - pipeOutStartY}" rx="2" fill="url(#pg-${u})"/>
              <!-- Elbow -->
              <circle cx="${pipeOutEndX}" cy="${pipeOutStartY}" r="7" fill="url(#pg-${u})" stroke="#546e7a" stroke-width="0.8"/>
              <circle cx="${pipeOutEndX}" cy="${pipeOutStartY}" r="3" fill="#b0bec5"/>
              <!-- Nozzle -->
              <path d="M${pipeOutEndX - 6} ${pipeOutBendY} L${pipeOutEndX - 3} ${pipeOutBendY + 6} L${pipeOutEndX + 3} ${pipeOutBendY + 6} L${pipeOutEndX + 6} ${pipeOutBendY} Z" fill="#546e7a"/>

              <!-- ====== OUTFLOW WATER (when active) ====== -->
              ${isOutflow ? html`
              <!-- Water inside horizontal pipe -->
              <rect x="${cx + rx}" y="${pipeOutStartY - 2.5}" width="${pipeOutEndX - cx - rx}" height="5" rx="2" fill="${wMid}" opacity="0.75"/>
              <!-- Animated flow marker H -->
              <rect class="outflow-flow-h" x="${cx + rx}" y="${pipeOutStartY - 1.5}" width="${pipeOutEndX - cx - rx}" height="3" rx="1"
                fill="url(#pg-${u})" opacity="0"  />
              <line class="outflow-dash-h"
                x1="${cx + rx}" y1="${pipeOutStartY}"
                x2="${pipeOutEndX}" y2="${pipeOutStartY}"
                stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-dasharray="4 6" stroke-linecap="round"/>

              <!-- Water inside vertical pipe -->
              <rect x="${pipeOutEndX - 2.5}" y="${pipeOutStartY}" width="5" height="${pipeOutBendY - pipeOutStartY + 3}" rx="2" fill="${wMid}" opacity="0.75"/>
              <line class="outflow-dash-v"
                x1="${pipeOutEndX}" y1="${pipeOutStartY}"
                x2="${pipeOutEndX}" y2="${pipeOutBendY + 3}"
                stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-dasharray="4 6" stroke-linecap="round"/>

              <!-- Dripping water from nozzle -->
              <circle class="drip d1" cx="${pipeOutEndX}" cy="${pipeOutBendY + 10}" r="2.5" fill="${wTop}" opacity="0.8"/>
              <circle class="drip d2" cx="${pipeOutEndX}" cy="${pipeOutBendY + 20}" r="2" fill="${wMid}" opacity="0.6"/>
              <circle class="drip d3" cx="${pipeOutEndX}" cy="${pipeOutBendY + 28}" r="1.5" fill="${wMid}" opacity="0.4"/>

              <!-- Small puddle at bottom -->
              <ellipse cx="${pipeOutEndX}" cy="${pipeOutBendY + 38}" rx="8" ry="2" fill="${wMid}" opacity="0.25"/>
              ` : ""}

              <!-- ====== 3D CYLINDER TANK ====== -->
              <g filter="url(#ts-${u})">
                <!-- Back half of top ellipse (behind the water) -->
                <path d="M${cx - rx} ${topY} A${rx} ${ry} 0 0 1 ${cx + rx} ${topY}" fill="var(--primary-text-color)" fill-opacity="0.06" stroke="var(--primary-text-color)" stroke-width="1.5" stroke-opacity="0.4"/>

                <!-- Cylinder body -->
                <g clip-path="url(#cylClip-${u})">
                  <!-- Body fill -->
                  <rect x="${cx - rx}" y="${topY}" width="${rx * 2}" height="${bodyH}" fill="url(#cyl-${u})"/>

                  <!-- Left edge highlight -->
                  <rect x="${cx - rx}" y="${topY}" width="6" height="${bodyH}" fill="white" fill-opacity="0.06"/>

                  <!-- ====== WATER BODY ====== -->
                  ${wp > 0 ? html`
                  <!-- Main water fill rectangle -->
                  <rect x="${cx - rx + 2}" y="${waterSurfY}" width="${rx * 2 - 4}" height="${botY - waterSurfY}" fill="url(#wg-${u})"/>

                  <!-- Specular highlight on water -->
                  <rect x="${cx - rx + 2}" y="${waterSurfY}" width="${rx * 2 - 4}" height="${botY - waterSurfY}" fill="url(#whl-${u})"/>

                  <!-- Subtle caustic/ripple light patches -->
                  <ellipse cx="${cx - 12}" cy="${waterSurfY + (botY - waterSurfY) * 0.35}" rx="18" ry="10" fill="white" fill-opacity="0.06"/>
                  <ellipse cx="${cx + 18}" cy="${waterSurfY + (botY - waterSurfY) * 0.65}" rx="12" ry="8" fill="white" fill-opacity="0.04"/>
                  ` : ""}
                </g>

                <!-- Left wall -->
                <line x1="${cx - rx}" y1="${topY}" x2="${cx - rx}" y2="${botY}" stroke="var(--primary-text-color)" stroke-width="1.8" stroke-opacity="0.45"/>
                <!-- Right wall -->
                <line x1="${cx + rx}" y1="${topY}" x2="${cx + rx}" y2="${botY}" stroke="var(--primary-text-color)" stroke-width="1.8" stroke-opacity="0.45"/>

                <!-- Bottom ellipse (front half visible) -->
                <path d="M${cx - rx} ${botY} A${rx} ${ry} 0 0 0 ${cx + rx} ${botY}" fill="var(--primary-text-color)" fill-opacity="0.08" stroke="var(--primary-text-color)" stroke-width="1.5" stroke-opacity="0.4"/>

                <!-- ====== WATER SURFACE ELLIPSE ====== -->
                ${wp > 1 ? html`
                <ellipse class="water-surface" cx="${cx}" cy="${waterSurfY}" rx="${rx - 2}" ry="${ry - 1}" fill="url(#wsurf-${u})" stroke="${wTop}" stroke-width="1" stroke-opacity="0.5"/>
                <!-- Highlight arc on water surface -->
                <ellipse cx="${cx - 8}" cy="${waterSurfY - 1}" rx="${rx * 0.5}" ry="${ry * 0.35}" fill="white" fill-opacity="0.12"/>
                ` : ""}

                <!-- Bottom ellipse water fill (front arc) -->
                ${wp > 0 ? html`
                <path d="M${cx - rx + 2} ${botY} A${rx - 2} ${ry - 1} 0 0 0 ${cx + rx - 2} ${botY}" fill="${wBot}" fill-opacity="0.8"/>
                ` : ""}

                <!-- Front half of top ellipse (rim) -->
                <path d="M${cx - rx} ${topY} A${rx} ${ry} 0 0 0 ${cx + rx} ${topY}" fill="none" stroke="var(--primary-text-color)" stroke-width="1.8" stroke-opacity="0.5"/>

                <!-- Rim highlight -->
                <path d="M${cx - rx + 10} ${topY + ry * 0.6} A${rx - 10} ${ry * 0.4} 0 0 0 ${cx + rx - 10} ${topY + ry * 0.6}" fill="none" stroke="white" stroke-width="0.8" stroke-opacity="0.15"/>

                <!-- Bubbles inside water -->
                ${wp > 8 ? html`
                <circle class="bubble b1" cx="${cx - 18}" cy="${botY - 15}" r="2" fill="white" opacity="0.3"/>
                <circle class="bubble b2" cx="${cx + 10}" cy="${botY - 10}" r="1.5" fill="white" opacity="0.25"/>
                <circle class="bubble b3" cx="${cx + 25}" cy="${botY - 22}" r="2.2" fill="white" opacity="0.2"/>
                <circle class="bubble b4" cx="${cx - 5}" cy="${botY - 8}" r="1.8" fill="white" opacity="0.28"/>
                <circle class="bubble b5" cx="${cx + 15}" cy="${botY - 30}" r="1.2" fill="white" opacity="0.18"/>
                ` : ""}
              </g>

              <!-- ====== INFLOW ANIMATION ====== -->
              ${inflowRate > 0 ? html`
              <line class="flow-stream"
                x1="${pipeInEndX}" y1="${topY + ry + 2}"
                x2="${pipeInEndX}" y2="${Math.min(waterSurfY, botY - 5)}"
                stroke="${wTop}" stroke-width="5" stroke-linecap="round"
                stroke-dasharray="6 8" opacity="0.85"/>
              <!-- Splash -->
              <circle class="splash s1" cx="${pipeInEndX - 7}" cy="${waterSurfY}" r="2" fill="${wTop}" opacity="0.6"/>
              <circle class="splash s2" cx="${pipeInEndX + 6}" cy="${waterSurfY - 2}" r="1.8" fill="${wTop}" opacity="0.5"/>
              <circle class="splash s3" cx="${pipeInEndX - 3}" cy="${waterSurfY - 5}" r="1.3" fill="${wTop}" opacity="0.4"/>
              <circle class="splash s4" cx="${pipeInEndX + 10}" cy="${waterSurfY - 1}" r="1.5" fill="${wTop}" opacity="0.5"/>
              ` : ""}

              <!-- ====== LEVEL MARKERS ====== -->
              ${[25, 50, 75].map(lvl => {
                const markerY = botY - (bodyH * lvl / 100);
                return html`
                  <line x1="${cx - rx + 3}" y1="${markerY}" x2="${cx - rx + 11}" y2="${markerY}" stroke="var(--primary-text-color)" stroke-width="0.5" stroke-opacity="0.25"/>
                `;
              })}
            </svg>

            <!-- OVERLAYS -->
            <div class="tank-overlay" style="top: ${((topY + (botY - (bodyH * wp / 100))) / 2 + (botY) / 2) / 2 / 200 * 100}%;">
              <div class="percentage ${isLowWarning ? 'low' : ''}">${percentage.toFixed(0)}<span class="pct">%</span></div>
              ${displayTemp !== null ? html`
                <div class="temperature ${isTempWarning ? 'warn' : ''}">${displayTemp.toFixed(1)}${displayTempUnit}</div>
              ` : ""}
            </div>

            <!-- Warnings -->
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
      .card-content {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.15em;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--primary-text-color);
        margin-bottom: 4px;
      }
      .header-icon {
        color: var(--primary-color, #0ea5e9);
        flex-shrink: 0;
      }
      
      .tank-container {
        position: relative;
        width: 240px;
        height: 210px;
        margin-top: 8px;
        display: flex;
        justify-content: center;
      }
      
      .tank-svg {
        width: 100%;
        height: 100%;
      }

      /* ====== WATER SURFACE WOBBLE ====== */
      .water-surface {
        animation: wobble 3s ease-in-out infinite alternate;
        transform-origin: center;
      }

      @keyframes wobble {
        0%   { transform: scaleX(0.97); }
        50%  { transform: scaleX(1.02); }
        100% { transform: scaleX(0.97); }
      }

      /* ====== BUBBLE ANIMATION ====== */
      .bubble {
        animation: rise 4s ease-in infinite;
      }
      .bubble.b2 { animation-delay: 1s; animation-duration: 3.5s; }
      .bubble.b3 { animation-delay: 2.2s; animation-duration: 5s; }
      .bubble.b4 { animation-delay: 0.5s; animation-duration: 3s; }
      .bubble.b5 { animation-delay: 3s; animation-duration: 4.5s; }

      @keyframes rise {
        0%   { transform: translateY(0); opacity: 0.3; }
        50%  { opacity: 0.15; }
        100% { transform: translateY(-70px); opacity: 0; }
      }

      /* ====== INFLOW STREAM ====== */
      .flow-stream {
        animation: flowDash 0.7s linear infinite;
      }

      @keyframes flowDash {
        0%   { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -14; }
      }

      /* ====== OUTFLOW WATER DASHES ====== */
      .outflow-dash-h {
        animation: outflowH 0.5s linear infinite;
      }
      .outflow-dash-v {
        animation: outflowV 0.5s linear infinite;
      }

      @keyframes outflowH {
        0%   { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -10; }
      }
      @keyframes outflowV {
        0%   { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -10; }
      }

      /* ====== SPLASH ====== */
      .splash {
        animation: splashOut 1.2s ease-out infinite;
      }
      .splash.s2 { animation-delay: 0.3s; }
      .splash.s3 { animation-delay: 0.6s; }
      .splash.s4 { animation-delay: 0.15s; }

      @keyframes splashOut {
        0%   { transform: translate(0, 0) scale(1); opacity: 0.7; }
        50%  { transform: translate(0, -8px) scale(1.3); opacity: 0.3; }
        100% { transform: translate(0, -3px) scale(0.4); opacity: 0; }
      }

      /* ====== DRIP ANIMATION ====== */
      .drip {
        animation: dripFall 1.4s ease-in infinite;
      }
      .drip.d2 { animation-delay: 0.5s; }
      .drip.d3 { animation-delay: 1s; }

      @keyframes dripFall {
        0%   { transform: translateY(0); opacity: 0.8; }
        50%  { opacity: 0.5; }
        100% { transform: translateY(20px); opacity: 0; }
      }

      /* ====== OVERLAY TEXT ====== */
      .tank-overlay {
        position: absolute;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        z-index: 10;
        color: white;
        text-shadow:
          0 1px 4px rgba(0,0,0,0.8),
          0 0 12px rgba(0,0,0,0.3);
        pointer-events: none;
        transition: top 1s ease;
      }
      
      .percentage {
        font-size: 2em;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .percentage .pct {
        font-size: 0.5em;
        font-weight: 500;
        opacity: 0.85;
        vertical-align: super;
      }
      .percentage.low {
        color: #fbbf24;
      }
      
      .temperature {
        font-size: 0.9em;
        margin-top: 4px;
        font-weight: 500;
        opacity: 0.9;
      }
      .temperature.warn {
        color: #fbbf24;
      }
      
      /* ====== WARNINGS ====== */
      .warning-icon {
        position: absolute;
        z-index: 20;
        animation: pulse 1.5s ease-in-out infinite;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      }
      
      .temp-warning {
        top: 5px;
        left: 50%;
        transform: translateX(-50%);
      }
      
      .low-warning {
        bottom: 45px;
        left: 50%;
        transform: translateX(-50%);
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
        50% { opacity: 0.5; transform: translateX(-50%) scale(0.9); }
      }
      
      /* ====== INFO BAR ====== */
      .info-bar {
        display: flex;
        justify-content: center;
        gap: 20px;
        width: 100%;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(128,128,128,0.15);
      }
      .stat {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .stat-icon {
        color: var(--secondary-text-color);
        opacity: 0.5;
        display: flex;
        align-items: center;
      }
      .stat-icon.active {
        color: #3b82f6;
        opacity: 1;
        animation: pulse-icon 2s ease-in-out infinite;
      }

      @keyframes pulse-icon {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .stat-data {
        display: flex;
        flex-direction: column;
      }
      .label {
        font-size: 0.7em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--secondary-text-color);
        opacity: 0.7;
      }
      .value {
        font-size: 1.05em;
        font-weight: 600;
        color: var(--primary-text-color);
      }
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
