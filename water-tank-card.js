import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// Version 19.0 - Final Release
console.info("%c WATER-TANK-CARD %c v19.0.0 ", "color: white; background: #2ecc71; font-weight: 700;", "color: #2ecc71; background: white; font-weight: 700;");

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

  // Ensure editor is loaded
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

    let waterColor = "#3498db";
    if (tempC !== null) {
      if (isTempWarning) waterColor = "#e67e22";
      else {
        const ratio = Math.max(0, Math.min(1, tempC / tempThreshold));
        const r = Math.round(52 + (72 - 52) * ratio);
        const g = Math.round(152 + (201 - 152) * ratio);
        const b = Math.round(219 + (176 - 219) * ratio);
        waterColor = `rgb(${r}, ${g}, ${b})`;
      }
    }

    const waterPercent = percentage;

    /* GEOMETRY */
    const tankX = 55;
    const tankY = 35;
    const tankW = 90;
    const tankH = 110;

    return html`
            <ha-card>
                <div class="card-content">
                    <div class="header">${this.config.name || "Water Tank"}</div>
                    
                    <div class="tank-container">
                        <!-- SVG STATIC LAYER -->
                        <svg class="tank-svg" viewBox="0 0 200 180" style="overflow: visible;">
                            <defs>
                                <linearGradient id="wg" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" style="stop-color:${waterColor};stop-opacity:0.9"/>
                                    <stop offset="100%" style="stop-color:${waterColor};stop-opacity:1"/>
                                </linearGradient>
                            </defs>

                            <!-- Inflow Pipe -->
                            <path d="M20 20 L70 20 L70 35" fill="none" stroke="#7f8c8d" stroke-width="6" stroke-linecap="round"/>
                            
                            <!-- Outflow Pipe -->
                            <path d="M145 125 L175 125 L175 140" fill="none" stroke="#7f8c8d" stroke-width="6" stroke-linecap="round"/>

                            <!-- Tank -->
                            <rect x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="4" fill="rgba(128,128,128,0.1)"/>
                            <rect x="${tankX + 2}" y="${tankY + tankH * (1 - waterPercent / 100)}" width="${tankW - 4}" height="${tankH * waterPercent / 100}" rx="2" fill="url(#wg)"/>
                            <rect x="${tankX}" y="${tankY}" width="${tankW}" height="${tankH}" rx="4" fill="none" stroke="var(--primary-text-color)" stroke-width="2"/>
                        </svg>

                        <!-- ANIMATIONS -->
                        ${inflowRate > 0 ? html`
                            <div class="anim-water inflow-water"></div>
                        ` : ""}

                        ${isOutflow ? html`
                            <div class="anim-water outflow-water"></div>
                        ` : ""}

                        <!-- OVERLAYS -->
                        <div class="tank-overlay">
                            <div class="percentage">${percentage.toFixed(1)}%</div>
                            ${displayTemp !== null ? html`
                                <div class="temperature">${displayTemp.toFixed(1)}${displayTempUnit}</div>
                            ` : ""}
                        </div>

                        <!-- Warnings -->
                        ${isTempWarning ? html`
                            <div class="warning-icon temp-warning">
                                <svg viewBox="0 0 40 40" width="36" height="36">
                                    <path d="M20 5 L5 35 L35 35 Z" fill="#e74c3c" stroke="white" stroke-width="2"/>
                                    <text x="20" y="30" text-anchor="middle" font-size="20" font-weight="bold" fill="white">!</text>
                                </svg>
                            </div>
                        ` : ""}

                        ${isLowWarning ? html`
                            <div class="warning-icon low-warning">
                                <svg viewBox="0 0 40 40" width="36" height="36">
                                    <path d="M20 8 Q 30 20 30 26 A 10 10 0 1 1 10 26 Q 10 20 20 8 Z" fill="#3498db" stroke="white" stroke-width="1.5"/>
                                    <line x1="8" y1="35" x2="32" y2="10" stroke="#e74c3c" stroke-width="4" stroke-linecap="round"/>
                                </svg>
                            </div>
                        ` : ""}
                    </div>

                    <div class="info">
                        <div class="stat">
                            <span class="label">Today's Inflow</span>
                            <span class="value">${displayRainTotal.toFixed(1)} ${displayRainUnit}</span>
                        </div>
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
            ha-card { padding: 4px; }
            .card-content { display: flex; flex-direction: column; align-items: center; }
            .header { font-size: 1.2em; font-weight: bold; margin-bottom: 0px; }
            
            .tank-container {
                position: relative;
                width: 200px; 
                height: 180px;
                margin-top: 10px;
                display: flex;
                justify-content: center;
            }
            
            .tank-svg {
                width: 100%;
                height: 100%;
            }

            .anim-water {
                position: absolute;
                pointer-events: none;
                z-index: 5;
                background: repeating-linear-gradient(
                    45deg,
                    #3498db,
                    #3498db 10px,
                    #5dade2 10px,
                    #5dade2 20px
                );
                opacity: 0.9;
                width: 6px;
                animation: flowDown 1s linear infinite;
                border-bottom-left-radius: 5px;
                border-bottom-right-radius: 5px;
            }

            .inflow-water {
                top: 35px;
                left: 67px;
                height: 100px;
            }

            .outflow-water {
                top: 140px;
                left: 172px;
                height: 20px; /* Shortened to half length */
            }

            @keyframes flowDown {
                0% { background-position: 0 0; }
                100% { background-position: 0 40px; }
            }
            
            .tank-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                z-index: 10;
                color: white;
                text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5);
                pointer-events: none;
            }
            
            .percentage {
                font-size: 1.5em;
                font-weight: bold;
            }
            
            .temperature {
                font-size: 1em;
                margin-top: 2px;
            }
            
            .warning-icon {
                position: absolute;
                z-index: 20;
                animation: flash 1.5s infinite;
            }
            
            .temp-warning {
                top: 5px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .low-warning {
                bottom: 35px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            @keyframes flash {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
            
            .info { display: flex; justify-content: center; width: 100%; margin-top: 10px; }
            .stat { display: flex; flex-direction: column; align-items: center; }
            .label { font-size: 0.8em; color: var(--secondary-text-color); }
            .value { font-size: 1.1em; font-weight: 500; }
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
