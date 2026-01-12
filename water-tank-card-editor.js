import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

console.info("WATER TANK EDITOR LOADED");

class WaterTankCardEditor extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            config: { type: Object },
        };
    }

    setConfig(config) {
        this.config = config;
    }

    render() {
        if (!this.hass || !this.config) {
            return html``;
        }

        return html`
            <div class="card-config">
                <div class="option">
                    <ha-textfield
                        label="Max Volume (if entity is not %)"
                        .value=${this.config.max_volume || ""}
                        .configValue=${"max_volume"}
                        type="number"
                        @input=${this._valueChanged}
                    ></ha-textfield>
                </div>
                <div class="option">
                    <ha-textfield
                        label="Roof Size (m² or ft²)"
                        .value=${this.config.roof_size || 100}
                        .configValue=${"roof_size"}
                        type="number"
                        @input=${this._valueChanged}
                    ></ha-textfield>
                </div>
                <div class="option">
                    <ha-textfield
                        label="High Temp Threshold (°C)"
                        .value=${this.config.warning_threshold || 20}
                        .configValue=${"warning_threshold"}
                        type="number"
                        @input=${this._valueChanged}
                    ></ha-textfield>
                </div>
                 <div class="option">
                    <ha-textfield
                        label="Low Level Threshold (%)"
                        .value=${this.config.low_level_threshold || 10}
                        .configValue=${"low_level_threshold"}
                        type="number"
                        @input=${this._valueChanged}
                    ></ha-textfield>
                </div>

            </div>
        `;
    }

    _valueChanged(ev) {
        if (!this.config || !this.hass) {
            return;
        }
        const target = ev.target;
        if (this[`_${target.configValue}`] === target.value) {
            return;
        }
        if (target.configValue) {
            if (target.checked !== undefined) {
                // Handle booleans (switches)
                this.config = {
                    ...this.config,
                    [target.configValue]: target.checked,
                };
            } else {
                // Handle strings/numbers (textfields, pickers)
                if (target.value === "" || target.value === undefined || target.value === null) {
                    const tmpConfig = { ...this.config };
                    delete tmpConfig[target.configValue];
                    this.config = tmpConfig;
                } else {
                    this.config = {
                        ...this.config,
                        [target.configValue]: target.value,
                    };
                }
            }
        }

        // Ensure values are numbers where expected
        if (this.config.roof_size) this.config.roof_size = Number(this.config.roof_size);
        if (this.config.max_volume) this.config.max_volume = Number(this.config.max_volume);
        if (this.config.warning_threshold) this.config.warning_threshold = Number(this.config.warning_threshold);
        if (this.config.low_level_threshold) this.config.low_level_threshold = Number(this.config.low_level_threshold);

        const event = new CustomEvent("config-changed", {
            detail: { config: this.config },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    static get styles() {
        return css`
            .card-config {
                display: flex;
                flex-direction: column;
            }
            .option {
                margin-bottom: 20px;
                display: block; /* Ensure block display key for spacing */
            }
            ha-textfield, ha-entity-picker {
                width: 100%;
                display: block;
            }
        `;
    }
}

customElements.define("water-tank-card-editor", WaterTankCardEditor);
